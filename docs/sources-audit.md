# Forrás-audit

Generálva: 2026-09-17T12:31:55.783Z

Ez a fájl a `scripts/audit-sources.mjs` futásának eredménye. **A `data/sources.json`-t csak ez alapján szabad frissíteni** — sosem szabad feed URL-t kitalálni. Ha egy forrásnál nincs RSS, a `method` maradjon `"page"` (hash-alapú oldalfigyelés).

## Hivatalos

| Forrás | HTTP | Végső URL | Talált feed | Robots | Javaslat |
|---|---|---|---|---|---|
| Magyar Közlöny (`magyar-kozlony`) | 200 | *(változatlan)* | ✅ `https://magyarkozlony.hu/feed` (100 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://magyarkozlony.hu/feed" |
| Nemzeti Jogszabálytár (`njt`) | hiba: fetch failed | — | — | — | nem elérhető — hagyd ki vagy vizsgáld felül az URL-t |
| Pályázat.gov.hu (`palyazat-gov`) | 200 | *(változatlan)* | ✅ `https://www.palyazat.gov.hu/rss.xml` (10 elem) | ✅ HTTP 404 — nincs robots.txt, alapból engedélyezettnek vesszük | method: "rss", feedUrl: "https://www.palyazat.gov.hu/rss.xml" |
| MFB Pont Plusz (`mfb-pontok-plusz`) | 200 | *(változatlan)* | ❌ nem XML/RSS válasz | ✅ engedélyezett | method: "page" (nincs használható RSS) |
| Nemzeti Energetikai Ügynökség (neuzrt.hu) (`neuzrt`) | 403 | *(változatlan)* | — | — | nem elérhető — hagyd ki vagy vizsgáld felül az URL-t |
| NEÜ – Otthoni Energiatároló Program aloldal (`neuzrt-oetp`) | 200 | *(változatlan)* | ❌ HTTP 404 | ✅ engedélyezett | method: "page" (nincs használható RSS) |
| NEÜ – régi domain (nffku.hu) (`nffku`) | 403 | https://neuzrt.hu/ | — | — | nem elérhető — hagyd ki vagy vizsgáld felül az URL-t |
| Kormany.hu – Energiaügyi Minisztérium hírei (`kormany-energiaugyi`) | 200 | https://kormany.hu/kormanyzat/energiaugyi-miniszterium/hirek | ❌ HTTP 404 | ✅ engedélyezett | method: "page" (nincs használható RSS) |
| Magyar Államkincstár (`allamkincstar`) | 200 | *(változatlan)* | ❌ HTTP 404 | ✅ engedélyezett | method: "page" (nincs használható RSS) |

## Sajtó

| Forrás | HTTP | Végső URL | Talált feed | Robots | Javaslat |
|---|---|---|---|---|---|
| Hirado.hu (MTI) (`hirado`) | 403 | *(változatlan)* | — | — | nem elérhető — hagyd ki vagy vizsgáld felül az URL-t |
| Portfolio (`portfolio`) | 200 | *(változatlan)* | ✅ `https://www.portfolio.hu/rss/all.xml` (20 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://www.portfolio.hu/rss/all.xml" |
| Világgazdaság (`vg`) | 200 | *(változatlan)* | ✅ `https://www.vg.hu/publicapi/hu/rss/vilaggazdasag/articles` (50 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://www.vg.hu/publicapi/hu/rss/vilaggazdasag/articles" |
| HVG (`hvg`) | 200 | *(változatlan)* | ✅ `https://hvg.hu/rss` (60 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://hvg.hu/rss" |
| Telex (`telex`) | 200 | *(változatlan)* | ✅ `https://telex.hu/rss` (50 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://telex.hu/rss" |
| Index (`index`) | 200 | *(változatlan)* | ✅ `https://index.hu/24ora/rss/` (51 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://index.hu/24ora/rss/" |
| Bankmonitor (`bankmonitor`) | 200 | *(változatlan)* | ✅ `https://bankmonitor.hu/feed/` (10 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://bankmonitor.hu/feed/" |
| Pénzcentrum (`penzcentrum`) | 200 | *(változatlan)* | ✅ `https://www.penzcentrum.hu/rss/all.xml` (20 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://www.penzcentrum.hu/rss/all.xml" |
| Google News RSS keresés (teszt lekérdezéssel) (`google-news-search`) | 200 | *(változatlan)* | ✅ `https://news.google.com/rss/search?q=%22Otthoni%20Energiat%C3%A1rol%C3%B3%20Program%22&hl=hu&gl=HU&ceid=HU:hu` (71 elem) | ⚠️ Disallow: / — tiltott | method: "rss", feedUrl: "https://news.google.com/rss/search?q=%22Otthoni%20Energiat%C3%A1rol%C3%B3%20Program%22&hl=hu&gl=HU&ceid=HU:hu" |

## Aggregátor

| Forrás | HTTP | Végső URL | Talált feed | Robots | Javaslat |
|---|---|---|---|---|---|
| Palyazatmenedzser.hu (`palyazatmenedzser`) | 403 | *(változatlan)* | — | — | nem elérhető — hagyd ki vagy vizsgáld felül az URL-t |
| Palyaz.hu (`palyaz`) | 200 | *(változatlan)* | ✅ `https://palyaz.hu/feed/` (10 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://palyaz.hu/feed/" |
| Palyazatok.org (`palyazatok-org`) | 200 | *(változatlan)* | ✅ `https://palyazatok.org/feed/` (3 elem) | ✅ engedélyezett | method: "rss", feedUrl: "https://palyazatok.org/feed/" |
| Palyazatfigyelo.org (`palyazatfigyelo-org`) | 403 | *(változatlan)* | — | — | nem elérhető — hagyd ki vagy vizsgáld felül az URL-t |

## Nyers JSON (gépi feldolgozáshoz)

```json
[
  {
    "id": "magyar-kozlony",
    "name": "Magyar Közlöny",
    "tier": "official",
    "url": "https://magyarkozlony.hu/",
    "httpStatus": 200,
    "finalUrl": "https://magyarkozlony.hu/",
    "feed": {
      "url": "https://magyarkozlony.hu/feed",
      "ok": true,
      "itemCount": 100
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "njt",
    "name": "Nemzeti Jogszabálytár",
    "tier": "official",
    "url": "https://njt.hu/",
    "httpStatus": null,
    "finalUrl": null,
    "feed": null,
    "robots": null,
    "error": "fetch failed"
  },
  {
    "id": "palyazat-gov",
    "name": "Pályázat.gov.hu",
    "tier": "official",
    "url": "https://www.palyazat.gov.hu/",
    "httpStatus": 200,
    "finalUrl": "https://www.palyazat.gov.hu/",
    "feed": {
      "url": "https://www.palyazat.gov.hu/rss.xml",
      "ok": true,
      "itemCount": 10
    },
    "robots": {
      "present": false,
      "allowsRoot": true,
      "note": "HTTP 404 — nincs robots.txt, alapból engedélyezettnek vesszük"
    },
    "error": null
  },
  {
    "id": "mfb-pontok-plusz",
    "name": "MFB Pont Plusz",
    "tier": "official",
    "url": "https://www.mfb.hu/mfb-pontok-plusz",
    "httpStatus": 200,
    "finalUrl": "https://www.mfb.hu/mfb-pontok-plusz",
    "feed": {
      "url": "https://www.mfb.hu/rss",
      "ok": false,
      "reason": "nem XML/RSS válasz"
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "neuzrt",
    "name": "Nemzeti Energetikai Ügynökség (neuzrt.hu)",
    "tier": "official",
    "url": "https://neuzrt.hu/",
    "httpStatus": 403,
    "finalUrl": "https://neuzrt.hu/",
    "feed": null,
    "robots": null,
    "error": null
  },
  {
    "id": "neuzrt-oetp",
    "name": "NEÜ – Otthoni Energiatároló Program aloldal",
    "tier": "official",
    "url": "https://otthonienergiatarolo.neuzrt.hu/",
    "httpStatus": 200,
    "finalUrl": "https://otthonienergiatarolo.neuzrt.hu/",
    "feed": {
      "url": "https://otthonienergiatarolo.neuzrt.hu/rss",
      "ok": false,
      "reason": "HTTP 404"
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "nffku",
    "name": "NEÜ – régi domain (nffku.hu)",
    "tier": "official",
    "url": "https://nffku.hu/",
    "httpStatus": 403,
    "finalUrl": "https://neuzrt.hu/",
    "feed": null,
    "robots": null,
    "error": null
  },
  {
    "id": "kormany-energiaugyi",
    "name": "Kormany.hu – Energiaügyi Minisztérium hírei",
    "tier": "official",
    "url": "https://kormany.hu/energiaugyi-miniszterium/hirek",
    "httpStatus": 200,
    "finalUrl": "https://kormany.hu/kormanyzat/energiaugyi-miniszterium/hirek",
    "feed": {
      "url": "https://kormany.hu/rss",
      "ok": false,
      "reason": "HTTP 404"
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "allamkincstar",
    "name": "Magyar Államkincstár",
    "tier": "official",
    "url": "https://www.allamkincstar.gov.hu/",
    "httpStatus": 200,
    "finalUrl": "https://www.allamkincstar.gov.hu/",
    "feed": {
      "url": "https://www.allamkincstar.gov.hu/rss",
      "ok": false,
      "reason": "HTTP 404"
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "hirado",
    "name": "Hirado.hu (MTI)",
    "tier": "press",
    "url": "https://hirado.hu/",
    "httpStatus": 403,
    "finalUrl": "https://hirado.hu/",
    "feed": null,
    "robots": null,
    "error": null
  },
  {
    "id": "portfolio",
    "name": "Portfolio",
    "tier": "press",
    "url": "https://www.portfolio.hu/",
    "httpStatus": 200,
    "finalUrl": "https://www.portfolio.hu/",
    "feed": {
      "url": "https://www.portfolio.hu/rss/all.xml",
      "ok": true,
      "itemCount": 20
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "vg",
    "name": "Világgazdaság",
    "tier": "press",
    "url": "https://www.vg.hu/",
    "httpStatus": 200,
    "finalUrl": "https://www.vg.hu/",
    "feed": {
      "url": "https://www.vg.hu/publicapi/hu/rss/vilaggazdasag/articles",
      "ok": true,
      "itemCount": 50
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "hvg",
    "name": "HVG",
    "tier": "press",
    "url": "https://hvg.hu/",
    "httpStatus": 200,
    "finalUrl": "https://hvg.hu/",
    "feed": {
      "url": "https://hvg.hu/rss",
      "ok": true,
      "itemCount": 60
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "telex",
    "name": "Telex",
    "tier": "press",
    "url": "https://telex.hu/",
    "httpStatus": 200,
    "finalUrl": "https://telex.hu/",
    "feed": {
      "url": "https://telex.hu/rss",
      "ok": true,
      "itemCount": 50
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "index",
    "name": "Index",
    "tier": "press",
    "url": "https://index.hu/",
    "httpStatus": 200,
    "finalUrl": "https://index.hu/",
    "feed": {
      "url": "https://index.hu/24ora/rss/",
      "ok": true,
      "itemCount": 51
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "bankmonitor",
    "name": "Bankmonitor",
    "tier": "press",
    "url": "https://bankmonitor.hu/",
    "httpStatus": 200,
    "finalUrl": "https://bankmonitor.hu/",
    "feed": {
      "url": "https://bankmonitor.hu/feed/",
      "ok": true,
      "itemCount": 10
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "penzcentrum",
    "name": "Pénzcentrum",
    "tier": "press",
    "url": "https://www.penzcentrum.hu/",
    "httpStatus": 200,
    "finalUrl": "https://www.penzcentrum.hu/",
    "feed": {
      "url": "https://www.penzcentrum.hu/rss/all.xml",
      "ok": true,
      "itemCount": 20
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "google-news-search",
    "name": "Google News RSS keresés (teszt lekérdezéssel)",
    "tier": "press",
    "url": "https://news.google.com/rss/search?q=%22Otthoni%20Energiat%C3%A1rol%C3%B3%20Program%22&hl=hu&gl=HU&ceid=HU:hu",
    "httpStatus": 200,
    "finalUrl": "https://news.google.com/rss/search?q=%22Otthoni%20Energiat%C3%A1rol%C3%B3%20Program%22&hl=hu&gl=HU&ceid=HU:hu",
    "feed": {
      "url": "https://news.google.com/rss/search?q=%22Otthoni%20Energiat%C3%A1rol%C3%B3%20Program%22&hl=hu&gl=HU&ceid=HU:hu",
      "ok": true,
      "itemCount": 71
    },
    "robots": {
      "present": true,
      "allowsRoot": false,
      "note": "Disallow: / — tiltott"
    },
    "error": null
  },
  {
    "id": "palyazatmenedzser",
    "name": "Palyazatmenedzser.hu",
    "tier": "aggregator",
    "url": "https://palyazatmenedzser.hu/",
    "httpStatus": 403,
    "finalUrl": "https://palyazatmenedzser.hu/",
    "feed": null,
    "robots": null,
    "error": null
  },
  {
    "id": "palyaz",
    "name": "Palyaz.hu",
    "tier": "aggregator",
    "url": "https://palyaz.hu/",
    "httpStatus": 200,
    "finalUrl": "https://palyaz.hu/",
    "feed": {
      "url": "https://palyaz.hu/feed/",
      "ok": true,
      "itemCount": 10
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "palyazatok-org",
    "name": "Palyazatok.org",
    "tier": "aggregator",
    "url": "https://palyazatok.org/",
    "httpStatus": 200,
    "finalUrl": "https://palyazatok.org/",
    "feed": {
      "url": "https://palyazatok.org/feed/",
      "ok": true,
      "itemCount": 3
    },
    "robots": {
      "present": true,
      "allowsRoot": true,
      "note": "engedélyezett"
    },
    "error": null
  },
  {
    "id": "palyazatfigyelo-org",
    "name": "Palyazatfigyelo.org",
    "tier": "aggregator",
    "url": "https://palyazatfigyelo.org/",
    "httpStatus": 403,
    "finalUrl": "https://palyazatfigyelo.org/",
    "feed": null,
    "robots": null,
    "error": null
  }
]
```
