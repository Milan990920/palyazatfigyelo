// Mentés a telefon böngészőjében (localStorage). Semmilyen adat nem megy szerverre.
"use strict";

const STORAGE_PREFIX = "ef_";
const INDEX_KEY = STORAGE_PREFIX + "index";
const SETTINGS_KEY = STORAGE_PREFIX + "settings";

const Storage = {
  listSurveys() {
    try {
      const raw = localStorage.getItem(INDEX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Nem sikerült beolvasni a felmérések listáját", e);
      return [];
    }
  },

  _saveIndex(list) {
    localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  },

  getSurvey(id) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + "survey_" + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error("Nem sikerült beolvasni a felmérést", e);
      return null;
    }
  },

  saveSurvey(survey) {
    survey.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_PREFIX + "survey_" + survey.id, JSON.stringify(survey));
    const list = this.listSurveys();
    const idx = list.findIndex((s) => s.id === survey.id);
    const entry = {
      id: survey.id,
      telephelyNev: survey.telephelyNev || "(névtelen felmérés)",
      updatedAt: survey.updatedAt,
      createdAt: survey.createdAt,
      buildingCount: (survey.buildings || []).length,
    };
    if (idx >= 0) list[idx] = entry;
    else list.push(entry);
    list.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
    this._saveIndex(list);
  },

  deleteSurvey(id) {
    localStorage.removeItem(STORAGE_PREFIX + "survey_" + id);
    const list = this.listSurveys().filter((s) => s.id !== id);
    this._saveIndex(list);
  },

  getSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  },

  saveSettings(settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  exportAllAsJson() {
    const list = this.listSurveys();
    const surveys = list.map((s) => this.getSurvey(s.id)).filter(Boolean);
    return JSON.stringify({ exportedAt: new Date().toISOString(), settings: this.getSettings(), surveys }, null, 2);
  },

  importFromJson(jsonText) {
    const data = JSON.parse(jsonText);
    if (data.settings) this.saveSettings(data.settings);
    if (Array.isArray(data.surveys)) {
      data.surveys.forEach((s) => this.saveSurvey(s));
    }
    return (data.surveys || []).length;
  },

  estimateUsage() {
    let total = 0;
    for (const key in localStorage) {
      if (Object.prototype.hasOwnProperty.call(localStorage, key) && key.startsWith(STORAGE_PREFIX)) {
        total += (localStorage.getItem(key) || "").length;
      }
    }
    return total;
  },
};
