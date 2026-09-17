#!/usr/bin/env node
/**
 * Pályázatfigyelő – hírfigyelő szkript (2. kör: RSS/Atom + hash-alapú oldalfigyelés).
 *
 * Két figyelési módot ismer (data/sources.json "method" mezője dönti el):
 *  - "page": a korábbi hash-alapú oldalfigyelés — letölti az oldal szövegét,
 *    a dinamikus részek levágása után SHA-256 hash-t számol, összeveti az
 *    előző futással.
 *  - "rss":  letölti és feldolgozza az RSS 2.0 / Atom feedet (saját, függőség
 *    nélküli parser — nincs xml2js/rss-parser csomag), és minden még nem
 *    ismert elemet (sha256(link) alapján azonosítva) új hírként kezel.
 *
 * Relevancia-szűrés: ha egy forrás (sources.json) egynél több programhoz
 * tartozik ("programs" tömb hossza > 1 — pl. Magyar Közlöny, Portfolio),
 * egy elem csak akkor kerül be, ha a címében/leírásában szerepel valamelyik
 * program aliasa (data/programs.json "aliases") vagy egy általános kulcsszó.
 * Ha egy forrás pontosan egy programhoz van rendelve (pl. Magyar Államkincstár
 * → vidéki otthonfelújítás), a teljes forrás relevánsnak számít, nincs
 * szükség kulcsszavas szűrésre.
 *
 * Kimenetek:
 *  - data/state.json    – futások közötti "memória" (hash / etag / stb.)
 *  - data/changes.json  – az adott futás összefoglalója (a régi mezőkkel is,
 *    hogy a jelenlegi UI a felületi újratervezésig ne törjön el)
 *  - data/news.json     – egységesített, kronologikus hírlista (RSS-elemek +
 *    hivatalos oldalváltozások), forrás-tier és találat-jelöléssel
 *
 * Node 20+, natív fetch, nulla külső függőség. Forrásonként egy kérés fut,
 * futásonként, szekvenciálisan (nincs párhuzamos hajtás) — udvarias maradunk.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCES_PATH = path.join(ROOT, "data", "sources.json");
const PROGRAMS_PATH = path.join(ROOT, "data", "programs.json");
const STATE_PATH = path.join(ROOT, "data", "state.json");
const CHANGES_PATH = path.join(ROOT, "data", "changes.json");
const NEWS_PATH = path.join(ROOT, "data", "news.json");

const REPO_URL = process.env.PF_REPO_URL || "https://github.com/milan990920/palyazatfigyelo";
const USER_AGENT = `palyazatfigyelo-bot/1.0 (+${REPO_URL})`;
const FETCH_TIMEOUT_MS = 10000;
const FAILURE_ALERT_THRESHOLD = 3;
const TEXT_SAMPLE_LIMIT = 4000; // ennyi karaktert őrzünk meg futások közötti diffeléshez
const NEWS_MAX_AGE_DAYS = 120;
const NEWS_MAX_ITEMS = 300;

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
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

/* ============================================================
   Szöveg-segédfüggvények (HTML strip, entitás-dekódolás, ékezet-
   független normalizálás a kulcsszó-kereséshez)
   ============================================================ */

function decodeEntities(text) {
  return text
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 10)); } catch { return ""; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; }
    })
    .replace(/&amp;/gi, "&");
}

function stripHtml(html) {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text);
}

/**
 * Nyilvánvalóan dinamikus, tartalmilag lényegtelen részek levágása:
 * generálási/frissítési időbélyegek, session/csrf/analytics tokenek,
 * sütibanner-mondatok, copyright év. Enélkül gyakorlatilag minden futás
 * "változást" jelezne, mert pl. a lábléc éve vagy egy session id mindig más.
 */
function stripDynamicParts(text) {
  return text
    .replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?\b/g, " ")
    .replace(/\b\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\.?\s+\d{1,2}:\d{2}(:\d{2})?\b/g, " ")
    .replace(/\b(oldal\s+)?(utoljára\s+)?(generálva|frissítve|letöltve|frissítés\s+dátuma|lekérdezve)\s*:?\s*[^\n<]{0,60}/gi, " ")
    .replace(/\b(PHPSESSID|JSESSIONID|ASP\.NET_SessionId|sessionid|csrf(token)?|nonce|_ga|_gid|_gat|utm_[a-z]+|fbclid|gclid)=[^&\s"'<>]+/gi, " ")
    .replace(/\b[a-f0-9]{32,}\b/gi, " ")
    .replace(/[^.!?]*\b(sütiket?|cookie-?(k|kat|kkal)?|gdpr|adatkezelési\s+tájékoztató)\b[^.!?]*[.!?]/gi, " ")
    .replace(/©\s*\d{4}[^\n<]{0,40}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Ékezet- és kis/nagybetű-független normalizálás kulcsszókereséshez. */
function normalizeForMatch(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function findGeneralKeywords(text) {
  const norm = normalizeForMatch(text);
  return KEYWORDS.filter((kw) => norm.includes(normalizeForMatch(kw)));
}

/** Egyszerű szó-szintű diff: mely szavak jelentek meg újonnan az előző mintához képest. */
function diffAddedText(oldText, newText) {
  if (!oldText) return newText;
  const oldWords = new Set(oldText.split(" "));
  return newText.split(" ").filter((w) => w && !oldWords.has(w)).join(" ");
}

/* ============================================================
   Program-alias index + relevancia-számítás
   ============================================================ */

function buildAliasIndex(programs) {
  return programs.map((p) => ({
    id: p.id,
    terms: [...(p.aliases || []), p.shortName, p.name]
      .filter(Boolean)
      .map(normalizeForMatch)
      .filter((t) => t.length >= 3)
  }));
}

function matchProgramAliases(text, aliasIndex, allowedProgramIds) {
  const norm = normalizeForMatch(text);
  const allowed = new Set(allowedProgramIds || []);
  const matchedPrograms = new Set();
  const matchedTerms = new Set();
  for (const entry of aliasIndex) {
    if (allowed.size && !allowed.has(entry.id)) continue;
    for (const term of entry.terms) {
      if (norm.includes(term)) {
        matchedPrograms.add(entry.id);
        matchedTerms.add(term);
      }
    }
  }
  return { programs: [...matchedPrograms], terms: [...matchedTerms] };
}

/**
 * Egy forrás (vagy egy oldalváltozás/hír-elem) relevanciáját dönti el.
 * Ha a forrás pontosan egy programhoz tartozik, a teljes forrás eleve
 * releváns annak a programnak — nincs szükség kulcsszavas szűrésre. Ha
 * több programhoz (vagy egyáltalán nem konkrét programhoz) tartozik,
 * csak akkor releváns egy elem, ha alias- vagy általános kulcsszó-találat
 * van benne.
 */
function computeRelevance(text, source, aliasIndex) {
  const programs = source.programs || [];
  if (programs.length === 1) {
    return { relevant: true, programs: [programs[0]], matched: [] };
  }
  const aliasHit = matchProgramAliases(text, aliasIndex, programs);
  const generalHit = findGeneralKeywords(text);
  const relevant = aliasHit.programs.length > 0 || generalHit.length > 0;
  return { relevant, programs: aliasHit.programs, matched: [...aliasHit.terms, ...generalHit] };
}

/* ============================================================
   RSS 2.0 / Atom parser — függőség nélkül, reziliensen (egy hibás
   elem nem dönti el az egész feed feldolgozását)
   ============================================================ */

function stripCdata(s) {
  const m = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(s);
  return m ? m[1] : s;
}

function getTagContent(xml, tagName) {
  const re = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const m = re.exec(xml);
  if (!m) return null;
  return decodeEntities(stripCdata(m[1]).trim()).trim();
}

function getLink(itemXml) {
  const rssLink = getTagContent(itemXml, "link");
  if (rssLink && /^https?:\/\//i.test(rssLink.trim())) return rssLink.trim();
  const atomLinkRe = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i;
  const m = atomLinkRe.exec(itemXml);
  if (m) return m[1];
  return rssLink ? rssLink.trim() : null;
}

function getPubDate(itemXml) {
  for (const tag of ["pubDate", "dc:date", "published", "updated", "date"]) {
    const v = getTagContent(itemXml, tag);
    if (v) {
      const d = new Date(v);
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

function getDescription(itemXml) {
  for (const tag of ["content:encoded", "description", "summary", "content"]) {
    const v = getTagContent(itemXml, tag);
    if (v) return stripHtml(v).replace(/\s+/g, " ").trim().slice(0, 500);
  }
  return "";
}

/** Visszaadja a feed elemeit {title, link, pubDate, description} formában. Sosem dob — hiba esetén üres tömböt ad, a hívó logolja. */
function parseFeedItems(xml) {
  const items = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  let foundRss = false;
  while ((m = itemRe.exec(xml))) {
    foundRss = true;
    try {
      const block = m[1];
      const link = getLink(block);
      if (!link) continue;
      items.push({
        title: getTagContent(block, "title") || "",
        link,
        pubDate: getPubDate(block),
        description: getDescription(block)
      });
    } catch {
      // egy hibás <item> nem dönti el a többit
    }
  }
  if (!foundRss) {
    const entryRe = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
    while ((m = entryRe.exec(xml))) {
      try {
        const block = m[1];
        const link = getLink(block);
        if (!link) continue;
        items.push({
          title: getTagContent(block, "title") || "",
          link,
          pubDate: getPubDate(block),
          description: getDescription(block)
        });
      } catch {
        // egy hibás <entry> nem dönti el a többit
      }
    }
  }
  return items;
}

/* ============================================================
   Forrás-ellenőrzés: "page" (hash) mód
   ============================================================ */

async function checkPageSource(source, prevState, aliasIndex) {
  const result = {
    id: source.id, name: source.name, tier: source.tier, method: "page",
    url: source.watchUrl, status: "ok", changed: false, keywordHit: false,
    matchedKeywords: [], newItemCount: 0, error: null,
    consecutiveFailures: (prevState && prevState.consecutiveFailures) || 0,
    checkedAt: new Date().toISOString()
  };

  let res;
  try {
    res = await fetchWithTimeout(source.watchUrl, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "hu,en;q=0.5" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    result.status = "error";
    const causeMsg = err && err.cause ? ` (indoka: ${err.cause.code || err.cause.message || err.cause})` : "";
    result.error = (err && err.message ? err.message : String(err)) + causeMsg;
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
    const relevance = computeRelevance(addedText || text, source, aliasIndex);
    result.keywordHit = relevance.relevant;
    result.matchedKeywords = relevance.matched;
    result._pageChangeRelevance = relevance;
  }
  // Ha nincs prevHash (első futás ennél a forrásnál), nincs mihez viszonyítani —
  // ilyenkor nem jelzünk "változást", csak elmentjük a kiinduló állapotot.

  result._hash = hash;
  result._textSample = text.slice(0, TEXT_SAMPLE_LIMIT);
  return result;
}

/* ============================================================
   Forrás-ellenőrzés: "rss" mód
   ============================================================ */

async function checkRssSource(source, prevState, aliasIndex) {
  const result = {
    id: source.id, name: source.name, tier: source.tier, method: "rss",
    url: source.watchUrl || source.feedUrl, status: "ok", changed: false,
    keywordHit: false, matchedKeywords: [], newItemCount: 0, error: null,
    consecutiveFailures: (prevState && prevState.consecutiveFailures) || 0,
    checkedAt: new Date().toISOString(),
    _newsItems: [] // ideiglenes, a hívó dolgozza fel — nem kerül a végleges changes.json-ba
  };

  const headers = { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" };
  if (prevState && prevState.etag) headers["If-None-Match"] = prevState.etag;
  if (prevState && prevState.lastModified) headers["If-Modified-Since"] = prevState.lastModified;

  let res;
  try {
    res = await fetchWithTimeout(source.feedUrl, { headers });
  } catch (err) {
    result.status = "error";
    const causeMsg = err && err.cause ? ` (indoka: ${err.cause.code || err.cause.message || err.cause})` : "";
    result.error = (err && err.message ? err.message : String(err)) + causeMsg;
    result.consecutiveFailures += 1;
    return result;
  }

  if (res.status === 304) {
    result.consecutiveFailures = 0;
    result._etag = (prevState && prevState.etag) || null;
    result._lastModified = (prevState && prevState.lastModified) || null;
    return result;
  }

  if (!res.ok) {
    result.status = "error";
    result.error = `HTTP ${res.status}`;
    result.consecutiveFailures += 1;
    return result;
  }

  let xml;
  try {
    xml = await res.text();
  } catch (err) {
    result.status = "error";
    result.error = "Válasz olvasási hiba: " + (err && err.message ? err.message : String(err));
    result.consecutiveFailures += 1;
    return result;
  }

  result.consecutiveFailures = 0;
  result._etag = res.headers.get("etag") || null;
  result._lastModified = res.headers.get("last-modified") || null;

  let items = [];
  try {
    items = parseFeedItems(xml);
  } catch (err) {
    // Az egész feed hibás/nem parse-olható — logoljuk, de nem dobjuk el a futást.
    result.status = "error";
    result.error = "Feed feldolgozási hiba: " + (err && err.message ? err.message : String(err));
    return result;
  }

  const isFirstRunForSource = !prevState || (!prevState.hash && !prevState.etag && !prevState.lastModified && !prevState.seeded);
  const anyRelevant = { value: false };
  const matchedAll = new Set();

  for (const item of items) {
    const relevance = computeRelevance(`${item.title} ${item.description}`, source, aliasIndex);
    if (!relevance.relevant) continue;
    relevance.matched.forEach((t) => matchedAll.add(t));
    result._newsItems.push({
      item, relevance,
      isFirstRunForSource
    });
    if (!isFirstRunForSource) anyRelevant.value = true;
  }

  result.changed = anyRelevant.value;
  result.keywordHit = anyRelevant.value;
  result.matchedKeywords = [...matchedAll];
  result.newItemCount = isFirstRunForSource ? 0 : result._newsItems.length;
  result._isFirstRunForSource = isFirstRunForSource;

  return result;
}

/* ============================================================
   Fő futás
   ============================================================ */

async function main() {
  const now = new Date().toISOString();
  const sources = await readJson(SOURCES_PATH, []);
  const programs = await readJson(PROGRAMS_PATH, []);
  const state = await readJson(STATE_PATH, { sources: {} });
  if (!state.sources) state.sources = {};
  const priorNews = await readJson(NEWS_PATH, []);
  const aliasIndex = buildAliasIndex(programs);

  const newsById = new Map(priorNews.map((n) => [n.id, n]));
  const seenTitleKeys = new Set(priorNews.map((n) => normalizeForMatch(n.title)));

  const results = [];
  const runNewsItems = []; // ebben a futásban ténylegesen új, releváns elemek (értesítéshez)

  for (const source of sources) {
    if (source.enabled === false) {
      results.push({
        id: source.id, name: source.name, tier: source.tier, method: source.method,
        url: source.watchUrl || source.feedUrl, status: "disabled", changed: false,
        keywordHit: false, matchedKeywords: [], newItemCount: 0, error: null,
        consecutiveFailures: 0, checkedAt: now
      });
      continue;
    }

    const prev = state.sources[source.id];
    const result = source.method === "rss"
      ? await checkRssSource(source, prev, aliasIndex)
      : await checkPageSource(source, prev, aliasIndex);

    // Hivatalos oldalváltozás → news.json bejegyzés ("page-change")
    if (source.method === "page" && result.status === "ok" && result.changed && result._pageChangeRelevance && result._pageChangeRelevance.relevant) {
      const link = source.watchUrl;
      const id = sha256(link + "|" + result.checkedAt);
      const titleKey = normalizeForMatch(`${source.name} tartalma módosult`);
      if (!seenTitleKeys.has(titleKey + result.checkedAt)) {
        const entry = {
          id, sourceId: source.id, sourceName: source.name, tier: source.tier,
          title: `${source.name}: tartalom módosult`,
          url: link,
          publishedAt: result.checkedAt,
          fetchedAt: now,
          programs: result._pageChangeRelevance.programs,
          matched: result._pageChangeRelevance.matched,
          kind: "page-change"
        };
        newsById.set(id, entry);
        runNewsItems.push(entry);
      }
    }

    // RSS elemek → news.json bejegyzések
    if (source.method === "rss" && Array.isArray(result._newsItems)) {
      for (const { item, relevance, isFirstRunForSource } of result._newsItems) {
        const id = sha256(item.link);
        if (newsById.has(id)) continue;
        const titleKey = normalizeForMatch(item.title || item.link);
        if (titleKey && seenTitleKeys.has(titleKey)) continue;
        const entry = {
          id, sourceId: source.id, sourceName: source.name, tier: source.tier,
          title: item.title || source.name,
          url: item.link,
          publishedAt: item.pubDate || now,
          fetchedAt: now,
          programs: relevance.programs,
          matched: relevance.matched,
          kind: "news"
        };
        newsById.set(id, entry);
        if (titleKey) seenTitleKeys.add(titleKey);
        if (!isFirstRunForSource) runNewsItems.push(entry);
      }
    }

    // Belső mezők eltávolítása a changes.json-ból (csak a feldolgozáshoz kellettek)
    delete result._newsItems;
    delete result._pageChangeRelevance;
    delete result._isFirstRunForSource;
    const hash = result._hash; delete result._hash;
    const textSample = result._textSample; delete result._textSample;
    const etag = result._etag; delete result._etag;
    const lastModified = result._lastModified; delete result._lastModified;

    results.push(result);

    if (result.status === "ok") {
      state.sources[source.id] = {
        hash: hash !== undefined ? hash : (prev && prev.hash),
        textSample: textSample !== undefined ? textSample : (prev && prev.textSample),
        etag: etag !== undefined ? etag : (prev && prev.etag),
        lastModified: lastModified !== undefined ? lastModified : (prev && prev.lastModified),
        seeded: true,
        lastChecked: result.checkedAt,
        lastSuccess: result.checkedAt,
        lastChanged: result.changed ? result.checkedAt : ((prev && prev.lastChanged) || null),
        consecutiveFailures: 0,
        lastError: null
      };
    } else if (result.status === "disabled") {
      // nem érintjük az állapotát
      if (prev) state.sources[source.id] = prev;
    } else {
      state.sources[source.id] = {
        hash: prev && prev.hash,
        textSample: prev && prev.textSample,
        etag: prev && prev.etag,
        lastModified: prev && prev.lastModified,
        seeded: prev && prev.seeded,
        lastChecked: result.checkedAt,
        lastSuccess: prev && prev.lastSuccess,
        lastChanged: prev && prev.lastChanged,
        consecutiveFailures: result.consecutiveFailures,
        lastError: result.error
      };
    }
  }

  // --- news.json: pruning + rendezés + limit ---
  const maxAgeMs = NEWS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  let allNews = [...newsById.values()].filter((n) => {
    const t = Date.parse(n.publishedAt || n.fetchedAt);
    return isNaN(t) || t >= cutoff;
  });
  allNews.sort((a, b) => {
    const ta = Date.parse(a.publishedAt || a.fetchedAt) || 0;
    const tb = Date.parse(b.publishedAt || b.fetchedAt) || 0;
    return tb - ta;
  });
  if (allNews.length > NEWS_MAX_ITEMS) allNews = allNews.slice(0, NEWS_MAX_ITEMS);

  // --- changes.json ---
  const staleAlerts = results.filter((r) => r.consecutiveFailures >= FAILURE_ALERT_THRESHOLD);
  const activeResults = results.filter((r) => r.status !== "disabled");

  const changesOutput = {
    runAt: now,
    results,
    summary: {
      total: activeResults.length,
      changedCount: activeResults.filter((r) => r.changed).length,
      keywordHitCount: activeResults.filter((r) => r.keywordHit).length,
      errorCount: activeResults.filter((r) => r.status === "error").length,
      staleCount: staleAlerts.length,
      newsItemCount: runNewsItems.length
    },
    staleAlerts: staleAlerts.map((r) => ({
      id: r.id, name: r.name, url: r.url, tier: r.tier, consecutiveFailures: r.consecutiveFailures
    })),
    newsByTier: {
      official: runNewsItems.filter((n) => n.tier === "official").length,
      press: runNewsItems.filter((n) => n.tier === "press").length,
      aggregator: runNewsItems.filter((n) => n.tier === "aggregator").length
    }
  };
  // A GitHub Action ez alapján dönti el, hogy commitol-e: ha semmi nem változott,
  // minden forrás elérhető volt és nincs új hír, nincs mit commitolni.
  changesOutput.shouldCommit =
    changesOutput.summary.changedCount > 0 ||
    changesOutput.summary.errorCount > 0 ||
    changesOutput.summary.newsItemCount > 0;

  await mkdir(path.dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
  await writeFile(CHANGES_PATH, JSON.stringify(changesOutput, null, 2) + "\n", "utf8");
  await writeFile(NEWS_PATH, JSON.stringify(allNews, null, 2) + "\n", "utf8");

  console.log(
    `[watch] ${activeResults.length} forrás ellenőrizve (+${results.length - activeResults.length} kikapcsolva). ` +
    `Változás: ${changesOutput.summary.changedCount}, ` +
    `releváns találat: ${changesOutput.summary.keywordHitCount}, ` +
    `új hír: ${changesOutput.summary.newsItemCount}, ` +
    `hiba: ${changesOutput.summary.errorCount}.`
  );
  if (staleAlerts.length) {
    console.log(
      `[watch] FIGYELEM: ${staleAlerts.length} forrás ${FAILURE_ALERT_THRESHOLD}+ egymást ` +
      `követő alkalommal nem volt elérhető — valószínűleg megszűnt vagy átköltözött oldal.`
    );
  }
}

// Csak teszteléshez (scripts/test-watch-parsing.mjs) — a közvetlen futtatást nem érinti.
export { parseFeedItems, computeRelevance, buildAliasIndex, normalizeForMatch, stripHtml, decodeEntities };

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error("[watch] Váratlan hiba:", err);
    process.exitCode = 1;
  });
}
