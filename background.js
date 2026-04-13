
const DEBUGGER_VERSION = "1.3";
const STORAGE_KEYS = {
  records: "records",
  isMonitoring: "isMonitoring",
  monitoredTabId: "monitoredTabId",
  status: "status"
};

let attachedTabId = null;
let requestMetaByTab = new Map();

async function setStatus(message) {
  await chrome.storage.local.set({ [STORAGE_KEYS.status]: message });
}

async function getRecords() {
  const data = await chrome.storage.local.get([STORAGE_KEYS.records]);
  return Array.isArray(data[STORAGE_KEYS.records]) ? data[STORAGE_KEYS.records] : [];
}

async function setRecords(records) {
  await chrome.storage.local.set({ [STORAGE_KEYS.records]: records });
}

async function appendRecord(record) {
  const records = await getRecords();
  const exists = records.some(r =>
    r.url === record.url &&
    JSON.stringify(r.queriesFlat || []) === JSON.stringify(record.queriesFlat || [])
  );

  if (!exists) {
    records.push(record);
    await setRecords(records);
  }
}

function isRelevantUrl(url) {
  if (typeof url !== "string") return false;
  return url.includes("/backend-api/conversation/") || url.includes("/backend-api/conversations/");
}

function findSearchModelQueryGroups(data) {
  const groups = [];

  function walk(node, path = "root") {
    if (!node || typeof node !== "object") return;

    if (
      node.search_model_queries &&
      typeof node.search_model_queries === "object" &&
      Array.isArray(node.search_model_queries.queries)
    ) {
      groups.push({
        path: `${path}.search_model_queries`,
        queries: node.search_model_queries.queries.filter(q => typeof q === "string")
      });
    }

    if (node.type === "search_model_queries" && Array.isArray(node.queries)) {
      groups.push({
        path,
        queries: node.queries.filter(q => typeof q === "string")
      });
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      walk(value, `${path}.${key}`);
    }
  }

  walk(data);
  return groups;
}

function uniqueStrings(arr) {
  return [...new Set(arr.filter(item => typeof item === "string" && item.trim()))];
}

async function attachToTab(tabId) {
  if (attachedTabId && attachedTabId !== tabId) {
    await detachFromTab(attachedTabId);
  }

  try {
    await chrome.debugger.attach({ tabId }, DEBUGGER_VERSION);
  } catch (error) {
    if (!String(error.message || "").includes("Another debugger is already attached")) {
      throw error;
    }
  }

  await chrome.debugger.sendCommand({ tabId }, "Network.enable");
  attachedTabId = tabId;
  requestMetaByTab.set(tabId, new Map());

  await chrome.storage.local.set({
    [STORAGE_KEYS.isMonitoring]: true,
    [STORAGE_KEYS.monitoredTabId]: tabId
  });

  await setStatus(`Overvågning aktiv på tab ${tabId}.`);
}

async function detachFromTab(tabId) {
  try {
    await chrome.debugger.detach({ tabId });
  } catch (_) {}

  if (attachedTabId === tabId) {
    attachedTabId = null;
  }
  requestMetaByTab.delete(tabId);

  await chrome.storage.local.set({
    [STORAGE_KEYS.isMonitoring]: false,
    [STORAGE_KEYS.monitoredTabId]: null
  });

  await setStatus("Overvågning stoppet.");
}

async function getActiveChatGPTTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab || !tab.id) {
    throw new Error("Kunne ikke finde aktiv tab.");
  }

  if (!tab.url || !tab.url.includes("chatgpt.com")) {
    throw new Error("Den aktive tab er ikke ChatGPT.");
  }

  return tab;
}

async function startMonitoringActiveTab() {
  const tab = await getActiveChatGPTTab();
  await attachToTab(tab.id);
  await setStatus(`Overvågning aktiv på tab ${tab.id}. Reload siden eller brug 'Genindlæs og scan'.`);
}

async function reloadAndScan() {
  const tab = await getActiveChatGPTTab();
  await attachToTab(tab.id);
  await setStatus("Genindlæser ChatGPT og scanner efter conversation-responses...");
  await chrome.tabs.reload(tab.id);
}

async function stopMonitoring() {
  if (attachedTabId) {
    await detachFromTab(attachedTabId);
  } else {
    await chrome.storage.local.set({
      [STORAGE_KEYS.isMonitoring]: false,
      [STORAGE_KEYS.monitoredTabId]: null
    });
    await setStatus("Ingen aktiv overvågning.");
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    [STORAGE_KEYS.records]: [],
    [STORAGE_KEYS.isMonitoring]: false,
    [STORAGE_KEYS.monitoredTabId]: null,
    [STORAGE_KEYS.status]: "Klar. Klik Start overvågning eller Genindlæs og scan på en ChatGPT-fane."
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === "startMonitoring") {
        await startMonitoringActiveTab();
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "reloadAndScan") {
        await reloadAndScan();
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "stopMonitoring") {
        await stopMonitoring();
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "clearRecords") {
        await setRecords([]);
        await setStatus("Listen er ryddet.");
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "getState") {
        const data = await chrome.storage.local.get([
          STORAGE_KEYS.records,
          STORAGE_KEYS.isMonitoring,
          STORAGE_KEYS.monitoredTabId,
          STORAGE_KEYS.status
        ]);
        sendResponse({ ok: true, data });
        return;
      }

      sendResponse({ ok: false, error: "Ukendt beskedtype." });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();

  return true;
});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  const tabId = source.tabId;
  if (!tabId || tabId !== attachedTabId) return;

  if (!requestMetaByTab.has(tabId)) {
    requestMetaByTab.set(tabId, new Map());
  }
  const requestMap = requestMetaByTab.get(tabId);

  try {
    if (method === "Network.responseReceived") {
      const url = params?.response?.url || "";
      const mimeType = params?.response?.mimeType || "";

      if (isRelevantUrl(url) && (mimeType.includes("json") || mimeType.includes("text"))) {
        requestMap.set(params.requestId, { url });
      }
      return;
    }

    if (method === "Network.loadingFinished") {
      const meta = requestMap.get(params.requestId);
      if (!meta) return;

      const bodyResult = await chrome.debugger.sendCommand(
        { tabId },
        "Network.getResponseBody",
        { requestId: params.requestId }
      );

      requestMap.delete(params.requestId);

      let text = bodyResult?.body || "";
      if (bodyResult?.base64Encoded) {
        try {
          text = atob(text);
        } catch (_) {}
      }

      if (!text || !text.includes("search_model_queries")) {
        return;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        return;
      }

      const groups = findSearchModelQueryGroups(parsed);
      if (!groups.length) return;

      const uniqueQueries = uniqueStrings(groups.flatMap(group => group.queries));

      await appendRecord({
        capturedAt: new Date().toISOString(),
        url: meta.url,
        groups,
        queriesFlat: uniqueQueries,
        uniqueQueries
      });

      await setStatus(`Fandt ${groups.length} gruppe(r) i seneste relevante response.`);
    }
  } catch (error) {
    await setStatus(`Fejl under læsning af response: ${error.message || error}`);
  }
});

chrome.debugger.onDetach.addListener(async (source) => {
  if (source.tabId && source.tabId === attachedTabId) {
    attachedTabId = null;
    requestMetaByTab.delete(source.tabId);

    await chrome.storage.local.set({
      [STORAGE_KEYS.isMonitoring]: false,
      [STORAGE_KEYS.monitoredTabId]: null
    });

    await setStatus("Debugger blev frakoblet.");
  }
});
