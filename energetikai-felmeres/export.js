// Word-dokumentum (.docx) készítése a felmérés adataiból, teljesen a telefonon,
// internet-kapcsolat nélkül. A "docx" könyvtárat használja (helyben tárolva, vendor/docx.iife.js),
// ami valódi Word-fájlt épít, ezért Word mellett LibreOffice-ban és Google Docs-ban is megnyílik.
"use strict";

const CELL_BORDER = { style: docx.BorderStyle.SINGLE, size: 2, color: "CCCCCC" };
const TABLE_BORDERS = {
  top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER,
  insideHorizontal: CELL_BORDER, insideVertical: CELL_BORDER,
};

function textCell(text, opts) {
  opts = opts || {};
  return new docx.TableCell({
    width: { size: opts.width || 50, type: docx.WidthType.PERCENTAGE },
    shading: opts.shaded ? { type: docx.ShadingType.CLEAR, fill: "F2F2F2" } : undefined,
    children: [new docx.Paragraph({ children: [new docx.TextRun({ text: String(text), bold: !!opts.bold })] })],
  });
}

function fieldsToRows(fields, data) {
  const rows = [];
  fields.forEach((field) => {
    let value = data[field.key];
    if (field.type === "checkboxgroup") value = Array.isArray(value) ? value.join(", ") : "";
    if (value === undefined || value === null || value === "") return;
    const unit = field.unit ? " " + field.unit : "";
    rows.push(new docx.TableRow({
      children: [textCell(field.label, { width: 45, shaded: true }), textCell(String(value) + unit, { width: 55 })],
    }));
  });
  return rows;
}

function fieldsTable(fields, data) {
  const rows = fieldsToRows(fields, data);
  if (!rows.length) return null;
  return new docx.Table({ width: { size: 100, type: docx.WidthType.PERCENTAGE }, borders: TABLE_BORDERS, rows });
}

function heading(text, level) {
  return new docx.Paragraph({ text, heading: level, spacing: { before: 200, after: 100 } });
}

function spacer() {
  return new docx.Paragraph({ text: "" });
}

// Egy adatblokk: alcím + (ha van adat) táblázat a mezőkkel. Ha nincs kitöltött mező, kimarad.
function section(title, level, fields, data, children) {
  const table = fields ? fieldsTable(fields, data) : null;
  if (!table && !(children && children.length)) return [];
  const out = [heading(title, level)];
  if (table) out.push(table, spacer());
  if (children) children.forEach((c) => out.push(...c));
  return out;
}

function dataUrlToUint8Array(dataUrl) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function buildDocChildren(survey, settings) {
  const children = [];

  // Fejléc: cím, telephely, felmérő adatai, dátum, logó
  const headerCells = [];
  const infoLines = [
    new docx.Paragraph({ children: [new docx.TextRun({ text: "Energetikai felülvizsgálat — adatfelvételi jegyzőkönyv", bold: true, size: 32 })] }),
    new docx.Paragraph({ children: [new docx.TextRun({ text: survey.telephelyNev || "", bold: true, size: 26 })], spacing: { before: 100 } }),
  ];
  if (settings.felmeroNev || settings.felmeroTelefon) {
    infoLines.push(new docx.Paragraph({ text: "Felmérő: " + [settings.felmeroNev, settings.felmeroTelefon].filter(Boolean).join(" · ") }));
  }
  if (settings.cegNev) infoLines.push(new docx.Paragraph({ text: settings.cegNev }));
  infoLines.push(new docx.Paragraph({ text: "Kelt: " + new Date().toLocaleDateString("hu-HU") }));

  if (settings.logoDataUrl) {
    try {
      const imageData = dataUrlToUint8Array(settings.logoDataUrl);
      headerCells.push(
        new docx.TableCell({ width: { size: 70, type: docx.WidthType.PERCENTAGE }, borders: noBordersCell(), children: infoLines }),
        new docx.TableCell({
          width: { size: 30, type: docx.WidthType.PERCENTAGE },
          borders: noBordersCell(),
          children: [new docx.Paragraph({
            alignment: docx.AlignmentType.RIGHT,
            children: [new docx.ImageRun({ data: imageData, transformation: { width: 100, height: 100 } })],
          })],
        })
      );
      children.push(new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        borders: TABLE_BORDERS_NONE,
        rows: [new docx.TableRow({ children: headerCells })],
      }));
    } catch (e) {
      infoLines.forEach((p) => children.push(p));
    }
  } else {
    infoLines.forEach((p) => children.push(p));
  }
  children.push(spacer());

  children.push(...section("Alapadatok", docx.HeadingLevel.HEADING_2, SCHEMA.alapadatok, survey.alapadatok || {}));

  (survey.buildings || []).forEach((building, bi) => {
    const buildingTitle = "Épület #" + (bi + 1) + (building.nev ? " — " + building.nev : "");
    const buildingChildren = [];

    (building.heatingSystems || []).forEach((hs, hi) => {
      const hsTitle = "Fűtési rendszer #" + (hi + 1) + (hs.futesiKorMegnevezese ? " — " + hs.futesiKorMegnevezese : "");
      const hsChildren = [];
      (hs.heatProducers || []).forEach((p, i) => hsChildren.push(section("Hőtermelő #" + (i + 1), docx.HeadingLevel.HEADING_4, SCHEMA.heatProducer, p)));
      (hs.distributionNetworks || []).forEach((d, i) => hsChildren.push(section("Elosztó hálózat #" + (i + 1), docx.HeadingLevel.HEADING_4, SCHEMA.distributionNetworkHeating, d)));
      (hs.heatEmitters || []).forEach((h, i) => hsChildren.push(section("Hőleadó #" + (i + 1), docx.HeadingLevel.HEADING_4, SCHEMA.heatEmitter, h)));
      buildingChildren.push(section(hsTitle, docx.HeadingLevel.HEADING_3, SCHEMA.heatingSystem, hs, hsChildren));
    });

    (building.coolingSystems || []).forEach((cs, ci) => {
      const csTitle = "Hűtési rendszer #" + (ci + 1) + (cs.hutesiKorMegnevezese ? " — " + cs.hutesiKorMegnevezese : "");
      const csChildren = [];
      (cs.producers || []).forEach((p, i) => csChildren.push(section("Hűtőberendezés #" + (i + 1), docx.HeadingLevel.HEADING_4, SCHEMA.coolingProducer, p)));
      (cs.distributionNetworks || []).forEach((d, i) => csChildren.push(section("Elosztó hálózat #" + (i + 1), docx.HeadingLevel.HEADING_4, SCHEMA.distributionNetworkCooling, d)));
      (cs.heatEmitters || []).forEach((h, i) => csChildren.push(section("Hőleadó #" + (i + 1), docx.HeadingLevel.HEADING_4, SCHEMA.coolEmitter, h)));
      buildingChildren.push(section(csTitle, docx.HeadingLevel.HEADING_3, SCHEMA.coolingSystem, cs, csChildren));
    });

    (building.ventilationSystems || []).forEach((v, vi) => {
      const vTitle = "Szellőztető berendezés #" + (vi + 1) + (v.szelloztetettTerMegnevezese ? " — " + v.szelloztetettTerMegnevezese : "");
      buildingChildren.push(section(vTitle, docx.HeadingLevel.HEADING_3, SCHEMA.ventilationDevice, v));
    });

    (building.tempMeasurements || []).forEach((t, ti) => {
      buildingChildren.push(section("Hőmérsékletmérés #" + (ti + 1), docx.HeadingLevel.HEADING_3, SCHEMA.tempMeasurement, t));
    });

    children.push(...section(buildingTitle, docx.HeadingLevel.HEADING_1, SCHEMA.building, building, buildingChildren));
  });

  return children;
}

const NO_BORDER = { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" };
const TABLE_BORDERS_NONE = {
  top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER,
  insideHorizontal: NO_BORDER, insideVertical: NO_BORDER,
};
function noBordersCell() { return TABLE_BORDERS_NONE; }

async function exportSurveyToWord(survey) {
  const settings = Storage.getSettings();
  try {
    const doc = new docx.Document({
      sections: [{ properties: {}, children: buildDocChildren(survey, settings) }],
    });
    const blob = await docx.Packer.toBlob(doc);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const safeName = (survey.telephelyNev || "felmeres").replace(/[^a-zA-Z0-9_\-áéíóöőúüűÁÉÍÓÖŐÚÜŰ ]/g, "").trim() || "felmeres";
    a.download = safeName + ".docx";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (e) {
    console.error(e);
    alert("Sajnos nem sikerült elkészíteni a Word-dokumentumot. Próbáld újra, és ha megint hibát kapsz, jelezd a fejlesztőnek a hibaüzenetet: " + e.message);
  }
}
