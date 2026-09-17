#!/usr/bin/env node
/**
 * Kézi ellenőrző szkript a watch.mjs RSS/Atom-parseréhez és relevancia-
 * szűréséhez, mintafeedeken (scripts/fixtures/) — akkor is futtatható, ha
 * az élő hálózat (a valódi hírforrások) nem érhetők el.
 *
 * Nem egy tesztfuttató keretrendszer (nincs npm dependency) — egyszerű
 * assert-alapú script, ami hibakóddal áll le, ha valami nem stimmel.
 *
 * Futtatás: node scripts/test-watch-parsing.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { parseFeedItems, computeRelevance, buildAliasIndex } from "./watch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures");

async function main() {
  const programs = JSON.parse(await readFile(path.join(__dirname, "..", "data", "programs.json"), "utf8"));
  const aliasIndex = buildAliasIndex(programs);

  // --- RSS feed parse ---
  const rssXml = await readFile(path.join(FIXTURES, "sample-rss.xml"), "utf8");
  const rssItems = parseFeedItems(rssXml);
  assert.equal(rssItems.length, 4, "4 elemet várunk az RSS mintafeedből");
  assert.equal(rssItems[0].title, "Módosult az Otthoni Energiatároló Program keretösszege", "CDATA cím helyes kinyerése");
  assert.equal(rssItems[0].link, "https://example.hu/hirek/oetp-keretosszeg-modosult");
  assert.equal(rssItems[0].pubDate, new Date("Wed, 17 Sep 2026 08:00:00 +0200").toISOString(), "pubDate ISO-vá alakítva");
  assert.ok(!rssItems[0].description.includes("<b>"), "HTML tag-eket a description-ből ki kell szedni");
  assert.equal(rssItems[3].pubDate, null, "érvénytelen dátum -> null, nem dob hibát");
  assert.ok(rssItems[3].link.includes("a=1&b=2"), "entitás-dekódolás (&amp; -> &) a linkben");
  console.log("[teszt] RSS parse OK (4/4 elem, CDATA, entitás, hibás dátum kezelve)");

  // --- Atom feed parse ---
  const atomXml = await readFile(path.join(FIXTURES, "sample-atom.xml"), "utf8");
  const atomItems = parseFeedItems(atomXml);
  assert.equal(atomItems.length, 2, "2 elemet várunk az Atom mintafeedből");
  assert.equal(atomItems[0].link, "https://example.hu/atom/otthon-start-feltetelek", "Atom <link href> kinyerése");
  console.log("[teszt] Atom parse OK (2/2 elem, href-alapú link kinyerés)");

  // --- Malformed/nem XML feed: nem dobhat kivételt, üres tömböt ad ---
  const malformed = await readFile(path.join(FIXTURES, "malformed.xml"), "utf8");
  const malformedItems = parseFeedItems(malformed);
  assert.ok(Array.isArray(malformedItems), "hibás feed esetén is tömböt ad vissza (nem dob)");
  console.log(`[teszt] Hibás/lezáratlan feed OK (nem dobott kivételt, ${malformedItems.length} elemet talált)`);

  // --- Relevancia-szűrés: broad forrás (több program) ---
  const broadSource = { programs: ["kehop-plusz", "energiatarolo", "videki-otthonfelujitas"] };
  const relOetp = computeRelevance(rssItems[0].title + " " + rssItems[0].description, broadSource, aliasIndex);
  assert.ok(relOetp.relevant, "az OETP-cím releváns kell legyen egy broad forrásnál");
  assert.ok(relOetp.programs.includes("energiatarolo"), "az energiatarolo programot kell találnia");

  const relIrrelevant = computeRelevance(rssItems[1].title + " " + rssItems[1].description, broadSource, aliasIndex);
  assert.ok(!relIrrelevant.relevant, "az irreleváns hír nem lehet releváns");

  const relKehop = computeRelevance(rssItems[2].title + " " + rssItems[2].description, broadSource, aliasIndex);
  assert.ok(relKehop.relevant && relKehop.programs.includes("kehop-plusz"), "a KEHOP Plusz-hírnek meg kell találnia a kehop-plusz programot");
  console.log("[teszt] Relevancia-szűrés (broad forrás) OK");

  // --- Relevancia: egyprogramos (dedikált) forrás mindig releváns, szűrés nélkül ---
  const singleSource = { programs: ["videki-otthonfelujitas"] };
  const relSingle = computeRelevance(rssItems[1].title, singleSource, aliasIndex); // az "irreleváns" cím is
  assert.ok(relSingle.relevant && relSingle.programs.length === 1 && relSingle.programs[0] === "videki-otthonfelujitas", "egyprogramos forrásnál minden elem releváns, szűrés nélkül");
  console.log("[teszt] Relevancia-szűrés (dedikált egyprogramos forrás) OK");

  // --- Ékezet-független illesztés ---
  const relAccent = computeRelevance("VIDEKI OTTHONFELUJITAS program hirei ekezet nelkul", broadSource, aliasIndex);
  assert.ok(relAccent.relevant, "ékezet nélküli, csupa nagybetűs szövegnek is találnia kell");
  console.log("[teszt] Ékezet-független illesztés OK");

  console.log("\n[teszt] Minden ellenőrzés sikeres.");
}

main().catch((err) => {
  console.error("[teszt] SIKERTELEN:", err);
  process.exitCode = 1;
});
