#!/usr/bin/env node
/**
 * Telegram-értesítés a data/changes.json alapján.
 *
 * Ha TELEGRAM_BOT_TOKEN vagy TELEGRAM_CHAT_ID nincs beállítva, a szkript
 * szó szerint semmit nem küld, de sikeresen (hibakód nélkül) lefut — így a
 * GitHub Action akkor is zöld marad, ha a titkok még nincsenek felvéve.
 *
 * Két üzenettípus:
 *  - "fontos" üzenet: kulcsszavas találatok + 3x egymás után elérhetetlen források
 *  - "halk" üzenet: kulcsszó nélküli, sima tartalmi változások, összegyűjtve
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANGES_PATH = path.join(__dirname, "..", "data", "changes.json");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: false
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Telegram API hiba: HTTP ${res.status} ${body}`);
  }
}

async function main() {
  if (!TOKEN || !CHAT_ID) {
    console.log("[notify] TELEGRAM_BOT_TOKEN és/vagy TELEGRAM_CHAT_ID nincs beállítva — Telegram-értesítés kihagyva.");
    return;
  }

  const raw = await readFile(CHANGES_PATH, "utf8");
  const changes = JSON.parse(raw);
  const when = fmt(changes.runAt);

  const keywordHits = changes.results.filter((r) => r.keywordHit);
  const quietChanges = changes.results.filter((r) => r.changed && !r.keywordHit);
  const staleAlerts = changes.staleAlerts || [];

  const messages = [];

  if (keywordHits.length || staleAlerts.length) {
    const lines = ["⚠️ <b>Pályázatfigyelő – fontos változás</b>", `Ellenőrzés: ${esc(when)}`, ""];
    keywordHits.forEach((r) => {
      lines.push(`• <b>${esc(r.name)}</b>`);
      lines.push(`  Kulcsszavak: ${esc(r.matchedKeywords.join(", "))}`);
      lines.push(`  ${esc(r.url)}`);
    });
    if (staleAlerts.length) {
      if (keywordHits.length) lines.push("");
      lines.push("🔌 <b>Nem elérhető források</b> (3+ próbálkozás óta sikertelen — valószínűleg megszűnt/átköltözött):");
      staleAlerts.forEach((r) => {
        lines.push(`• ${esc(r.name)} — ${r.consecutiveFailures}x sikertelen`);
        lines.push(`  ${esc(r.url)}`);
      });
    }
    messages.push(lines.join("\n"));
  }

  if (quietChanges.length) {
    const lines = ["ℹ️ Pályázatfigyelő – tartalmi változás (kulcsszó nélkül)", `Ellenőrzés: ${esc(when)}`, ""];
    quietChanges.forEach((r) => {
      lines.push(`• ${esc(r.name)} — ${esc(r.url)}`);
    });
    messages.push(lines.join("\n"));
  }

  for (const msg of messages) {
    await sendTelegram(msg);
  }
  console.log(`[notify] ${messages.length} Telegram üzenet elküldve.`);
}

main().catch((err) => {
  console.error("[notify] Hiba az értesítés küldésekor:", err);
  process.exitCode = 1;
});
