#!/usr/bin/env node
/**
 * Pályázatfigyelő – hírfigyelő szkript.
 *
 * Forrásonként (data/sources.json) letölti az oldalt, a szöveges tartalmából
 * kiszűri a nyilvánvalóan dinamikus részeket (időbélyeg, sütibanner, session
 * token), SHA-256 hash-t számol, és összeveti az előző futás hash-ével
 * (data/state.json). Ha változott, megnézi, hogy az újonnan megjelent
 * szövegrészben szerepel-e valamelyik figyelt kulcsszó.
 *
 * Szándékosan NEM CSS-szelektorokra épül: nem az érdekel, hogy pontosan mi
 * van az oldalon, hanem hogy változott-e a szövege. Egy szelektoros scraper
 * minden oldal-redesignnál eltörik, a szöveg-hash nem.
 *
 * Node 20+, natív fetch, nulla külső függőség.
 * Forrásonként egy kérés fut, futásonként, szekvenciálisan (nincs párhuzamos hajtás).
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCES_PATH = path.join(ROOT, "data", "sources.json");
const STATE_PATH = path.join(ROOT, "data", "state.json");
const CHANGES_PATH = path.join(ROOT, "data", "changes.json");

const REPO_URL = process.env.PF_REPO_URL || "https://github.com/milan990920/palyazatfigyelo";
const USER_AGENT = `palyazatfigyelo-bot/1.0 (+${REPO_URL})`;
const FETCH_TIMEOUT_MS = 20000;
const FAILURE_ALERT_THRESHOLD = 3;
const TEXT_SAMPLE_LIMIT = 4000; // ennyi karaktert őrzünk meg futások közötti diffeléshez

const KEYWORDS = [
  "felfüggesztés", "felfüggesztésre", "visszavonás", "újranyit",
  "benyújtás", "módosult", "felhívás", "keretösszeg", "határidő", "hatályba"
];

async function readJson(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** HTML -> nyers szöveg. Csak tag-stripping, nincs HTML parser dependency. */
function stripHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");

  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

  return text;
}

/**
 * Nyilvánvalóan dinamikus, tartalmilag lényegtelen részek levágása:
 * generálási/frissítési időbélyegek, session/csrf/analytics tokenek,
 * sütibanner-mondatok, copyright év. Enélkül gyakorlatilag minden futás
 * "változást" jelezne, mert pl. a lábléc éve vagy egy session id mindig más.
 */
function stripDynamicParts(text) {
  return text
    // teljes dátum+idő bélyegek (pl. "2026-09-02T10:41:23Z" generálási időpontok)
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\b/g, " ")
    .replace(/\b\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\.?\s+\d{1,2}:\d{2}(:\d{2})?\b/g, " ")
    // "Frissítve / Generálva / Letöltve: ..." jellegű sorok
    .replace(/\b(oldal\s+)?(utoljára\s+)?(generálva|frissítve|letöltve|frissítés\s+dátuma|lekérdezve)\s*:?\s*[^\n<]{0,60}/gi, " ")
    // session / csrf / analytics tokenek és query paraméterek
    .replace(/\b(PHPSESSID|JSESSIONID|ASP\.NET_SessionId|sessionid|csrf(token)?|nonce|_ga|_gid|_gat|utm_[a-z]+|fbclid|gclid)=[^&\s"'<>]+/gi, " ")
    // hosszú hex-szerű tokenek (session id, build hash, stb.)
    .replace(/\b[a-f0-9]{32,}\b/gi, " ")
    // sütibanner / GDPR-mondatok teljes egészében
    .replace(/[^.!?]*\b(sütiket?|cookie-?(k|kat|kkal)?|gdpr|adatkezelési\s+tájékoztató)\b[^.!?]*[.!?]/gi, " ")
    // copyright év
    .replace(/©\s*\d{4}[^\n<]{0,40}/g, " ")
    // whitespace normalizálás
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function findKeywords(text) {
  const lower = text.toLowerCase();
  return KEYWORDS.filter((kw) => lower.includes(kw));
}

/** Egyszerű szó-szintű diff: mely szavak jelentek meg újonnan az előző mintához képest. */
function diffAddedText(oldText, newText) {
  if (!oldText) return newText;
  const oldWords = new Set(oldText.split(" "));
  return newText.split(" ").filter((w) => w && !oldWords.has(w)).join(" ");
}

async function checkSource(source, prevState) {
  const result = {
    id: source.id,
    name: source.name,
    url: source.url,
    status: "ok",
    changed: false,
    keywordHit: false,
    matchedKeywords: [],
    error: null,
    consecutiveFailures: (prevState && prevState.consecutiveFailures) || 0,
    checkedAt: new Date().toISOString()
  };

  let res;
  try {
    res = await fetchWithTimeout(source.url, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "hu,en;q=0.5" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    result.status = "error";
    result.error = err && err.message ? err.message : String(err);
    result.consecutiveFailures += 1;
    return result;
  }

  let html;
  try {
    html = await res.text();
  } catch (err) {
    result.status = "error";
    result.error = "Válasz olvasási hiba: " + (err && err.message ? err.message : String(err));
    result.consecutiveFailures += 1;
    return result;
  }

  const text = stripDynamicParts(stripHtml(html));
  const hash = sha256(text);
  result.consecutiveFailures = 0;

  const prevHash = prevState && prevState.hash;
  if (prevHash && prevHash !== hash) {
    result.changed = true;
    const addedText = diffAddedText((prevState && prevState.textSample) || "", text);
    const hits = findKeywords(addedText || text);
    result.keywordHit = hits.length > 0;
    result.matchedKeywords = hits;
  }
  // Ha nincs prevHash (első futás ennél a forrásnál), nincs mihez viszonyítani —
  // ilyenkor nem jelzünk "változást", csak elmentjük a kiinduló állapotot.

  result._hash = hash;
  result._textSample = text.slice(0, TEXT_SAMPLE_LIMIT);
  return result;
}

async function main() {
  const sources = await readJson(SOURCES_PATH, []);
  const state = await readJson(STATE_PATH, { sources: {} });
  if (!state.sources) state.sources = {};

  const results = [];

  // Forrásonként egy kérés, futásonként, szekvenciálisan — nincs párhuzamos hajtás.
  for (const source of sources) {
    const prev = state.sources[source.id];
    const result = await checkSource(source, prev);
    results.push(result);

    if (result.status === "ok") {
      state.sources[source.id] = {
        hash: result._hash,
        textSample: result._textSample,
        lastChecked: result.checkedAt,
        lastChanged: result.changed ? result.checkedAt : ((prev && prev.lastChanged) || null),
        consecutiveFailures: 0,
        lastError: null
      };
    } else {
      // hiba esetén megőrizzük az utolsó ismert jó állapotot, csak a hibaszámlálót növeljük
      state.sources[source.id] = {
        hash: prev && prev.hash,
        textSample: prev && prev.textSample,
        lastChecked: result.checkedAt,
        lastChanged: prev && prev.lastChanged,
        consecutiveFailures: result.consecutiveFailures,
        lastError: result.error
      };
    }
  }

  const staleAlerts = results.filter((r) => r.consecutiveFailures >= FAILURE_ALERT_THRESHOLD);

  const changesOutput = {
    runAt: new Date().toISOString(),
    results: results.map((r) => ({
      id: r.id,
      name: r.name,
      url: r.url,
      status: r.status,
      changed: r.changed,
      keywordHit: r.keywordHit,
      matchedKeywords: r.matchedKeywords,
      error: r.error,
      consecutiveFailures: r.consecutiveFailures,
      checkedAt: r.checkedAt
    })),
    summary: {
      total: results.length,
      changedCount: results.filter((r) => r.changed).length,
      keywordHitCount: results.filter((r) => r.keywordHit).length,
      errorCount: results.filter((r) => r.status === "error").length,
      staleCount: staleAlerts.length
    },
    staleAlerts: staleAlerts.map((r) => ({
      id: r.id, name: r.name, url: r.url, consecutiveFailures: r.consecutiveFailures
    }))
  };
  // A GitHub Action ez alapján dönti el, hogy commitol-e: ha semmi nem változott és
  // minden forrás elérhető volt, nincs mit commitolni — elkerülve az üres/zajos commitokat.
  changesOutput.shouldCommit = changesOutput.summary.changedCount > 0 || changesOutput.summary.errorCount > 0;

  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
  await writeFile(CHANGES_PATH, JSON.stringify(changesOutput, null, 2) + "\n", "utf8");

  console.log(
    `[watch] ${results.length} forrás ellenőrizve. ` +
    `Változás: ${changesOutput.summary.changedCount}, ` +
    `kulcsszavas találat: ${changesOutput.summary.keywordHitCount}, ` +
    `hiba: ${changesOutput.summary.errorCount}.`
  );
  if (staleAlerts.length) {
    console.log(
      `[watch] FIGYELEM: ${staleAlerts.length} forrás ${FAILURE_ALERT_THRESHOLD}+ egymást ` +
      `követő alkalommal nem volt elérhető — valószínűleg megszűnt vagy átköltözött oldal.`
    );
  }
}

main().catch((err) => {
  console.error("[watch] Váratlan hiba:", err);
  process.exitCode = 1;
});
