// Adatmezők és választható listák — az eredeti papíralapú adatfelvételi lap alapján,
// az elgépelt/hibás karaktereket javítva.
"use strict";

const OPT = {
  igenNem: ["Igen", "Nem"],
  rendszerSzam: ["Nincs", "1 rendszer", "Több rendszer"],
  hasznalat: ["Lakó-szállásjellegű", "Iroda", "Szociális", "Üzem", "Oktatási"],
  tetokialakitas: ["Lapostető", "Ferde, tetőtér beépítéssel", "Ferde, hideg padlással"],
  melegvizHasznalat: ["Nincs", "Csak irodai", "Csak lakó-szállásjellegű", "Csak szociális", "Csak üzemi"],
  epitoanyag: ["Vályog", "Kisméretű tégla", "Nagylyukú tégla (B25, B30)", "Korszerű tégla", "YTONG",
    "Szendvicspanel", "Beton falazóelem", "Magszigetelt panel"],
  nyilaszaro: ["Fa-fém keret, egyrétegű üveg", "Fa-fém keret, kétrétegű üveg",
    "Műanyag keret, kétrétegű üveg", "Korszerű műanyag keret, két-háromrétegű üveggel"],
  zarofodem: ["Monolit vasbeton", "Fa", "Béléstestes", "Tető"],
  holTalalhato: ["Kültér", "Beltér"],
  uzemmod: ["Fűtés", "Fűtés + HMV"],
  energiahordozo: ["Földgáz", "PB", "Elektromos áram", "Tüzelőolaj", "Szén", "Pellet, biomassza",
    "Egyéb megújuló", "Egyéb"],
  muszakiAllapot: ["Újszerű", "Jól karbantartott", "Bizonytalan működésű, elhanyagolt", "Cserére javasolt"],
  hofejlesztesJellege: ["Állandó hőmérsékletű kazán", "Alacsony hőmérsékletű kazán", "Kondenzációs kazán",
    "Nem gáztüzelésű kazán", "Égő direkt tüzeléssel", "Konvektor", "Sugárzóernyő",
    "Gázüzemű hőszivattyú", "Hőszivattyú levegő hőforrással", "Hőszivattyú talajhő hőforrással",
    "Hőszivattyú talajvíz hőforrással"],
  hoterm_szabalyozas: ["Előremenő ág hőmérsékletének tartása", "Időjáráskövető szabályozás időprogram nélkül",
    "Időjáráskövető szabályozás időprogrammal", "Egyéb"],
  vanNincs: ["Van", "Nincs"],
  szivMukodes: ["Hagyományos", "Frekvenciaváltós"],
  szivBeallitas: ["1.", "2.", "3.", "4.", "Állandó emelőmagasság", "Állandó térfogatáram", "Arányos"],
  csohalozatAnyaga: ["Acél", "Réz", "Műanyag"],
  szigetelesGepeszetiFutes: ["Nincs", "Polifoam", "Gyapot"],
  szigetelesGepeszetiHutes: ["Nincs", "Polifoam", "Gyapot", "Párazáró"],
  holeadoTipusFutes: ["Csőregiszter", "Radiátor", "Termoventilátor", "Fan-coil", "Sugárzóernyő",
    "Padló-, fal-, mennyezetfűtés", "Szellőztető gép fűtő kalorifer", "HMV tartály"],
  holeadoTipusHutes: ["Termoventilátor", "Fan-coil", "Hűtőgerenda", "Fal-, mennyezethűtés",
    "Szellőztető gép hűtő kalorifer"],
  holeadoSzabalyozasFutes: ["Szobatermosztát vagy termosztatikus szelep időprogrammal",
    "Szobatermosztát vagy termosztatikus szelep időprogram nélkül", "Keverőszeleppel működő automatikával"],
  holeadoSzabalyozasHutes: ["Szobatermosztát időprogrammal", "Szobatermosztát időprogram nélkül",
    "Keverőszeleppel működő automatikával"],
  beszabalyozoSzelep: ["Van, szabályozott értékre beállítva", "Van, de nincs megfelelően beállítva", "Nincs"],
  szellFunkcio: ["Iroda", "Előadótér", "Lakó-, szállásjellegű"],
  szellHotermelo: ["Földgázkazán", "PB kazán", "Gázégő", "Egyéb kazán", "Elektromos áram direkt", "Hőszivattyú"],
  hajtasModja: ["Direkthajtás", "Ékszíjas hajtás"],
  frekvenciavalto: ["Van, szabályozott működéssel", "Van, de nem szabályozott", "Nincs"],
  szellSzabalyozas: ["Befújt hőmérséklet tartása", "Elszívó vagy teremhőmérséklet tartása",
    "Levegőminőségre szabályozás"],
  hovisszanyeres: ["Nincs", "Keresztáramú", "Kereszt-ellenáramú", "Közvetítőközeges", "Hőszivattyús",
    "Hőcsöves", "Forgódobos"],
  csatornaSzigetelesAnyaga: ["Nincs", "Polifoam", "Szintetikus kaucsuk", "Szórt", "Egyéb"],
  kapcsolodoRendszer: ["Fűtés", "Fűtés és hűtés"],
};

// Mezőtípusok: "text", "textarea", "number", "select", "tel", "email", "checkboxgroup"
function f(key, label, type, opts) {
  return Object.assign({ key, label, type: type || "text" }, opts || {});
}

const SCHEMA = {
  alapadatok: [
    f("muszeresVizsgalatotVegzi", "Műszeres vizsgálatot végzi", "text"),
    f("telefonszam", "Telefonszám", "tel"),
    f("megrendeloMegnevezes", "Megrendelő megnevezése", "text"),
    f("megbizoBeosztasa", "Megbízó beosztása / feladata", "text"),
    f("megbizoKepviseloHelyben", "Megbízó képviselője helyben", "text"),
    f("telEmail", "Telefonszám / e-mail (helyszíni kapcsolattartó)", "text"),
  ],

  building: [
    f("nev", "Épület megnevezése", "text"),
    f("cim", "Épület címe", "text"),
    f("hrsz", "HRSZ", "text"),
    f("jellemzoHasznalat", "Jellemző használat", "select", { options: OPT.hasznalat }),
    f("futottTeruletOsszes", "Fűtött terület (összes)", "number", { unit: "m²" }),
    f("futesVan", "Felülvizsgálandó fűtési rendszer", "select", { options: OPT.rendszerSzam }),
    f("hutesVan", "Felülvizsgálandó hűtési rendszer", "select", { options: OPT.rendszerSzam }),
    f("szellozesVan", "Felülvizsgálandó szellőztető rendszer", "select", { options: OPT.rendszerSzam }),
    f("szintBelmagassag", "Szint belmagasság", "number", { unit: "cm" }),
    f("futoSzintekSzama", "A fűtött szintek száma", "number"),
    f("tetokialakitas", "Tetőkialakítás", "select", { options: OPT.tetokialakitas }),
    f("epuletKerulete", "Épület kerülete", "number", { unit: "m" }),
    f("melegvizHasznalata", "Melegvíz használata", "select", { options: OPT.melegvizHasznalat }),
    f("hmvHasznalokSzama", "HMV használók száma", "number", { unit: "fő" }),
    f("epuletEpitoanyaga", "Épület jellemző építőanyaga", "select", { options: OPT.epitoanyag }),
    f("falazatSzigeteletlenVastagsag", "Falazat szigeteletlen vastagság", "number", { unit: "cm" }),
    f("szigetelesVastagsagFalazaton", "Szigetelés vastagsága a falazaton", "number", { unit: "cm" }),
    f("nyilaszarokAranyaHomlokzaton", "Nyílászárók aránya a homlokzaton", "number", { unit: "%" }),
    f("nyilaszarokTipusa", "Nyílászárók típusa", "select", { options: OPT.nyilaszaro }),
    f("zarofodemAnyaga", "Zárófödém anyaga", "select", { options: OPT.zarofodem }),
    f("szigetelesVastagsagFodemen", "Szigetelés vastagsága a födémen / tetőhatárolóban", "number", { unit: "cm" }),
    f("megjegyzes", "Megjegyzés", "textarea"),
  ],

  heatingSystem: [
    f("futesiKorMegnevezese", "Fűtési rendszer megnevezése", "text"),
    f("futottSzintekSzama", "A fűtött szintek száma", "number"),
  ],

  heatProducer: [
    f("gyariSzam", "Gyári szám", "text"),
    f("gyarto", "Gyártó", "text"),
    f("tipus", "Típus", "text"),
    f("uzemmod", "Üzemmód", "select", { options: OPT.uzemmod }),
    f("holTalalhato", "Hol található", "select", { options: OPT.holTalalhato }),
    f("gyartasiEv", "Gyártási év", "number"),
    f("maxTeljesitmeny", "Max. teljesítmény", "number", { unit: "kW" }),
    f("minTeljesitmeny", "Min. teljesítmény", "number", { unit: "kW" }),
    f("energiahordozoTipusa", "Energiahordozó típusa", "select", { options: OPT.energiahordozo }),
    f("muszakiAllapot", "Általános jellemzés a műszaki állapotról", "select", { options: OPT.muszakiAllapot }),
    f("hofejlesztesJellege", "Hőfejlesztés jellege", "select", { options: OPT.hofejlesztesJellege }),
    f("fogyasztasmeroGyariSzama", "Fogyasztását mérő óra gyári száma", "text"),
    f("szabalyozas", "Szabályozás", "select", { options: OPT.hoterm_szabalyozas }),
    f("eloremenoHomerseklet", "Melegvizes működésnél: előremenő hőmérséklet", "number", { unit: "°C" }),
    f("visszateroHomerseklet", "Visszatérő hőmérséklet", "number", { unit: "°C" }),
    f("kazannalKondenzacio", "Kazánnál kondenzáció", "select", { options: OPT.vanNincs }),
    f("futesiKorokSzamaMegnevezese", "Fűtési körök száma, megnevezése", "text"),
  ],

  distributionNetworkHeating: [
    f("korMegnevezese", "Fűtési kör megnevezése", "text"),
    f("gyartasiEv", "Gyártási év", "number"),
    f("gyariSzam", "Gyári szám", "text"),
    f("szivattyuGyartoTipus", "Szivattyú gyártó és típus", "text"),
    f("teljFelvetel", "Teljesítményfelvétel", "number", { unit: "W" }),
    f("kiszolgaltTerulet", "Kiszolgált terület", "number", { unit: "m²" }),
    f("szivMukodes", "Szivattyú működése", "select", { options: OPT.szivMukodes }),
    f("beallitas", "Beállítás", "select", { options: OPT.szivBeallitas }),
    f("csohalozatAnyaga", "Csőhálózat anyaga", "select", { options: OPT.csohalozatAnyaga }),
    f("szigetelesGepeszetiTerben", "Szigetelés a gépészeti térben", "select", { options: OPT.szigetelesGepeszetiFutes }),
    f("szigetelesVastagsaga", "Szigetelés vastagsága", "number", { unit: "mm" }),
  ],

  heatEmitter: [
    f("tipus", "Típus", "select", { options: OPT.holeadoTipusFutes }),
    f("szabalyozas", "Szabályozás", "select", { options: OPT.holeadoSzabalyozasFutes }),
    f("beszabalyozoSzelep", "Beszabályozó szelep", "select", { options: OPT.beszabalyozoSzelep }),
    f("mennyisegDb", "Hőleadók mennyisége ezen a hálózaton", "number", { unit: "db" }),
  ],

  coolingSystem: [
    f("hutesiKorMegnevezese", "Hűtési rendszer megnevezése", "text"),
  ],

  coolingProducer: [
    f("gyariSzam", "Gyári szám", "text"),
    f("gyarto", "Gyártó", "text"),
    f("tipus", "Típus", "text"),
    f("gyartasiEv", "Gyártási év", "number"),
  ],

  distributionNetworkCooling: [
    f("korMegnevezese", "Hűtési kör megnevezése", "text"),
    f("gyartasiEv", "Gyártási év", "number"),
    f("gyariSzam", "Gyári szám", "text"),
    f("szivattyuGyartoTipus", "Szivattyú gyártó és típus", "text"),
    f("teljFelvetel", "Teljesítményfelvétel", "number", { unit: "W" }),
    f("kiszolgaltTerulet", "Kiszolgált terület", "number", { unit: "m²" }),
    f("szivMukodes", "Szivattyú működése", "select", { options: OPT.szivMukodes }),
    f("beallitas", "Beállítás", "select", { options: OPT.szivBeallitas }),
    f("csohalozatAnyaga", "Csőhálózat anyaga", "select", { options: OPT.csohalozatAnyaga }),
    f("szigetelesGepeszetiTerben", "Szigetelés a gépészeti térben", "select", { options: OPT.szigetelesGepeszetiHutes }),
    f("szigetelesVastagsaga", "Szigetelés vastagsága", "number", { unit: "mm" }),
  ],

  coolEmitter: [
    f("tipus", "Típus", "select", { options: OPT.holeadoTipusHutes }),
    f("szabalyozas", "Szabályozás", "select", { options: OPT.holeadoSzabalyozasHutes }),
    f("beszabalyozoSzelep", "Beszabályozó szelep", "select", { options: OPT.beszabalyozoSzelep }),
    f("mennyisegDb", "Hőleadók mennyisége ezen a hálózaton", "number", { unit: "db" }),
  ],

  ventilationDevice: [
    f("szelloztetettTerMegnevezese", "Szellőztetett tér megnevezése", "text"),
    f("funkcio", "Funkció", "select", { options: OPT.szellFunkcio }),
    f("gyariSzam", "Gyári szám", "text"),
    f("gyartoTipus", "Gyártó, típus", "text"),
    f("holTalalhato", "Hol található", "select", { options: OPT.holTalalhato }),
    f("gyartasiEv", "Gyártási év", "number"),
    f("meglevoElemek", "Meglévő elemek", "checkboxgroup", {
      options: ["Befúvó ventilátor", "Elszívó ventilátor", "Fűtőkalorifer", "Hővisszanyerő",
        "Keverőkamra", "Párásító szekció"],
    }),
    f("befuvasLegszallitas", "Befúvás légszállítás", "number", { unit: "m³/h" }),
    f("befuvasMotorteljesitmeny", "Befúvás motorteljesítmény", "number", { unit: "W" }),
    f("elszivasLegszallitas", "Elszívás légszállítás", "number", { unit: "m³/h" }),
    f("elszivasMotorteljesitmeny", "Elszívás motorteljesítmény", "number", { unit: "W" }),
    f("hotermelo", "Hőtermelő", "select", { options: OPT.szellHotermelo }),
    f("hajtasModja", "Hajtás módja", "select", { options: OPT.hajtasModja }),
    f("frekvenciavalto", "Frekvenciaváltó", "select", { options: OPT.frekvenciavalto }),
    f("muszakiAllapot", "Általános jellemzés a műszaki állapotról", "select", { options: OPT.muszakiAllapot }),
    f("fogyasztasmeroGyariSzama", "Fogyasztásmérő gyári száma", "text"),
    f("szabalyozas", "Szabályozás", "select", { options: OPT.szellSzabalyozas }),
    f("eloremenoHomerseklet", "Melegvizes működésnél: előremenő hőmérséklet", "number", { unit: "°C" }),
    f("visszateroHomerseklet", "Visszatérő hőmérséklet", "number", { unit: "°C" }),
    f("hovisszanyeres", "Hővisszanyerés", "select", { options: OPT.hovisszanyeres }),
    f("befuvoHalozatSzigetelesVastagsag", "Befúvó hálózat szigetelés vastagsága", "number", { unit: "mm" }),
    f("befuvoHalozatSzigetelesAnyaga", "Befúvó hálózat szigetelés anyaga", "select", { options: OPT.csatornaSzigetelesAnyaga }),
    f("elszivoHalozatSzigetelesVastagsag", "Elszívó hálózat szigetelés vastagsága", "number", { unit: "mm" }),
    f("elszivoHalozatSzigetelesAnyaga", "Elszívó hálózat szigetelés anyaga", "select", { options: OPT.csatornaSzigetelesAnyaga }),
  ],

  tempMeasurement: [
    f("hotermeloMegnevezese", "Hőtermelő megnevezése", "text"),
    f("elolMeret", "Elöl — méret", "text", { unit: "mm x mm" }),
    f("elolHomerseklet", "Elöl — hőmérséklet", "number", { unit: "°C" }),
    f("jobbMeret", "Jobb — méret", "text", { unit: "mm x mm" }),
    f("jobbHomerseklet", "Jobb — hőmérséklet", "number", { unit: "°C" }),
    f("balMeret", "Bal — méret", "text", { unit: "mm x mm" }),
    f("balHomerseklet", "Bal — hőmérséklet", "number", { unit: "°C" }),
    f("felulMeret", "Felül — méret", "text", { unit: "mm x mm" }),
    f("felulHomerseklet", "Felül — hőmérséklet", "number", { unit: "°C" }),
    f("alulMeret", "Alul — méret", "text", { unit: "mm x mm" }),
    f("alulHomerseklet", "Alul — hőmérséklet", "number", { unit: "°C" }),
    f("hatulMeret", "Hátul — méret", "text", { unit: "mm x mm" }),
    f("hatulHomerseklet", "Hátul — hőmérséklet", "number", { unit: "°C" }),
  ],

  settings: [
    f("felmeroNev", "Felmérő neve", "text"),
    f("felmeroTelefon", "Felmérő telefonszáma", "tel"),
    f("cegNev", "Cég neve", "text"),
  ],
};

function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function createBuilding() {
  return { id: uid(), heatingSystems: [], coolingSystems: [], ventilationSystems: [], tempMeasurements: [] };
}
function createHeatingSystem() {
  return { id: uid(), heatProducers: [], distributionNetworks: [], heatEmitters: [] };
}
function createCoolingSystem() {
  return { id: uid(), producers: [], distributionNetworks: [], heatEmitters: [] };
}
function createVentilationDevice() { return { id: uid() }; }
function createTempMeasurement() { return { id: uid() }; }
function createHeatProducer() { return { id: uid() }; }
function createDistributionNetwork() { return { id: uid() }; }
function createHeatEmitter() { return { id: uid() }; }
function createCoolingProducer() { return { id: uid() }; }

function createSurvey() {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    telephelyNev: "",
    alapadatok: {},
    buildings: [],
  };
}
