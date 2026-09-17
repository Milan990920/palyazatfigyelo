#!/usr/bin/env node
/**
 * Telegram-értesítés a data/changes.json + data/news.json alapján,
 * forrás-rétegenként (tier) eltérő szabállyal:
 *
 *  - "official" (hivatalos): minden releváns változás azonnal, külön
 *    üzenetben (forrás neve, érintett program, talált kulcsszavak, link) —
 *    a kulcsszavas találat kiemelt figyelmeztető sorral indul.
 *  - "press" (sajtó): sosem egyesével — egyetlen összefoglaló ("digest")
 *    üzenetben, futásonként legfeljebb egyszer.
 *  - "aggregator": SOSEM küld értesítést, csak a hírfolyamban (news.json)
 *    jelenik meg.
 *
 * Minden üzenet kiírja a forrás tier-jét ("Hivatalos"/"Sajtó"), ahogy a
 * 2. körös spec kéri.
 *
 * Külön, egyszeri (nem ismétlődő) üzenet megy, ha egy forrás 3+ egymást
 * követő alkalommal elérhetetlen — ezt a data/state.json-ban tárolt
 * "staleAlertSent" jelzővel követjük, hogy ne küldjön ugyanarról minden
 * futásnál újra üzenetet, amíg a forrás nem áll helyre.
 *
 * Ha TELEGRAM_BOT_TOKEN vagy TELEGRAM_CHAT_ID nincs beállítva, a szkript
 * szó szerint semmit nem küld, de sikeresen (hibakód nélkül) lefut.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CHANGES_PATH = path.join(ROOT, "data", "changes.json");
const NEWS_PATH = path.join(ROOT, "data", "news.json");
const STATE_PATH = path.join(ROOT, "data", "state.json");
const PROGRAMS_PATH = path.join(ROOT, "data", "programs.json");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TIER_LABELS = { official: "Hivatalos", press: "Sajtó", aggregator: "Aggregátor" };

function fmt(iso) {
  try {
    return new Date(iso).toLocaleString("hu-HU", {
      timeZone: "Europe/Budapest",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    }) + " (magyar idő)";
  } catch {
    return iso;
  }
}

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: false })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram API hiba: HTTP ${res.status} ${body}`);
  }
}

function programNames(ids, programsById) {
  if (!ids || !ids.length) return "—";
  return ids.map((id) => (programsById.get(id) ? programsById.get(id).shortName || programsById.get(id).name : id)).join(", ");
}

async function main() {
  const changes = await readJson(CHANGES_PATH, null);
  if (!changes) {
    console.log("[notify] Nincs data/changes.json — nincs mit küldeni.");
    return;
  }
  const news = await readJson(NEWS_PATH, []);
  const programs = await readJson(PROGRAMS_PATH, []);
  const state = await readJson(STATE_PATH, { sources: {} });
  const programsById = new Map(programs.map((p) => [p.id, p]));

  const when = fmt(changes.runAt);
  const newThisRun = news.filter((n) => n.fetchedAt === changes.runAt);
  const officialItems = newThisRun.filter((n) => n.tier === "official");
  const pressItems = newThisRun.filter((n) => n.tier === "press");
  // aggregator: szándékosan figyelmen kívül hagyva — sosem értesít

  const staleAlerts = (changes.staleAlerts || []).filter((r) => {
    const s = state.sources && state.sources[r.id];
    return !(s && s.staleAlertSent);
  });

  if (!TOKEN || !CHAT_ID) {
    console.log(
      `[notify] TELEGRAM_BOT_TOKEN és/vagy TELEGRAM_CHAT_ID nincs beállítva — Telegram-értesítés kihagyva ` +
      `(lett volna: ${officialItems.length} hivatalos, ${pressItems.length} sajtó, ${staleAlerts.length} elérhetetlenségi jelzés).`
    );
    return;
  }

  const messages = [];

  // --- Hivatalos változások: egyesével, azonnal ---
  for (const item of officialItems) {
    const lines = [];
    const hasKeywords = item.matched && item.matched.length > 0;
    lines.push(hasKeywords ? "⚠️ <b>Hivatalos forrás – kulcsszavas változás</b>" : "🔔 <b>Hivatalos forrás módosult</b>");
    lines.push(`Forrás: <b>${esc(item.sourceName)}</b> (${TIER_LABELS.official})`);
    lines.push(`Érintett program(ok): ${esc(programNames(item.programs, programsById))}`);
    if (hasKeywords) lines.push(`Talált kulcsszavak: <b>${esc(item.matched.join(", "))}</b>`);
    if (item.kind === "news" && item.title) lines.push(esc(item.title));
    lines.push(`🔗 ${esc(item.url)}`);
    lines.push(`Ellenőrzés: ${esc(when)}`);
    messages.push(lines.join("\n"));
  }

  // --- Sajtó: egyetlen összefoglaló üzenet ---
  if (pressItems.length) {
    const lines = [`ℹ️ <b>Sajtóhír – kulcsszó-találat</b> (${pressItems.length} db, ${TIER_LABELS.press})`, `Ellenőrzés: ${esc(when)}`, ""];
    pressItems.forEach((item) => {
      lines.push(`• <b>${esc(item.sourceName)}</b> — ${esc(item.title)}`);
      lines.push(`  Program: ${esc(programNames(item.programs, programsById))} · kulcsszavak: ${esc((item.matched || []).join(", "))}`);
      lines.push(`  🔗 ${esc(item.url)}`);
    });
    messages.push(lines.join("\n"));
  }

  // --- Elérhetetlen források (egyszeri jelzés) ---
  if (staleAlerts.length) {
    const lines = ["🔌 <b>Nem elérhető források</b> (3+ próbálkozás óta sikertelen — valószínűleg megszűnt/átköltözött oldal):", ""];
    staleAlerts.forEach((r) => {
      const tierLabel = TIER_LABELS[r.tier] || r.tier || "?";
      lines.push(`• ${esc(r.name)} (${tierLabel}) — ${r.consecutiveFailures}x sikertelen`);
      lines.push(`  ${esc(r.url)}`);
    });
    messages.push(lines.join("\n"));
  }

  for (const msg of messages) {
    await sendTelegram(msg);
  }

  // staleAlertSent jelzők frissítése, hogy ne ismétlődjön az üzenet minden futásnál
  if (staleAlerts.length) {
    if (!state.sources) state.sources = {};
    for (const r of staleAlerts) {
      if (!state.sources[r.id]) state.sources[r.id] = {};
      state.sources[r.id].staleAlertSent = true;
    }
    await writeFile(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
  }

  console.log(
    `[notify] ${messages.length} Telegram üzenet elküldve ` +
    `(${officialItems.length} hivatalos, ${pressItems.length ? 1 : 0} sajtó-összefoglaló, ${staleAlerts.length} elérhetetlenségi jelzés).`
  );
}

main().catch((err) => {
  console.error("[notify] Hiba az értesítés küldésekor:", err);
  process.exitCode = 1;
});
