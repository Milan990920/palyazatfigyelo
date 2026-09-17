#!/usr/bin/env node
/**
 * Forrás-audit: minden jelölt forrásra megnézi, hogy elérhető-e, van-e
 * RSS/Atom feedje, és mit mond a robots.txt.
 *
 * NEM tölti automatikusan a data/sources.json-t — csak feltárja a
 * tényeket egy Markdown táblázatban (docs/sources-audit.md), amiből
 * utána kézzel (vagy egy külön lépésben, az audit alapján) épül fel a
 * végleges forráslista. A cél: sose találjunk ki feed URL-t, mindig
 * mérjük le.
 *
 * Node 20+, natív fetch, nulla külső függőség.
 */

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_PATH = path.join(ROOT, "docs", "sources-audit.md");

const REPO_URL = process.env.PF_REPO_URL || "https://github.com/milan990920/palyazatfigyelo";
const USER_AGENT = `palyazatfigyelo-bot/1.0 (+${REPO_URL})`;
const FETCH_TIMEOUT_MS = 12000;

// Jelölt források — a felhasználó 2. körös kérésében megadott lista.
// tier: official | press | aggregator — csak audit-célra van itt jelölve,
// a tényleges sources.json ettől függetlenül, az audit eredménye alapján áll össze.
const CANDIDATES = [
  // --- Hivatalos ---
  { id: "magyar-kozlony", name: "Magyar Közlöny", tier: "official", url: "https://magyarkozlony.hu/" },
  { id: "njt", name: "Nemzeti Jogszabálytár", tier: "official", url: "https://njt.hu/" },
  { id: "palyazat-gov", name: "Pályázat.gov.hu", tier: "official", url: "https://www.palyazat.gov.hu/" },
  { id: "mfb-pontok-plusz", name: "MFB Pont Plusz", tier: "official", url: "https://www.mfb.hu/mfb-pontok-plusz" },
  { id: "neuzrt", name: "Nemzeti Energetikai Ügynökség (neuzrt.hu)", tier: "official", url: "https://neuzrt.hu/" },
  { id: "neuzrt-oetp", name: "NEÜ – Otthoni Energiatároló Program aloldal", tier: "official", url: "https://otthonienergiatarolo.neuzrt.hu/" },
  { id: "nffku", name: "NEÜ – régi domain (nffku.hu)", tier: "official", url: "https://nffku.hu/" },
  { id: "kormany-energiaugyi", name: "Kormany.hu – Energiaügyi Minisztérium hírei", tier: "official", url: "https://kormany.hu/energiaugyi-miniszterium/hirek" },
  { id: "allamkincstar", name: "Magyar Államkincstár", tier: "official", url: "https://www.allamkincstar.gov.hu/" },

  // --- Sajtó ---
  { id: "hirado", name: "Hirado.hu (MTI)", tier: "press", url: "https://hirado.hu/" },
  { id: "portfolio", name: "Portfolio", tier: "press", url: "https://www.portfolio.hu/" },
  { id: "vg", name: "Világgazdaság", tier: "press", url: "https://www.vg.hu/" },
  { id: "hvg", name: "HVG", tier: "press", url: "https://hvg.hu/" },
  { id: "telex", name: "Telex", tier: "press", url: "https://telex.hu/" },
  { id: "index", name: "Index", tier: "press", url: "https://index.hu/" },
  { id: "bankmonitor", name: "Bankmonitor", tier: "press", url: "https://bankmonitor.hu/" },
  { id: "penzcentrum", name: "Pénzcentrum", tier: "press", url: "https://www.penzcentrum.hu/" },
  { id: "google-news-search", name: "Google News RSS keresés (teszt lekérdezéssel)", tier: "press", url: "https://news.google.com/rss/search?q=%22Otthoni%20Energiat%C3%A1rol%C3%B3%20Program%22&hl=hu&gl=HU&ceid=HU:hu" },

  // --- Aggregátor ---
  { id: "palyazatmenedzser", name: "Palyazatmenedzser.hu", tier: "aggregator", url: "https://palyazatmenedzser.hu/" },
  { id: "palyaz", name: "Palyaz.hu", tier: "aggregator", url: "https://palyaz.hu/" },
  { id: "palyazatok-org", name: "Palyazatok.org", tier: "aggregator", url: "https://palyazatok.org/" },
  { id: "palyazatfigyelo-org", name: "Palyazatfigyelo.org", tier: "aggregator", url: "https://palyazatfigyelo.org/" }
];

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

/** RSS/Atom autodiscovery link + szokásos útvonalak keresése a HTML-ben. */
function findFeedCandidates(html, baseUrl) {
  const found = new Set();
  const linkRe = /<link\s+[^>]*rel=["']alternate["'][^>]*>/gi;
  let m;
  while ((m = linkRe.exec(html))) {
    const tag = m[0];
    const typeMatch = /type=["'](application\/(rss|atom)\+xml)["']/i.exec(tag);
    const hrefMatch = /href=["']([^"']+)["']/i.exec(tag);
    if (typeMatch && hrefMatch) {
      try {
        found.add(new URL(hrefMatch[1], baseUrl).toString());
      } catch {
        // hibás href, kihagyjuk
      }
    }
  }
  return [...found];
}

const COMMON_FEED_PATHS = ["/rss", "/rss.xml", "/feed", "/feed/", "/feeds/posts/default", "/rss/index.xml"];

async function checkFeed(url) {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
    if (!res.ok) return { url, ok: false, reason: `HTTP ${res.status}` };
    const text = await res.text();
    const looksXml = /^\s*<\?xml|<rss[\s>]|<feed[\s>]/i.test(text);
    if (!looksXml) return { url, ok: false, reason: "nem XML/RSS válasz" };
    const itemCount = (text.match(/<item[\s>]/gi) || []).length;
    const entryCount = (text.match(/<entry[\s>]/gi) || []).length;
    const count = itemCount + entryCount;
    if (count === 0) return { url, ok: false, reason: "XML, de nincs benne <item>/<entry>" };
    return { url, ok: true, itemCount: count };
  } catch (err) {
    return { url, ok: false, reason: err && err.message ? err.message : String(err) };
  }
}

async function checkRobots(origin) {
  try {
    const res = await fetchWithTimeout(new URL("/robots.txt", origin).toString(), {
      headers: { "User-Agent": USER_AGENT }
    });
    if (!res.ok) return { present: false, allowsRoot: true, note: `HTTP ${res.status} — nincs robots.txt, alapból engedélyezettnek vesszük` };
    const text = await res.text();
    // Egyszerű, konzervatív ellenőrzés: van-e "Disallow: /" egy minket is
    // érintő (User-agent: * vagy a mi UA-nk) szakaszban.
    const blocks = text.split(/\n(?=User-agent:)/i);
    let allows = true;
    for (const block of blocks) {
      const uaMatch = /User-agent:\s*(.+)/i.exec(block);
      if (!uaMatch) continue;
      const ua = uaMatch[1].trim();
      if (ua !== "*" && !/palyazatfigyelo/i.test(ua)) continue;
      if (/Disallow:\s*\/\s*$/im.test(block)) allows = false;
    }
    return { present: true, allowsRoot: allows, note: allows ? "engedélyezett" : "Disallow: / — tiltott" };
  } catch (err) {
    return { present: false, allowsRoot: true, note: "nem sikerült lekérni, alapból engedélyezettnek vesszük" };
  }
}

async function auditOne(candidate) {
  const result = {
    id: candidate.id, name: candidate.name, tier: candidate.tier, url: candidate.url,
    httpStatus: null, finalUrl: null, feed: null, robots: null, error: null
  };
  let res;
  try {
    res = await fetchWithTimeout(candidate.url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" } });
    result.httpStatus = res.status;
    result.finalUrl = res.url;
  } catch (err) {
    result.error = err && err.message ? err.message : String(err);
    return result;
  }

  if (!res.ok) return result;

  let html = "";
  try {
    html = await res.text();
  } catch (err) {
    result.error = "válasz olvasási hiba: " + (err && err.message ? err.message : String(err));
    return result;
  }

  // Ha maga a candidate.url már feed (pl. Google News RSS keresés), ne
  // próbáljunk benne HTML-t keresni — validáljuk közvetlenül feedként.
  const looksLikeFeedAlready = /^\s*<\?xml|<rss[\s>]|<feed[\s>]/i.test(html);
  if (looksLikeFeedAlready) {
    const itemCount = (html.match(/<item[\s>]/gi) || []).length + (html.match(/<entry[\s>]/gi) || []).length;
    result.feed = itemCount > 0 ? { url: candidate.url, ok: true, itemCount } : { url: candidate.url, ok: false, reason: "XML, de üres" };
  } else {
    const discovered = findFeedCandidates(html, result.finalUrl);
    const origin = new URL(result.finalUrl).origin;
    const toTry = discovered.length > 0 ? discovered : COMMON_FEED_PATHS.map((p) => origin + p);

    for (const feedUrl of toTry) {
      const checked = await checkFeed(feedUrl);
      if (checked.ok) {
        result.feed = checked;
        break;
      }
      if (!result.feed) result.feed = checked; // az első (sikertelen) próbálkozást megőrizzük, ha semmi sem jön be
    }
  }

  try {
    result.robots = await checkRobots(new URL(result.finalUrl).origin);
  } catch {
    result.robots = { present: false, allowsRoot: true, note: "ellenőrzés sikertelen" };
  }

  return result;
}

function mdEscape(s) {
  return String(s == null ? "" : s).replace(/\|/g, "\\|");
}

async function main() {
  const results = [];
  // Forrásonként szekvenciálisan, egy kérés/forrás — udvarias maradunk.
  for (const c of CANDIDATES) {
    console.log(`[audit] ${c.id} (${c.url}) ...`);
    const r = await auditOne(c);
    results.push(r);
    const status = r.error ? `HIBA: ${r.error}` : `HTTP ${r.httpStatus}`;
    const feedInfo = r.feed ? (r.feed.ok ? `feed OK (${r.feed.itemCount} elem): ${r.feed.url}` : `nincs használható feed (${r.feed.reason})`) : "—";
    console.log(`  ${status} · ${feedInfo}`);
  }

  const byTier = { official: [], press: [], aggregator: [] };
  results.forEach((r) => byTier[r.tier].push(r));

  const lines = [];
  lines.push("# Forrás-audit");
  lines.push("");
  lines.push(`Generálva: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "Ez a fájl a `scripts/audit-sources.mjs` futásának eredménye. **A `data/sources.json`-t csak ez alapján szabad frissíteni** — sosem szabad feed URL-t kitalálni. Ha egy forrásnál nincs RSS, a `method` maradjon `\"page\"` (hash-alapú oldalfigyelés)."
  );
  lines.push("");

  for (const tier of ["official", "press", "aggregator"]) {
    const label = tier === "official" ? "Hivatalos" : tier === "press" ? "Sajtó" : "Aggregátor";
    lines.push(`## ${label}`);
    lines.push("");
    lines.push("| Forrás | HTTP | Végső URL | Talált feed | Robots | Javaslat |");
    lines.push("|---|---|---|---|---|---|");
    for (const r of byTier[tier]) {
      const httpCell = r.error ? `hiba: ${mdEscape(r.error)}` : String(r.httpStatus);
      const finalCell = r.finalUrl && r.finalUrl !== r.url ? mdEscape(r.finalUrl) : (r.finalUrl ? "*(változatlan)*" : "—");
      const feedCell = r.feed ? (r.feed.ok ? `✅ \`${mdEscape(r.feed.url)}\` (${r.feed.itemCount} elem)` : `❌ ${mdEscape(r.feed.reason)}`) : "—";
      const robotsCell = r.robots ? (r.robots.allowsRoot ? `✅ ${mdEscape(r.robots.note)}` : `⚠️ ${mdEscape(r.robots.note)}`) : "—";
      const suggestion = r.error || (r.httpStatus && r.httpStatus >= 400)
        ? "nem elérhető — hagyd ki vagy vizsgáld felül az URL-t"
        : r.feed && r.feed.ok
          ? `method: "rss", feedUrl: "${r.feed.url}"`
          : "method: \"page\" (nincs használható RSS)";
      lines.push(`| ${mdEscape(r.name)} (\`${r.id}\`) | ${httpCell} | ${finalCell} | ${feedCell} | ${robotsCell} | ${suggestion} |`);
    }
    lines.push("");
  }

  lines.push("## Nyers JSON (gépi feldolgozáshoz)");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(results, null, 2));
  lines.push("```");
  lines.push("");

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, lines.join("\n"), "utf8");
  console.log(`[audit] Kész — ${OUT_PATH}`);
}

main().catch((err) => {
  console.error("[audit] Váratlan hiba:", err);
  process.exitCode = 1;
});
