# Pályázatfigyelő

Egyfájlos, magyar nyelvű, vanilla HTML/CSS/JS PWA lakossági felújítási és
energetikai pályázatok (KEHOP Plusz, Otthoni Energiatároló Program, vidéki
otthonfelújítási program) nyomon követésére — jogosultság-ellenőrzéssel,
támogatás-kalkulátorral, ügyfélkezeléssel, és egy ütemezett hírfigyelővel,
ami Telegramon szól, ha valamelyik figyelt oldal tartalma megváltozik.

Nincs build lépés, nincs framework, nincs npm dependency a frontendben.
Az `data/state.json` és `data/changes.json` fájlokat a `scripts/watch.mjs`
generálja egy GitHub Action-ből.

## Gyors indulás

1. **Fork vagy klónozd** ezt a repót a saját GitHub fiókodba.
2. **Kapcsold be a GitHub Pages-t**: a repo *Settings → Pages* alatt válaszd
   forrásnak a **"GitHub Actions"**-t (nem a "Deploy from a branch"-et — a
   `.github/workflows/deploy.yml` fogja publikálni az oldalt minden `main`
   ágra történő push-nál).
3. **Vedd fel a két repository secretet** a hírfigyelő Telegram-értesítéséhez
   (*Settings → Secrets and variables → Actions → New repository secret*):
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`

   Ha ezeket nem állítod be, a figyelő attól még lefut és frissíti a
   `data/state.json` / `data/changes.json` fájlokat — csak a Telegram-üzenet
   küldését hagyja ki, hibát nem dob.
4. **Indítsd el kézzel egyszer** a figyelőt, hogy legyen kiinduló állapota:
   a repo *Actions* fülén nyisd meg a *"Pályázatfigyelő – hírfigyelő"*
   workflow-t, és nyomd meg a *"Run workflow"* gombot
   (`workflow_dispatch`). Ezután fut majd naponta kétszer automatikusan is.
5. Nyisd meg a Pages URL-t telefonon, és a böngésző menüjéből add hozzá a
   kezdőképernyőhöz — a PWA telepítve lesz, standalone módban indul.

## Telegram bot létrehozása

1. Indíts beszélgetést a Telegramban a **@BotFather**-rel, és küldd el neki
   a `/newbot` parancsot. Adj nevet a botnak, ő visszaküldi a bot **tokent**
   — ez lesz a `TELEGRAM_BOT_TOKEN` secret értéke.
2. Küldj egy tetszőleges üzenetet az újonnan létrehozott botnak (privát
   chatben), hogy legyen "beszélgetésed" vele.
3. Nyisd meg böngészőben:
   `https://api.telegram.org/bot<A_TE_TOKENED>/getUpdates`
   és keresd meg a választ JSON-ban a `"chat":{"id": ...}` mezőt — ez lesz a
   `TELEGRAM_CHAT_ID` secret értéke. (Ha csoportba szeretnéd küldeni az
   üzeneteket, add hozzá a botot a csoporthoz, és onnan küldj egy üzenetet a
   csoportban, mielőtt lekérdezed a `getUpdates`-et — a csoport chat ID-ja
   jellemzően negatív szám.)

## Új forrás felvétele a figyeléshez

A figyelt oldalak listája a [`data/sources.json`](data/sources.json)
fájlban van. Egy új bejegyzés hozzáadásához illessz be egy új objektumot a
tömbbe:

```json
{
  "id": "egyedi-azonosito",
  "name": "Megjelenített név",
  "url": "https://a-figyelendo-oldal-url-je",
  "category": "Kategória (tetszőleges)",
  "description": "Rövid leírás, mit várunk ettől a forrástól."
}
```

Az `id` legyen egyedi és ne változzon utólag — ez alapján követi a szkript
az adott forrás előző állapotát a `data/state.json`-ben. Ha egy program
kártyáján is meg szeretnéd jeleníteni, hogy ehhez a forráshoz tartozó oldal
változott, állítsd be a [`data/programs.json`](data/programs.json)
megfelelő elemének `watchUrl` mezőjét ugyanerre az URL-re.

A figyelő szándékosan **nem** CSS-szelektorokkal dolgozik, hanem az oldal
teljes szöveges tartalmának hash-elésével — így új forrás felvételekor nem
kell semmilyen oldalszerkezetet ismerned vagy szelektort írnod, elég a
puszta URL.

## Hogyan működik a hírfigyelő

A [`scripts/watch.mjs`](scripts/watch.mjs) (Node 20, natív `fetch`, nulla
külső függőség) forrásonként egy kérést küld, kiszedi a szöveget a
HTML-ből, levágja a nyilvánvalóan dinamikus részeket (időbélyegek,
sütibanner, session/csrf tokenek, copyright év), SHA-256 hash-t számol
belőle, és összeveti az előzővel. Ha változott, megnézi, hogy az újonnan
megjelent szövegrészben szerepel-e valamelyik kulcsszó: *felfüggesztés,
felfüggesztésre, visszavonás, újranyit, benyújtás, módosult, felhívás,
keretösszeg, határidő, hatályba*.

Kimenet: `data/state.json` (a legutóbbi ismert hash forrásonként — ez a
"memória" futások között) és `data/changes.json` (az adott futás
eredménye: melyik forrás változott, volt-e kulcsszavas találat, mikor).

A GitHub Action (`.github/workflows/watch.yml`) csak akkor commitolja a két
fájlt, ha ténylegesen történt valami (tartalmi változás vagy hiba) — egy
teljesen csendes, minden forrás rendben futás nem hoz létre üres commitot.
Ha egy forrás egymás után 3 alkalommal elérhetetlen, azt a szkript külön
jelzi (`staleAlerts`) — ez valószínűleg azt jelenti, hogy az oldal megszűnt
vagy átköltözött, és a `data/sources.json`-ben frissíteni kell az URL-jét.

## ⚠️ Fontos: a GitHub 60 nap inaktivitás után letiltja az ütemezett workflow-kat

A GitHub automatikusan **kikapcsolja** a `schedule`-lel (cron) indított
workflow-kat, ha a repóban **60 napig nincs semmilyen commit-aktivitás**.
A hírfigyelő saját commitjai (amikor talál változást) **nem** számítanak
ilyen aktivitásnak — csak az emberi push. Ha a repo hosszabb ideig teljesen
csendes (a figyelt oldalak sem változnak, tehát a bot sem commitol), a
schedule idővel leáll, és onnantól csak kézi `workflow_dispatch` indítja
újra.

Ezt **nem** próbáljuk trükkel megkerülni (pl. üres commitok generálásával).
Két tiszta megoldás van:

1. **Havi kézi commit** — akár egy triviális, pl. a README egy sorának
   frissítése havonta egyszer, ami már valódi emberi aktivitásnak számít.
2. **Külső cron-ping** — egy külső időzítő szolgáltatás (pl. cron-job.org,
   GitHub Actions egy másik repóból, vagy bármilyen szerver `cron`-ja)
   időnként meghívja a GitHub REST API-t, hogy elindítsa a workflow-t
   (`POST /repos/{owner}/{repo}/actions/workflows/watch.yml/dispatches`,
   `Authorization: Bearer <personal access token>` fejléccel) — ez a hívás
   maga nem commit, tehát önmagában nem tartja életben az ütemezést, de ha
   a hívás nyomán a figyelő tényleges változást talál és commitol, az már
   számít. A legbiztosabb ezért az 1. opció.

## Adatvédelem

Az ügyféladatok (`pf:projects`, `pf:checks`) és a jogosultsági válaszok
(`pf:answers`) kizárólag a böngésződ `localStorage`-ában élnek. Ezek soha
nem kerülnek a repóba, szerverre, vagy a hírfigyelőbe — a figyelő kizárólag
a `data/sources.json`-ben felsorolt nyilvános oldalakat olvassa.

## Helyi fejlesztés

Nincs build lépés. Bármilyen statikus fájlszerverrel kiszolgálható, pl.:

```sh
npx serve .
# vagy
python3 -m http.server 8080
```

A hírfigyelő önállóan futtatható:

```sh
node scripts/watch.mjs
```

## Struktúra

```
palyazatfigyelo.html      – az app (5 fül: Pályázatok, Jogosultság, Kalkulátor, Ügyfelek, Források)
index.html                 – átirányítás a palyazatfigyelo.html-re (GitHub Pages gyökér)
manifest.json, sw.js       – PWA manifest és service worker
icons/                     – app ikonok (192/512/maskable/apple-touch)
data/programs.json         – figyelt pályázati programok
data/sources.json          – figyelt hírforrások (a watch.mjs ezt olvassa)
data/state.json            – a figyelő állapota futások között (a workflow generálja)
data/changes.json          – az utolsó futás eredménye (a workflow generálja)
scripts/watch.mjs          – a hírfigyelő szkript
scripts/notify-telegram.mjs – Telegram-értesítés a changes.json alapján
.github/workflows/watch.yml  – ütemezett + kézi hírfigyelő futtatás
.github/workflows/deploy.yml – GitHub Pages publikálás main push-nál
```
