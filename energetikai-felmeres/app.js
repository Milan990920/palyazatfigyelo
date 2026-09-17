// Az app fő vezérlője: képernyők közti váltás, mentés, gombok.
"use strict";

const APP_VERSION = "1.0.0";
const root = document.getElementById("app");
let currentSurvey = null;

function saveCurrentSurvey() {
  if (currentSurvey) Storage.saveSurvey(currentSurvey);
}

function navigateTo(view, param) {
  location.hash = "#" + view + (param ? "/" + param : "");
}

function handleRoute() {
  const hash = location.hash.replace(/^#/, "");
  const [view, param] = hash.split("/");
  if (view === "survey" && param) {
    currentSurvey = Storage.getSurvey(param);
    if (!currentSurvey) {
      navigateTo("list");
      return;
    }
    renderSurveyView();
  } else if (view === "settings") {
    renderSettingsView();
  } else if (view === "help") {
    renderHelpView();
  } else if (view === "privacy") {
    renderPrivacyView();
  } else {
    renderListView();
  }
  window.scrollTo(0, 0);
}

function renderTopBar(titleText, opts) {
  opts = opts || {};
  const bar = el("div", { class: "topbar" });
  if (opts.back) {
    const back = el("button", { class: "btn-icon", type: "button", text: "←" });
    back.addEventListener("click", () => navigateTo(opts.back));
    bar.appendChild(back);
  }
  bar.appendChild(el("h1", { text: titleText }));
  const menuBtn = el("button", { class: "btn-icon", type: "button", text: "☰" });
  menuBtn.addEventListener("click", () => document.getElementById("sidemenu").classList.toggle("open"));
  bar.appendChild(menuBtn);
  return bar;
}

function renderSideMenu() {
  const menu = el("nav", { id: "sidemenu", class: "sidemenu" });
  const items = [
    ["Felméréseim", "list"],
    ["Beállítások", "settings"],
    ["Súgó / Hogyan használjam", "help"],
    ["Adatkezelési tájékoztató", "privacy"],
  ];
  items.forEach(([label, view]) => {
    const a = el("a", { href: "#" + view, text: label });
    a.addEventListener("click", () => menu.classList.remove("open"));
    menu.appendChild(a);
  });
  return menu;
}

// ---------- Felméréseim (lista) ----------
function renderListView() {
  root.innerHTML = "";
  root.appendChild(renderTopBar("Felméréseim"));
  root.appendChild(renderSideMenu());

  const container = el("div", { class: "view" });
  const list = Storage.listSurveys();

  const newBtn = el("button", { class: "btn btn-primary", type: "button", text: "+ Új felmérés indítása" });
  newBtn.addEventListener("click", () => {
    const survey = createSurvey();
    Storage.saveSurvey(survey);
    navigateTo("survey", survey.id);
  });
  container.appendChild(newBtn);

  if (!list.length) {
    container.appendChild(el("p", { class: "hint", text: "Még nincs mentett felmérésed. Kezdd az újgombbal." }));
  } else {
    const ul = el("div", { class: "survey-list" });
    list.forEach((s) => {
      const card = el("div", { class: "survey-card" });
      const info = el("div", { class: "survey-card-info" });
      info.appendChild(el("div", { class: "survey-card-title", text: s.telephelyNev }));
      const date = new Date(s.updatedAt);
      info.appendChild(el("div", { class: "survey-card-sub", text: s.buildingCount + " épület • frissítve: " + date.toLocaleString("hu-HU") }));
      card.appendChild(info);
      card.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        navigateTo("survey", s.id);
      });
      const delBtn = el("button", { class: "btn btn-danger btn-small", type: "button", text: "Törlés" });
      delBtn.addEventListener("click", () => {
        if (confirm('Biztosan törlöd ezt a felmérést: "' + s.telephelyNev + '"? Ez nem visszavonható.')) {
          Storage.deleteSurvey(s.id);
          renderListView();
        }
      });
      card.appendChild(delBtn);
      ul.appendChild(card);
    });
    container.appendChild(ul);
  }

  container.appendChild(el("hr"));
  const backupBtn = el("button", { class: "btn btn-secondary", type: "button", text: "Biztonsági mentés letöltése (.json)" });
  backupBtn.addEventListener("click", downloadBackup);
  container.appendChild(backupBtn);

  const importLabel = el("label", { class: "btn btn-secondary file-btn", text: "Biztonsági mentés visszaállítása" });
  const importInput = el("input", { type: "file", accept: "application/json" });
  importInput.style.display = "none";
  importInput.addEventListener("change", () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const count = Storage.importFromJson(reader.result);
        alert(count + " felmérés visszaállítva.");
        renderListView();
      } catch (e) {
        alert("Nem sikerült beolvasni a fájlt. Ellenőrizd, hogy ez az appból mentett biztonsági mentés fájl-e.");
      }
    };
    reader.readAsText(file);
  });
  importLabel.appendChild(importInput);
  container.appendChild(importLabel);

  root.appendChild(container);
}

function downloadBackup() {
  const json = Storage.exportAllAsJson();
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "energetikai-felmeres-mentes-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- Felmérés szerkesztése ----------
function renderSurveyView() {
  root.innerHTML = "";
  root.appendChild(renderTopBar("Felmérés", { back: "list" }));
  root.appendChild(renderSideMenu());

  const container = el("div", { class: "view" });

  const nameField = el("div", { class: "field" });
  nameField.appendChild(el("label", { text: "Telephely / megrendelő neve (ez alapján ismered majd fel a listában)" }));
  const nameInput = el("input", { type: "text" });
  nameInput.value = currentSurvey.telephelyNev || "";
  nameInput.addEventListener("input", () => {
    currentSurvey.telephelyNev = nameInput.value;
    saveCurrentSurvey();
  });
  nameField.appendChild(nameInput);
  container.appendChild(nameField);

  container.appendChild(el("h3", { text: "Alapadatok" }));
  container.appendChild(renderFieldGroup(SCHEMA.alapadatok, currentSurvey.alapadatok, saveCurrentSurvey));

  container.appendChild(renderRepeatable({
    title: "Épületek",
    itemArray: currentSurvey.buildings,
    fields: SCHEMA.building,
    createItem: createBuilding,
    addLabel: "+ Új épület hozzáadása",
    summaryFn: (b, i) => "Épület #" + (i + 1) + (b.nev ? " — " + b.nev : ""),
    onChange: saveCurrentSurvey,
    extraRenderer: (building) => renderBuildingSystems(building),
  }));

  const exportBtn = el("button", { class: "btn btn-primary", type: "button", text: "📄 Word-dokumentum készítése" });
  exportBtn.addEventListener("click", () => exportSurveyToWord(currentSurvey));
  container.appendChild(exportBtn);

  root.appendChild(container);
}

function renderBuildingSystems(building) {
  const wrap = el("div", { class: "building-systems" });

  wrap.appendChild(renderRepeatable({
    title: "Fűtési rendszerek",
    itemArray: building.heatingSystems,
    fields: SCHEMA.heatingSystem,
    createItem: createHeatingSystem,
    addLabel: "+ Új fűtési rendszer",
    summaryFn: (hs, i) => "Fűtési rendszer #" + (i + 1) + (hs.futesiKorMegnevezese ? " — " + hs.futesiKorMegnevezese : ""),
    onChange: saveCurrentSurvey,
    extraRenderer: (heatingSystem) => renderHeatingSystemDetail(heatingSystem),
  }));

  wrap.appendChild(renderRepeatable({
    title: "Hűtési rendszerek",
    itemArray: building.coolingSystems,
    fields: SCHEMA.coolingSystem,
    createItem: createCoolingSystem,
    addLabel: "+ Új hűtési rendszer",
    summaryFn: (cs, i) => "Hűtési rendszer #" + (i + 1) + (cs.hutesiKorMegnevezese ? " — " + cs.hutesiKorMegnevezese : ""),
    onChange: saveCurrentSurvey,
    extraRenderer: (coolingSystem) => renderCoolingSystemDetail(coolingSystem),
  }));

  wrap.appendChild(renderRepeatable({
    title: "Szellőztető berendezések",
    itemArray: building.ventilationSystems,
    fields: SCHEMA.ventilationDevice,
    createItem: createVentilationDevice,
    addLabel: "+ Új szellőztető berendezés",
    summaryFn: (v, i) => "Szellőztető berendezés #" + (i + 1) + (v.szelloztetettTerMegnevezese ? " — " + v.szelloztetettTerMegnevezese : ""),
    onChange: saveCurrentSurvey,
  }));

  wrap.appendChild(renderRepeatable({
    title: "Hőmérsékletmérés",
    itemArray: building.tempMeasurements,
    fields: SCHEMA.tempMeasurement,
    createItem: createTempMeasurement,
    addLabel: "+ Új hőmérsékletmérés",
    summaryFn: (t, i) => "Hőmérsékletmérés #" + (i + 1) + (t.hotermeloMegnevezese ? " — " + t.hotermeloMegnevezese : ""),
    onChange: saveCurrentSurvey,
  }));

  return wrap;
}

function renderHeatingSystemDetail(heatingSystem) {
  const wrap = el("div", {});
  wrap.appendChild(renderRepeatable({
    title: "Hőtermelők",
    itemArray: heatingSystem.heatProducers,
    fields: SCHEMA.heatProducer,
    createItem: createHeatProducer,
    addLabel: "+ Új hőtermelő",
    summaryFn: (p, i) => "Hőtermelő #" + (i + 1) + (p.gyarto ? " — " + p.gyarto + (p.tipus ? " " + p.tipus : "") : ""),
    onChange: saveCurrentSurvey,
  }));
  wrap.appendChild(renderRepeatable({
    title: "Elosztó hálózatok",
    itemArray: heatingSystem.distributionNetworks,
    fields: SCHEMA.distributionNetworkHeating,
    createItem: createDistributionNetwork,
    addLabel: "+ Új elosztó hálózat",
    summaryFn: (d, i) => "Elosztó hálózat #" + (i + 1) + (d.korMegnevezese ? " — " + d.korMegnevezese : ""),
    onChange: saveCurrentSurvey,
  }));
  wrap.appendChild(renderRepeatable({
    title: "Hőleadók",
    itemArray: heatingSystem.heatEmitters,
    fields: SCHEMA.heatEmitter,
    createItem: createHeatEmitter,
    addLabel: "+ Új hőleadó",
    summaryFn: (h, i) => "Hőleadó #" + (i + 1) + (h.tipus ? " — " + h.tipus : ""),
    onChange: saveCurrentSurvey,
  }));
  return wrap;
}

function renderCoolingSystemDetail(coolingSystem) {
  const wrap = el("div", {});
  wrap.appendChild(renderRepeatable({
    title: "Hűtőberendezések",
    itemArray: coolingSystem.producers,
    fields: SCHEMA.coolingProducer,
    createItem: createCoolingProducer,
    addLabel: "+ Új hűtőberendezés",
    summaryFn: (p, i) => "Hűtőberendezés #" + (i + 1) + (p.gyarto ? " — " + p.gyarto + (p.tipus ? " " + p.tipus : "") : ""),
    onChange: saveCurrentSurvey,
  }));
  wrap.appendChild(renderRepeatable({
    title: "Elosztó hálózatok",
    itemArray: coolingSystem.distributionNetworks,
    fields: SCHEMA.distributionNetworkCooling,
    createItem: createDistributionNetwork,
    addLabel: "+ Új elosztó hálózat",
    summaryFn: (d, i) => "Elosztó hálózat #" + (i + 1) + (d.korMegnevezese ? " — " + d.korMegnevezese : ""),
    onChange: saveCurrentSurvey,
  }));
  wrap.appendChild(renderRepeatable({
    title: "Hőleadók",
    itemArray: coolingSystem.heatEmitters,
    fields: SCHEMA.coolEmitter,
    createItem: createHeatEmitter,
    addLabel: "+ Új hőleadó",
    summaryFn: (h, i) => "Hőleadó #" + (i + 1) + (h.tipus ? " — " + h.tipus : ""),
    onChange: saveCurrentSurvey,
  }));
  return wrap;
}

// ---------- Beállítások ----------
function renderSettingsView() {
  root.innerHTML = "";
  root.appendChild(renderTopBar("Beállítások", { back: "list" }));
  root.appendChild(renderSideMenu());

  const container = el("div", { class: "view" });
  container.appendChild(el("p", { class: "hint", text: "Ezek az adatok jelennek meg a Word-dokumentum fejlécében, amikor exportálod a felmérést. Csak ezen a telefonon tárolódnak." }));

  const settings = Storage.getSettings();
  container.appendChild(renderFieldGroup(SCHEMA.settings, settings, () => Storage.saveSettings(settings)));

  const logoField = el("div", { class: "field" });
  logoField.appendChild(el("label", { text: "Cég logója (opcionális)" }));
  if (settings.logoDataUrl) {
    const preview = el("img", { src: settings.logoDataUrl, class: "logo-preview" });
    logoField.appendChild(preview);
    const removeBtn = el("button", { class: "btn btn-secondary btn-small", type: "button", text: "Logó eltávolítása" });
    removeBtn.addEventListener("click", () => {
      delete settings.logoDataUrl;
      Storage.saveSettings(settings);
      renderSettingsView();
    });
    logoField.appendChild(removeBtn);
  }
  const logoInput = el("input", { type: "file", accept: "image/*" });
  logoInput.addEventListener("change", () => {
    const file = logoInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      settings.logoDataUrl = reader.result;
      Storage.saveSettings(settings);
      renderSettingsView();
    };
    reader.readAsDataURL(file);
  });
  logoField.appendChild(logoInput);
  container.appendChild(logoField);

  root.appendChild(container);
}

// ---------- Súgó ----------
function renderHelpView() {
  root.innerHTML = "";
  root.appendChild(renderTopBar("Súgó / Hogyan használjam", { back: "list" }));
  root.appendChild(renderSideMenu());

  const container = el("div", { class: "view help-view" });
  container.innerHTML = `
    <h3>Hogyan használd az appot</h3>
    <ol>
      <li><b>Új felmérés indítása:</b> a főoldalon nyomd meg a "+ Új felmérés indítása" gombot, és adj neki egy könnyen felismerhető nevet (pl. a megrendelő neve).</li>
      <li><b>Adatok felvétele:</b> töltsd ki az Alapadatok mezőit, majd adj hozzá épületeket a "+ Új épület hozzáadása" gombbal. Minden épülethez adhatsz fűtési, hűtési, szellőztető rendszereket, és ezekhez is hőtermelőket, elosztó hálózatokat, hőleadókat — ahányat a valóságban találsz.</li>
      <li><b>Automatikus mentés:</b> minden mezőbe gépelt adat azonnal elmentődik a telefonodra. Nem kell külön "Mentés" gombot nyomnod, és nyugodtan zárhatod be az appot félbehagyott munka közben — legközelebb ugyanott folytathatod.</li>
      <li><b>Word-dokumentum készítése:</b> ha végeztél (vagy akár közben is), a felmérés alján a "Word-dokumentum készítése" gombbal letöltheted a kitöltött jegyzőkönyvet, amit aztán a telefonodról tovább tudsz küldeni e-mailben vagy megnyithatod Word-ben.</li>
      <li><b>Beállítások:</b> itt add meg egyszer a saját neved, telefonszámod, céged nevét és (ha van) a cég logóját — ez automatikusan bekerül minden Word-dokumentum fejlécébe.</li>
    </ol>
    <h3 style="color:#b02a2a">Nagyon fontos — mentés!</h3>
    <p>Az összes felmérésed <b>kizárólag ezen a telefonon</b>, a böngésződben tárolódik. Ez azt jelenti:</p>
    <ul>
      <li>Ha törlöd a böngésző adatait/gyorsítótárát, a felméréseid elveszhetnek.</li>
      <li>Ha másik telefont vagy böngészőt használsz, ott nem látod a régi felméréseidet.</li>
      <li>Senki más nem fér hozzá az adataidhoz — de ez azt is jelenti, hogy <b>nincs automatikus internetes biztonsági mentés</b>.</li>
    </ul>
    <p><b>Ezért rendszeresen (pl. hetente) készíts biztonsági mentést:</b> a főoldalon a "Biztonsági mentés letöltése" gombbal egy .json fájlt tudsz letölteni, amit érdemes elmenteni egy felhő-tárhelyre (pl. Google Drive, e-mail magadnak) vagy a számítógépedre. Ha új telefont veszel, vagy valami elromlik, a "Biztonsági mentés visszaállítása" gombbal ezt a fájlt visszatöltheted.</li>
    </p>
    <h3>Internet nélkül is működik</h3>
    <p>Az app első megnyitásához kell internet, azután offline (net nélkül) is használható a terepen. Ha új verziót adunk ki, az app jelezni fogja, hogy van frissítés — a mentett felméréseid ilyenkor nem vesznek el.</p>
  `;
  root.appendChild(container);
}

// ---------- Adatkezelés ----------
function renderPrivacyView() {
  root.innerHTML = "";
  root.appendChild(renderTopBar("Adatkezelési tájékoztató", { back: "list" }));
  root.appendChild(renderSideMenu());

  const container = el("div", { class: "view help-view" });
  container.innerHTML = `
    <p>Ez az alkalmazás <b>nem küld adatot semmilyen szerverre</b>. Minden felmérés, beállítás és fájl, amit itt megadsz, kizárólag a saját eszközöd böngészőjében tárolódik (helyi tárolás).</p>
    <ul>
      <li>Nincs felhasználói fiók, nincs regisztráció, nincs bejelentkezés.</li>
      <li>Nincs látogatottságmérés, nincs analitika, nincs reklám, nincs követő süti (cookie).</li>
      <li>Az app fejlesztője (vagy más felhasználó) nem lát bele a te adataidba.</li>
      <li>Az adatok addig maradnak meg, amíg nem törlöd a böngésző tárolt adatait, vagy nem törlöd magad az appban.</li>
      <li>A biztonsági mentés (.json fájl), amit letöltesz, ugyanígy csak a te eszközödön van — azt te döntöd el, hova mented tovább.</li>
    </ul>
  `;
  root.appendChild(container);
}

// ---------- Frissítés-jelzés (PWA) ----------
function showUpdateBanner(registration) {
  if (document.querySelector(".update-banner")) return;
  const banner = el("div", { class: "update-banner" });
  banner.appendChild(document.createTextNode("Elérhető egy új verzió az appból."));
  const btn = el("button", { type: "button", text: "Frissítés most" });
  btn.addEventListener("click", () => {
    if (registration.waiting) registration.waiting.postMessage("skipWaiting");
  });
  banner.appendChild(btn);
  document.body.appendChild(banner);
}

function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").then((registration) => {
    if (registration.waiting) showUpdateBanner(registration);
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          showUpdateBanner(registration);
        }
      });
    });
  }).catch((e) => console.error("Service worker regisztráció sikertelen", e));

  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
}

window.addEventListener("hashchange", handleRoute);
window.addEventListener("DOMContentLoaded", () => {
  handleRoute();
  setupServiceWorker();
});
