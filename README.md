# Search Model Fan Out Queries Extractor v3.3

# ChatGPT Search Model Queries Extractor

Denne version er optimeret til at udtrække Search Model Queries ved at genindlæse og scanne den aktive ChatGPT-samtale.

## Om udvikleren
* **Navn**: Jonas Egballe Larsen
* **specialist**: i SEO & AI Search
* **Connect med mig på LinkedIn**: https://www.linkedin.com/in/jonas-egballe-larsen-55855b146

## Hvad værktøjet fanger
Værktøjet kan udtrække "fan out queries". Det betyder, at når ChatGPT udfører komplekse søgninger på nettet, opsamler dette værktøj samtlige de parallelle quieres og variationer, som modellen genererer for at indsamle viden. 

For en SEO-specialist giver dette et unikt indblik i:
* AI-modellens søgeintention.
* Hvilke semantiske variationer modellen vægter højest.
* Den overordnede research-strategi bag et givent svar.
* De faktiske "fan out queries" brugt i netværksaktiviteten.

## Installation
1. Pak zip-filen ud på din computer.
2. Åbn Chrome og gå til `chrome://extensions/`.
3. Slå **"Developer mode"** til i øverste højre hjørne.
4. Klik på **"Load unpacked"** (Hent upakket).
5. Vælg mappen, der indeholder extension-filerne. (Slet ikke mappen)

## Sådan bruger du værktøjet
1. Åbn den ChatGPT-samtale, du ønsker at analysere.
2. Klik på plugin-ikonet i din værktøjslinje.
3. Klik på den grønne knap **"Genindlæs og scan"**.
   * Siden genindlæses nu, og værktøjet fanger automatisk data fra netværkstrafikken.
4. Klik på **"Opdatér visning"** for at få de udtrukne queries frem i oversigten. (Benyt "ryd fund" ved ny kørsel)
5. Brug knapperne til at kopiere den unikke liste eller downloade en CSV-fil.

## Bemærk
* Værktøjet benytter Chromes debugger-funktion til at læse JSON-responser.
* Hvis du har "Developer Tools" (F12) åbent i samme fane, kan det deaktivere overvågningen.
* Kun optimeret til brug på chatgpt.com.
* **OBS: Virker kun så længe at ChatGPT viser "Fan outs" i netværksaktiviteten.**
* Benyt seneste model med "Thinking" og få større output.
