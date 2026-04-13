let lastRecords = [];
let lastUniqueQueries = [];

function uniqueStrings(arr) {
  return [...new Set(arr.filter(item => typeof item === "string" && item.trim()))];
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? "#b00020" : "#666";
}

function formatRecords(records) {
  if (!records.length) {
    lastUniqueQueries = [];
    return "Ingen fund endnu. Tryk 'Genindlæs og scan'.";
  }

  const lines = [];
  const allQueries = [];

  records.forEach((record, recordIndex) => {
    lines.push(`--- SESSION ${recordIndex + 1} ---`);
    lines.push(`Tid: ${record.capturedAt || record.time || "-"}`);
    if (record.url) {
      lines.push(`URL: ${record.url}`);
    }
    lines.push("");

    (record.groups || []).forEach((group, groupIndex) => {
      const queries = uniqueStrings(group.queries || []);
      lines.push(`PROMPT ${groupIndex + 1}`);
      queries.forEach(query => {
        lines.push(`- ${query}`);
        allQueries.push(query);
      });
      lines.push("");
    });
  });

  lastUniqueQueries = uniqueStrings(allQueries);
  lines.push("SAMLET UNIK LISTE:");
  lastUniqueQueries.forEach(query => lines.push(`- ${query}`));

  return lines.join("\n");
}

function buildCsv(records) {
  const rows = [["record_number", "captured_at", "url", "group_number", "path", "query"]];

  records.forEach((record, recordIndex) => {
    (record.groups || []).forEach((group, groupIndex) => {
      const queries = uniqueStrings(group.queries || []);
      queries.forEach(query => {
        rows.push([
          String(recordIndex + 1),
          record.capturedAt || record.time || "",
          record.url || "",
          String(groupIndex + 1),
          group.path || "",
          query
        ]);
      });
    });
  });

  return rows.map(row =>
    row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")
  ).join("\n");
}

function downloadCsv(text, filename) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshState() {
  const response = await sendMessage({ type: "getState" });
  if (!response?.ok) {
    setStatus(response?.error || "Kunne ikke hente state.", true);
    return;
  }

  const data = response.data || {};
  lastRecords = Array.isArray(data.records) ? data.records : [];
  setStatus(data.status || "Klar.");
  document.getElementById("output").textContent = formatRecords(lastRecords);
}

document.getElementById("reloadBtn").addEventListener("click", async () => {
  const response = await sendMessage({ type: "reloadAndScan" });
  if (!response?.ok) {
    setStatus(response?.error || "Kunne ikke genindlæse og scanne.", true);
    return;
  }
  setStatus("Genindlæser og scanner...");
  setTimeout(refreshState, 1500);
});

document.getElementById("refreshBtn").addEventListener("click", refreshState);

document.getElementById("clearBtn").addEventListener("click", async () => {
  const response = await sendMessage({ type: "clearRecords" });
  if (!response?.ok) {
    setStatus(response?.error || "Kunne ikke rydde fund.", true);
    return;
  }
  document.getElementById("output").textContent = "";
  refreshState();
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(document.getElementById("output").textContent);
    setStatus("Output kopieret.");
  } catch (_) {
    setStatus("Kunne ikke kopiere output.", true);
  }
});

document.getElementById("copyUniqueBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(lastUniqueQueries.join("\n"));
    setStatus("Unik liste kopieret.");
  } catch (_) {
    setStatus("Kunne ikke kopiere unik liste.", true);
  }
});

const csvBtn = document.getElementById("csvBtn");
if (csvBtn) {
  csvBtn.addEventListener("click", () => {
    if (!lastRecords.length) {
      setStatus("Ingen fund at eksportere endnu.", true);
      return;
    }
    const csv = buildCsv(lastRecords);
    downloadCsv(csv, "search_model_fan_out_queries_v3_3.csv");
    setStatus("CSV downloadet.");
  });
}

refreshState();
