# Technische Dokumentation

*[English version →](TECHNICAL.md)*

Diese Datei beschreibt, **wie** das Toolkit rechnet und **woher** jede Zahl
stammt. Für Installation und ersten Überblick siehe die
[README im Projektstamm](../README.de.md).

> Dieses Werkzeug ist ein privates Projekt und **nicht mit Sandbox Interactive
> verbunden**. Albion Online sowie die Item-Namen und -Grafiken gehoeren
> Sandbox Interactive GmbH. Preise stammen vom crowdsourcten
> [Albion Online Data Project](https://www.albion-online-data.com/).

## Starten

`index.html` doppelklicken. Fertig.

> Nach einer Aktualisierung einmal **Strg + F5** drücken, sonst zeigt der Browser
> die alte Fassung aus dem Cache.

## Aufbau

```
index.html              Hülle: Sidebar, Kopfzeile, View-Container
css/
  tokens.css            Farben, Abstände, Radien – alle Design-Werte an einem Ort
  base.css              Reset, Typografie, Formularelemente
  layout.css            Sidebar, Topbar, Raster, Breakpoints
  components.css        Karten, Tabellen, Buttons, Chips, Kennzahlen
js/
  core/
    format.js           Zahlen-, Datums- und Textformatierung (deutsch)
    store.js            Einstellungen dauerhaft im Browser
    market.js           Marktpreise laden, zwischenspeichern, eigene Preise
    ui.js               DOM-Helfer, Segment-Schalter, Kurzmeldungen
    craft.js            Crafting-Mathematik (Kosten, Rückgabe, Steuern, Gewinn)
    router.js           Sidebar-Navigation und Hash-Routing
    i18n.js             Sprache: Item-Namen und Oberfläche (de/en/es)
  views/
    _craftview.js       Gemeinsame Komponente für Refining / Crafting / Kochen / Tränke
    batch.js            Serien-Rechner: ganze Kategorie mit eigenen Preisen
    upgrade.js          Aufwertungs-Rechner (Runen/Seelen/Relikte)
    craftscan.js        Craft-Chancen (alle herstellbaren Gegenstände)
    opportunity.js      Chancen-Suche mit vollständigem Handelsweg
    refining.js         Refining-Rechner (Konfiguration, ~50 Zeilen)
    …                   je eine Datei pro Werkzeug
  app.js                Start: Sidebar verdrahten, Router starten
data/
  meta.js               Server, Städte, Boni, Konstanten
  items.js              1.530 Ausrüstungsrezepte
  refining.js           35 Refining-Rezepte (T2–T8, alle 5 Ressourcen)
  consumables.js        84 Rezepte für Nahrung und Tränke
  fish.js               Fischsoßen und Seetang
  upgrade.js            Aufwertungsrezepte (Runen, Seelen, Relikte)
  materials.js          Materialien mit Item-Werten
  categories.js         Kategoriebezeichnungen
  sprachen.js           Wörterbuch der Oberfläche (deutsch → en/es)
```

### Warum `data/*.js` statt `data/*.json`

Browser blockieren `fetch()` auf lokale Dateien (`file://`) aus Sicherheitsgründen.
Die Dateien enthalten deshalb reines JSON, das einer globalen Variablen zugewiesen
und per normalem `<script>`-Tag geladen wird. Inhalt und Struktur sind identisch zu
JSON – nur die Hülle unterscheidet sich. Aus demselben Grund werden **keine
ES-Module** verwendet: `<script type="module">` scheitert bei `file://` an CORS.

### Neues Werkzeug ergänzen

1. `js/views/meintool.js` anlegen und `AO.views.meintool = { id, title, subtitle, html(), mount(root) }` setzen
2. In `index.html` ein `<script src="js/views/meintool.js"></script>` ergänzen
3. In `js/core/router.js` einen Eintrag in `NAV` hinzufügen

Crafting-ähnliche Rechner brauchen keine eigene Logik – `AO.craftView({…})`
konfigurieren genügt (siehe `js/views/cooking.js`, 15 Zeilen). Refining, Crafting,
Kochen und Tränke teilen sich diese eine Komponente, sind also identisch bedienbar.
Optionale Bausteine: `ench`, `quality`, `blackMarket`, `selfCraft`, `overview`,
`bonusCityOf`, `familyName`.

## Hideout-Crafting

Hideouts haben **keine feste Rückgaberate** – sie hängt von Zonenqualität und
Power-Cores ab. Deshalb wird der Wert nicht geraten, sondern eingetragen: die
Station im Hideout zeigt einen **Produktionsbonus** in Prozent, daraus rechnet
das Toolkit die Rückgaberate.

Die Umrechnung ist die offizielle Formel `RRR = B / (1 + B)`, gegengerechnet an
allen vier bekannten Werten:

| Produktionsbonus B | Rückgaberate | entspricht |
|---|---|---|
| 58 % | 36,7 % | Bonus-Stadt |
| 77 % | 43,5 % | Fokus |
| 117 % | 53,9 % | Bonus-Stadt + Fokus |

Fokus addiert rund **+59 Prozentpunkte** auf den Bonus. (Der Grundbonus beträgt
genau genommen ~17,93 % und wird im Spiel als 18 % angezeigt – daher dort 15,2 %
statt rechnerisch 15,3 %.)

In der Rückgaberate-Auswahl von Refining-, Crafting-, Serien- und
Chancen-Rechner stehen dafür **Hideout** und **Hideout + Fokus**. Der Bonus wird
einmal eingetragen und gilt überall; ändern lässt er sich auch unter
*Einstellungen*. Die Stationsgebühr (im eigenen Hideout oft 0) stellt man wie
gewohnt im Feld „Gebühr /100 NW" ein.

Auch der **Fokus-Rechner** kennt den Hideout: dort wählt man den Herstellungsort
(Ohne Bonus / Stadtbonus / Hideout) und sieht sofort, was ein Fokuspunkt an
diesem Ort in Silber wert ist.

Nicht vergessen: im Hideout gibt es keinen Markt – verkauft wird in einer Stadt
oder am Schwarzmarkt, der Transport dorthin ist im Rechner nicht enthalten.

## Eigene Preise gelten sofort und überall

Ein selbst eingetragener Preis – ein Relikt, eine Seele, ein Barren – gilt im
**ganzen Toolkit**, nicht nur in der Ansicht, in der er eingetippt wurde. Damit
das auch sichtbar wird, meldet jede Preisänderung sich einmal gebündelt
(`ao:prices`, 120 ms) beim Rest der Oberfläche:

* **Die sichtbare Ansicht rechnet sofort nach** – in der Aufwertung inklusive
  der kompletten Flip-Liste darunter. Ein geänderter Runenpreis schlägt also
  durch alle gefundenen Wege durch, nicht nur durch die Detailrechnung.
* **Verborgene Ansichten** werden vorgemerkt und rechnen beim nächsten Aufruf
  nach. Würden alle fünfzehn bei jedem Tastenanschlag mitrechnen, würde die
  Eingabe zäh.
* **Während getippt wird**, baut sich das Eingabefeld nicht neu auf. Ein
  Neuaufbau würde die halb eingetippte Zahl auf den gespeicherten Stand
  zurücksetzen; er wird deshalb bis zum Verlassen des Feldes aufgeschoben. Die
  abhängigen Zahlen laufen trotzdem bei jedem Zeichen mit.

Nachgemessen am Crafting-Rechner: Eintippen von „54321" ändert die
Materialkosten bei jedem einzelnen Zeichen mit (350.733 → 417.216 → 1.080.691
→ 7.714.086 → 74.046.682), das Feld behält Inhalt und Schreibmarke. In der
Aufwertung springt ein Runenpreis von 5.000 die Materialspalte der Flip-Liste
von 3.168 auf 1.440.000 (288 Runen × 5.000) – ohne neue Suche.

Technisch hängt daran auch ein Fehler weniger: Der Zwischenspeicher der
Flip-Liste hat sich früher an der **Anzahl** eigener Preise orientiert. Die
ändert sich nicht, wenn ein bestehender Wert korrigiert wird – die Liste blieb
stehen. Jetzt zählt ein Revisionszähler (`AO.market.rev()`) jede Änderung.

## Drei Sprachen

Deutsch, Englisch, Spanisch – umschaltbar in der Kopfzeile, die Wahl hält
sich. Beim Umschalten lädt die Seite einmal neu, weil die Ansichten ihre
Namen im HTML stehen haben.

### Die Item-Namen kommen aus dem Spiel

Das ist der Kern: die Namen sind **nicht übersetzt**, sondern aus der
Lokalisierung des Spielclients übernommen (`ao-bin-dumps/formatted/items.json`).
Im Werkzeug steht also genau der Name, den man auch im Spiel sieht:

| | |
|---|---|
| Deutsch | Breitschwert des Adepten |
| English | Adept's Broadsword |
| Español | Espada ancha del iniciado |

Jeder Gegenstand führt in `data/items.js` drei Namen: `n` englisch, `d`
deutsch, `s` spanisch. Beim Umschalten setzt `js/core/i18n.js` das Feld `n`
auf die gewählte Sprache – die Ansichten lesen weiterhin einfach `.n` und
mussten dafür nicht angefasst werden. Das englische Original bleibt in `_en`
erhalten, damit das Umschalten beliebig oft in jede Richtung geht.

Spanische Namen liegen für **1.530 von 1.530** Ausrüstungsgegenständen vor,
ebenso für alle Materialien, Speisen, Tränke und raffinierten Rohstoffe.
Zehn Einträge ohne jeden Spielnamen (interne Prototypen) sind bei der
Gelegenheit aus dem Bestand geflogen – ein Gegenstand ohne Albion-Namen
gehört nicht in eine Liste, die nach Albion-Namen sucht.

Kategorienamen („Dolche", „Stoff – Roben") sind dagegen **unsere** Ordnung,
nicht die des Spiels. Sie stehen dreisprachig in `data/categories.js`.

### Die Oberfläche

Die sechzehn Ansichten bauen ihr HTML mit deutschen Texten. Statt sie alle
umzuschreiben – und dabei geprüfte Rechenwege anzufassen – übersetzt
`js/core/i18n.js` den **fertig gezeichneten Baum**: ein Wörterbuch in
`data/sprachen.js` bildet den deutschen Text auf die Übersetzung ab, ein
`MutationObserver` erfasst auch alles, was später nachgezeichnet wird.

Der Nebeneffekt ist genau der gewünschte: **was nicht im Wörterbuch steht,
bleibt unangetastet** – Item-Namen und Zahlen können gar nicht versehentlich
übersetzt werden.

Abgedeckt sind Navigation, Ansichtstitel, Spaltenüberschriften,
Feldbeschriftungen, Knöpfe, Schalter, Chips, Tooltips, die Fußzeile **und die
langen Erklärtexte** – **614 Wörterbucheinträge**.

### Sätze mit Zahlen darin

Ein Teil der Texte trägt Werte in sich, die sich bei jedem Neuzeichnen
ändern: „Bei 9 von 51 Wegen liegt …", „1.234 Stück in drei Wochen über alle
Städte". Solche Sätze lassen sich nicht über einen festen Schlüssel treffen.

Deshalb kennt das Wörterbuch **Muster mit Platzhaltern**: `{n}` für eine
Zahl, `{name}` für einen Item- oder Stadtnamen. Beim ersten Treffer wird
daraus ein regulärer Ausdruck, die gefundenen Stücke wandern der Reihe nach
in die Übersetzung, und das Ergebnis wird gemerkt – eine Tabelle mit hundert
Zeilen bringt denselben Tooltip hundertmal mit.

```
"{n}Stück in drei Wochen über alle Städte"
   → "1.234 units in three weeks across all cities"
   → "1.234 unidades en tres semanas en todas las ciudades"
```

Passen mehrere Muster, gewinnt das genauere – gemessen an der Länge des
Schlüssels. Sonst hätte `{n}Stück` den längeren Satz
`für {n}Stück · — je Stück` verschluckt.

Von den 614 Einträgen sind **87 solche Muster**.

### Nachgemessen statt behauptet

Geprüft wurde nicht die Wörterbuchgröße, sondern das Ergebnis: alle sechzehn
Ansichten durchlaufen, mit geladenen Marktdaten und einmal komplett
durchgeführtem Craft- und Aufwertungs-Scan, dann jedes Textstück im Baum
gegen die Item-Namen der jeweiligen Sprache gehalten. Übrig bleiben in
**Englisch wie Spanisch nur Zahlen, Stadtnamen und Item-Ids** – kein
deutscher Satz mehr.

Drei Dinge kamen dabei ans Licht, die eine reine Wortzählung nie gezeigt
hätte:

* Tooltips, die erst **nach** dem Einhängen gesetzt werden, lösen keine
  `childList`-Meldung aus – der Beobachter achtet jetzt auch auf `title`,
  `placeholder` und `aria-label`.
* `querySelectorAll` findet nur Nachfahren. Reicht der Beobachter genau die
  eine Tabellenzeile herein, die den Tooltip trägt, muss der Wurzelknoten
  selbst mitgeprüft werden – das betraf 1.296 Zeilen-Tooltips.
* In „z. B." steht ein geschütztes Leerzeichen. Zum Nachschlagen wird
  vereinheitlicht, ersetzt wird aber das Original.

Die Zusammenfassungszeile der Scans („… mit Gewinn · 892 ohne vollständige
Preise ausgelassen · …") setzt sich aus Teilstücken zusammen, von denen jedes
wegfallen kann – 32 mögliche Wortlaute. Statt sie alle aufzuschreiben, steht
jedes Teilstück jetzt in einem eigenen `<span>` und wird einzeln übersetzt.

## Aussehen: nach den echten Albion-Werten

Die Oberfläche ist vollständig neu gestaltet – nicht nach Gefühl, sondern nach
Werten, die aus offiziellen Quellen stammen: aus Screenshots von Sandbox
Interactive gemessen, aus dem Item-Renderer `render.albiononline.com`
abgegriffen, aus dem Stylesheet von `albiononline.com` gelesen und aus einer
Dev-Antwort im offiziellen Forum übernommen.

Drei meiner ursprünglichen Annahmen waren dabei **falsch** und wurden
korrigiert:

| Angenommen | Belegt |
|---|---|
| Dunkles Stein/Schiefer als Fenstergrund | **Warmes Pergament** `#eac7a1` → `#9e745e` mit breitem dunkelbraunem Rahmen `#42332c` |
| Roter „Buy"-Knopf | Knopfe sind **dunkle Schieferpillen** `#2b2b33` → `#1a1917` mit Goldschrift `#e8d66a`. Rot bedeutet im Marktfenster etwas anderes: *du zahlst über Durchschnitt* |
| „Albion ist eckig" | Fenster sind **deutlich gerundet**, rund 16–20 px bei 420 px Fensterbreite |

### Farben und Schriften

**Tier-Farben** stammen aus einer Dev-Antwort im offiziellen Forum und wurden
durch Messung am Item-Renderer bestätigt:
T1 `#484047` · T2 `#635349` · T3 `#3f5131` · T4 `#355f78` · T5 `#77221a` ·
T6 `#c9712c` · T7 `#d1b044` · T8 `#d0d0d0`.

**Verzauberungsfarben** aus dem offiziellen Wiki (`Template:Enchantment
color`): .1 `#6bff91` · .2 `#49f1ff` · .3 `#bd89ff` · .4 `#ffb702`. Sie
färben jetzt die Nachkommastelle der Tier-Marke, genau wie im Spiel.

**Schriften:** Lora (Überschriften) und Open Sans (Flächentext) – beides setzt
Sandbox Interactive auf der eigenen Website ein. Die Schrift der
Spieloberfläche selbst ist nirgends dokumentiert; vier Forumsthreads dazu
bleiben ohne Antwort, deshalb wird hier nicht geraten.

**Keine einzige Ansicht musste angefasst werden.** Alle Klassennamen sind
unverändert; getauscht wurden nur die vier CSS-Dateien. Der Kniff steckt in
den Tokens: `:root` trägt die helle Pergamentwelt, und `.sidebar, .topbar`
definieren **dieselben Variablennamen** mit Rahmenbraun neu – dadurch färben
sich alle Bausteine darin von selbst um.

### Vier Schalter in der Kopfzeile

| Schalter | Wirkung |
|---|---|
| **Hell / Dunkel** | Pergament oder durchgehend dunkel |
| **Farben / Kontrast** | siehe unten |
| **Normal / Kompakt** | entscheidet, ob breite Tabellen auf den Bildschirm passen |
| **Spalte weg** | blendet die Einstellungsspalte aus, gibt den Tabellen ~340 px |

Alle merken sich ihren Zustand und hängen an Attributen auf `<html>`, damit
CSS allein die Arbeit macht.

### Kontrastmodus für Rot-Grün-Schwäche

Gewinn grün und Verlust rot ist genau die Unterscheidung, die bei einer
Rot-Grün-Schwäche nicht funktioniert – und es ist die wichtigste Zahl im
ganzen Werkzeug. Der Kontrastmodus ersetzt sie durch die Palette von **Okabe
und Ito**, die ausdrücklich für Farbfehlsichtigkeit entworfen wurde:

| | hell | dunkel |
|---|---|---|
| Gewinn | Blau `#005b8f` | Himmelblau `#56b4e9` |
| Verlust | Zinnober `#b34e00` | Orange `#e69f00` |
| Warnung | Violett `#6d2a83` | Rosa `#cc79a7` |

Zusätzlich bekommen Gewinn und Verlust ein **▲ bzw. ▼** vorangestellt – damit
die Unterscheidung auch völlig ohne Farbe funktioniert. Auch die Tier-Marken
weichen aus, denn T2 ist grün und T5 rot.

Nachgemessen in allen vier Kombinationen aus Ansicht und Farbmodus:
Kontrastwerte zwischen **5,0:1 und 10,1:1** – durchweg über der Schwelle von
4,5:1.

### Alles passt auf den Bildschirm

Vorher schoben die breiten Ergebnistabellen die ganze Seite waagerecht auf –
bis zu **862 px**. Zwei Ursachen, beide behoben:

1. Rasterfelder haben von Haus aus `min-width: auto` und schrumpfen nicht
   unter ihren Inhalt. Mit `min-width: 0` scrollt jetzt die Tabelle in ihrem
   eigenen Kasten statt der Seite.
2. Der Bronzebeschlag lag als Pseudo-Element mit negativem `inset` außerhalb
   der Karte und zählte zum scrollbaren Bereich. Jetzt ist er ein Schattenring
   – der beansprucht keinen Platz.

Danach blieben die beiden 14-spaltigen Tabellen übrig. **Kompakt** ist deshalb
die Vorgabe: kleinere Innenabstände, umbrechende Namensspalte, keine Item-IDs
unter dem Namen, kleinere Bilder. Gemessen bei 1920×1080: **kein einziger
Tabellenüberlauf in allen 16 Ansichten.**

### Übersichtlicher

* **Navigation nach Aufgabe** statt nach Herkunft: *Wo lohnt es sich?* –
  *Rechner* – *Werkzeuge*, davor die Übersicht, dahinter die Einstellungen.
* **Aufklappbare Tafeln**: große Zusatztabellen lassen sich zuklappen, der
  Zustand hält sich je Ansicht. Der Inhalt bleibt im DOM, damit die
  Rechnungen weiterlaufen.
* **Zweistufige Filterleisten**: das Wichtige in der ersten Zeile, das Feine
  hinter „Mehr Filter". In den Craft-Chancen und der Aufwertung standen
  vorher bis zu zehn Bedienelemente nebeneinander.

## Gewinnübersicht in den Einzelrechnern

Unter jedem Einzelrechner steht jetzt **„Was lohnt sich gerade?"** – eine
Tabelle, die **jeden Gegenstand dieser Ansicht** mit den Einstellungen links
durchrechnet: gleiche Städte, gleiche Rückgaberate, gleiche Gebühr, gleiche
Verzauberung. Ein Klick auf eine Zeile übernimmt sie nach oben in die
Detailrechnung.

Sie sitzt im gemeinsamen Rechnerkern, gilt also für **Kochen, Refining,
Crafting und Tränke** gleichermaßen. Spalten: Material, Gebühr, Kosten je
Stück, Verkauf, **verkauft/Tag**, Datenalter, Gewinn je Stück, Marge und
Silber je Fokuspunkt. Sortierbar nach Gewinn, Marge oder Fokus.

### Warum die Handelszahlen mitkommen

Ein erster Entwurf lud nur Preise. Die Liste wurde dann von Nischenware
angeführt: *Avalonian Chicken Omelette* mit **733 % Marge** – und keiner
Angabe, ob das je jemand kauft. Deshalb holt die Übersicht die Handelszahlen
der Erzeugnisse gleich mit; das ist eine einzige zusätzliche Abfrage, weil es
nur um die Gegenstände dieser Ansicht geht.

Mit den Zahlen sortiert sich das Bild von selbst:

| Gericht | Marge | verkauft/Tag |
|---|---|---|
| Avalonian Chicken Omelette T3 | 733,4 % | **2,6** |
| Avalonian Pork Omelette T7 | 29,8 % | **353,9** |
| Avalonian Beef Stew T8 | 16,1 % | **846,1** |

Die kleinste Marge ist hier das beste Geschäft. Zeilen unter einem verkauften
Stück je Tag stehen in Warnfarbe.

Laufzeit: Kochen und Tränke unter einer Sekunde, der Crafting-Rechner mit 834
vollständigen Rechnungen rund **3 Sekunden**. Gegengerechnet: ein Klick auf
*Avalonian Pork Omelette* zeigt oben exakt dieselben Zahlen wie die Zeile
(50.189 Kosten, 69.694 Verkauf, +14.975, 29,8 %).

Die vollständige Prüfung – Marktwert, Fantasieangebote, Datenalter als harte
Bedingung, alle Warengruppen auf einmal – bleibt den **Craft-Chancen**
vorbehalten. Die Übersicht hier ist der schnelle Blick, nicht der Ersatz.

## Verzauberte Tränke

Tränke lassen sich verzaubern – im Spiel als **T8.1**, **T7.2**, **T8.3** und
so weiter. Der Toolkit kannte bisher nur die Grundstufe.

Die Bauart unterscheidet sich von der bei Ausrüstung. Ein verzaubertes
Schwert nimmt dieselben Zutaten in verzauberter Form (`T4_METALBAR_LEVEL1`).
Ein verzauberter Trank dagegen nimmt **das unveränderte Grundrezept plus ein
Arkanes Extrakt**:

| Stufe | zusätzlich | Fokus (T8-Sammeltrank) |
|---|---|---|
| .0 | – | 1.319 |
| .1 | 90 × Einfaches Arkanes Extrakt | 1.520 |
| .2 | 90 × Verfeinertes Arkanes Extrakt | 1.920 |
| .3 | 90 × Reines Arkanes Extrakt | 3.121 |

Mengen und Ausbeute der übrigen Zutaten bleiben gleich. Eine Stufe **.4 gibt
es nicht** – für sie führt das Spiel kein Trank-Rezept. Die Stufenleiste im
Trank-Rechner zeigt deshalb nur `.0` bis `.3`, und die Craft-Chancen prüfen
bei „alle" entsprechend nur diese Stufen.

Weil das Rezept je Stufe ein eigenes ist, liegen die Zutatenlisten in
`data/consumables.js` unter `re` (ein Eintrag je Stufe). `AO.craft.recipeFor()`
wählt aus, `AO.craft.enchMax()` nennt die höchste Stufe.

Belegt aus `items.xml`: alle 40 Tränke führen einen `<enchantments>`-Block mit
den Stufen 1 bis 3. Nachgerechnet am T8-Sammeltrank .3 in Martlock
(Stadtbonus 36,7 %, Gebühr 800, Premium, 10 Crafts): Material 18.820.387,
Nutzungsgebühr 129.600, Verkauf 209.959 je Stück – Gewinn **681.180**, von
Hand und im Rechner auf den Silber gleich.

### Die seltene Zutat kommt nicht zurück

Jedes Trank-Rezept enthält eine seltene Alchemie-Zutat – Geisterpfoten,
Runensteinzahn und ähnliche. Auf sie wurde bisher die Rückgaberate
angewendet, was den Einkauf zu billig rechnete.

Die Spieldaten sagen es ausdrücklich:

```xml
<craftresource uniquename="T7_ALCHEMY_RARE_ELEMENTAL" count="1" maxreturnamount="0" />
```

`maxreturnamount="0"` heißt: nie zurück. **21 Zutaten** tragen das Merkmal
(sieben Familien × T3/T5/T7); sie sind jetzt wie Artefakte markiert. Bei einem
Lauf über 10 Crafts mit 36,7 % Rückgabe schlägt das voll durch: 10 Stück
statt gerechneter 6,33.

Dasselbe Merkmal steht auch an **verzauberten Rohstoffen in
Ausrüstungsrezepten** (`T4_METALBAR_LEVEL1` und ähnliche, rund 250 Einträge).
Ob das im Spiel wirklich bedeutet, dass sie beim Craften nicht zurückkommen,
ist hier nicht nachgeprüft – deshalb bleibt es dort vorerst unangetastet.

### Nicht jedes „_LEVEL" trägt am Markt ein „@"

Beim Nachtragen fiel eine zweite Sache auf. Raffinierte Rohstoffe heißen am
Markt `T4_METALBAR_LEVEL1@1`; das Arkane Extrakt und die Fischsauce dagegen
schlicht `T1_ALCHEMY_EXTRACT_LEVEL1`. Beide Formen wurden gegen die API
geprüft – die jeweils andere hat in **keiner** Stadt ein Angebot:

| | ohne `@` | mit `@` |
|---|---|---|
| `T4_CLOTH_LEVEL1`, `T4_ROCK_LEVEL1`, `T5_HIDE_LEVEL2`, `T6_WOOD_LEVEL1` | 0 Angebote | 6 Angebote |
| `T1_ALCHEMY_EXTRACT_LEVEL2`, `T1_FISHSAUCE_LEVEL2` | 3 bzw. 6 Angebote | 0 |

Die Umschreibung in `AO.market.marketId()` prüft deshalb ein Merkmal `pm` am
Material, statt die Endung allein zu betrachten.

## Wie viele Stufen ein Gericht hat

Im Koch-Rechner wirkt die Stufenleiste kurz – beim Salat stehen dort nur
**T2, T4 und T6**. Das ist kein fehlender Datensatz: jedes Gericht existiert im
Spiel auf genau drei Stufen, und welche das sind, unterscheidet sich je Gericht.
Am Dump gegengeprüft:

| Gericht | Stufen |
|---|---|
| Suppe | T1, T3, T5 |
| Salat | T2, T4, T6 |
| Omelett, Pastete, Braten | T3, T5, T7 |
| Sandwich, Eintopf | T4, T6, T8 |
| Gegrillter Fisch, Seetangsalat | nur T1 |

Damit das nicht mehr nach einer Lücke aussieht, steht unter der Stufenleiste
jetzt ausdrücklich, welche Stufen es für den gewählten Gegenstand gibt –
„Turnip Salad gibt es im Spiel nur auf den Stufen T2, T4 und T6."

### Neu: die avalonischen Gerichte

Tatsächlich gefehlt haben **9 Gerichte**: Avalonisches Omelett (T3/T5/T7),
Sandwich und Eintopf (je T4/T6/T8). Sie kamen erst nach dem letzten
Auslesevorgang ins Spiel. Nachgetragen samt Rezept, Fokuskosten und
Stapelgröße – ein Craft ergibt jeweils 10 Stück.

Dazu kam ein neues Material: **Avalonische Energie**
(`QUESTITEM_TOKEN_AVALON`, Item-Wert 64). Sie ist voll handelbar – Angebote
zwischen 4.370 und 4.953 in allen Städten.

Eine Annahme darin ist nicht belegbar: ob die Energie beim Craften über die
Rückgaberate zurückkommt. Der Dump kennt dafür keine Kennzeichnung – die
bisherige Regel im Toolkit stammt aus `shopcategory="artefacts"`, und ein
Token fällt nicht darunter. Angesetzt ist deshalb **kein Rücklauf**, was die
Gerichte eher zu teuer als zu billig rechnet.

Gegengerechnet: Avalonian Goat Sandwich T4, Item-Wert 1.200 = 4×Brot(40) +
8×Ziegenfleisch(40) + 2×Butter(40) + 10×Energie(64).

## Datenbestand

Die Gegenstandsdaten stammen aus den offiziellen Spieldaten (`ao-bin-dumps`)
und werden nicht von Hand gepflegt. Beim Nachtragen des **Tracking-Toolkits**
(`T3–T8_2H_TOOL_TRACKING`, je 2 Planken + 6 Leder, Fokus 245 bis 4.021) fiel
auf, dass der Auslesevorgang nur die XML-Typen `<weapon>` und
`<equipmentitem>` kennt. Alles, was unter einem eigenen Typ steht, fehlte.

Abgleich des heutigen Dumps gegen den Bestand – inzwischen sind
**209 Gegenstände nachgetragen**:

| fehlt | Anzahl | Ursache |
|---|---|---|
| ~~Gestaltwandler-Stäbe~~ | ~~41~~ | eigener Typ `<transformationweapon>` – **nachgetragen** |
| ~~Avalonische Werkzeuge~~ | ~~35~~ | kamen erst nach dem letzten Auslesevorgang – **nachgetragen** |
| ~~Fraktions- und Artefakt-Umhänge~~ | ~~79~~ | ohne `craftingcategory` – **nachgetragen** |
| ~~Royal-Rüstungen~~ | ~~45~~ | dieselbe Ursache – **nachgetragen** |
| ~~Avalonische Speisen~~ | ~~9~~ | neu im Spiel – **nachgetragen** |
| Reparatur-Kits | 5 | eigener Typ `<furnitureitem>` |
| T1-Ausrüstung | 2 | bewusst ausgeschlossen (`t >= 2`) |

Damit ist die Lücke geschlossen. Ein erneuter Abgleich gegen den Dump findet
nur noch **10 fehlende Gegenstände, und alle sind T1** – die Stufe, die seit
Beginn bewusst ausgeschlossen ist (`t >= 2`), weil sie handelsmäßig keine
Rolle spielt.

### Nachgetragen: 76 Gegenstände

**41 Gestaltwandler-Stäbe** (T3–T8, sechs Familien: Werwolf, Eber, Panther,
Blütenlurch, Kristall und Avalon) und **35 avalonische Werkzeuge** (T4–T8:
Axt, Spitzhacke, Sichel, Abhäutemesser, Steinhammer, Angel, Belagerungshammer)
– samt Rezept, Fokuskosten für alle fünf Verzauberungsstufen und der Angabe,
welche Materialien verzauberbar sind.

Dazu kamen **26 Materialien**, davon 25 Gestaltwandler-Artefakte mit
Item-Werten aus dem Dump, alle als *kein Rücklauf* markiert.

Eine Zutat bleibt ohne Item-Wert: **Rare Animal Remains**
(`T1_ALCHEMY_COMMON`) führt im Dump weder einen `itemvalue` noch ein Rezept.
Sie ist trotzdem eingetragen, aber **ohne Wert** – dann meldet der Rechner sie
ausdrücklich als fehlend, statt eine Zahl zu erfinden. Betroffen ist genau ein
Gegenstand, der *Journeyman's Werewolf Staff*. Dasselbe gilt für die schon
länger bekannten *Rugged Werewolf Fangs*.

Gegengerechnet am *Adept's Bloodmoon Staff*: 20×Planken(16) + 12×Leder(16) +
1×Artefakt(128) = **640**, die Werwolf-Zähne fehlen ausgewiesen.

### Nachgetragen: Umhänge und Royal-Rüstungen

**124 weitere Gegenstände**: 79 Fraktions- und Artefakt-Umhänge (Morgana,
Untote, Dämonen, Keeper, Häretiker, Avalon, Schmuggler und die sieben
Stadtfraktionen) sowie 45 Royal-Rüstungsteile (alle drei Rüstungsarten × Kopf,
Rumpf, Schuhe × T4–T8).

Diese Einträge führen im Dump **kein `craftingcategory`-Attribut**, und genau
darauf stieg der Auslesevorgang aus. Die Ersatzregel ist am Dump nachgeprüft
und braucht nichts zu raten:

1. `craftingcategory`, wenn vorhanden – wie bisher
2. sonst `shopsubcategory1`, wenn sie einer unserer Kategorien entspricht.
   Bei Rüstungen steht dort wörtlich `plate_armor`, `cloth_helmet`,
   `leather_shoes` – also genau unsere Namen
3. sonst `cape`, wenn `shopcategory="capes"`. Umhänge führen dort
   `accessoires_capes_<fraktion>` oder `other`

Von den 124 kam die Kategorie 79-mal über Regel 3 und 45-mal über Regel 2.

#### Ein Fallstrick beim Item-Wert

Royal-Rüstung wird aus der **fertigen Basisrüstung** plus vier Königlichen
Siegeln gecraftet. Die Basisrüstung ist also Zutat und musste in die
Materialtabelle – sie führt aber selbst keinen Item-Wert, der ergibt sich
erst aus ihrem eigenen Rezept.

Mein erster Anlauf lieferte für all diese Teile keinen Wert. Ursache: ein
`<craftresource uniquename="X" />` ist selbstschließend und trägt denselben
Namen wie das echte Element. Mein Rezept-Index griff diese Verweise mit ab und
fand dadurch nie das zugehörige Rezept. Nach dem Ausschluss selbstschließender
Tags rechnet es durch:

* *Adept's Soldier Armor* = 16 × Stahlbarren(16) = **256**
* *Adept's Royal Armor* = Basisrüstung(256) + 4 × Siegel(16) = **320**
* *Adept's Avalonian Cape* = Umhang(128) + Wappen(32) + 15 × Energie(64) = **1.120**

Ohne Item-Wert bleiben nur fünf **Fraktions-Marken** – die sind Währung, kein
Handwerkserzeugnis, und der Dump führt weder Wert noch Rezept dafür. Sie sind
eingetragen, aber ohne Wert; der Rechner weist sie ausdrücklich als fehlend
aus.

In den Craft-Chancen tragen sie sofort: *Expert's Royal Jacket* +134.128
(42,6 %), *Adept's Undead Cape* +121.269 (86,9 %).

## Craft-Chancen

Derselbe Sofortblick wie die Flip-Suche, nur fürs Herstellen: Material in
einer Stadt kaufen, mit Rückgabe und Stationsgebühr craften, verkaufen – und
in einer Zeile sehen, was übrig bleibt. Durchsucht werden **alle 1.672
herstellbaren Gegenstände**: Ausrüstung, raffinierte Rohstoffe, Nahrung,
Tränke und Fischsaucen.

Gerechnet wird über `AO.craft.calc()` – also mit genau derselben Mathematik
wie in den Einzelrechnern, nicht mit einer zweiten Fassung davon. Ein Klick
auf eine Zeile führt in den passenden Einzelrechner.

Enthalten ist alles, was die Flip-Suche auch hat:

* **Verzauberung** einzeln (.0 bis .4) oder *alle* auf einmal
* **Rückgaberate** aus Stadtbonus, Fokus, Hideout oder von Hand
* **Handelbarkeit**: tatsächlich verkaufte Stück je Tag, aus den echten
  Handelsdaten der letzten drei Wochen
* **Datenalter** als harte Bedingung
* **Marktpreis oder zuletzt erzielt** als Rechengrundlage, plus Filter gegen
  Fantasieangebote
* **Marktwert** über alle Städte als Gegenwert des Gegenstands
* **Gildenverkauf** zum Marktwert abzüglich Rabatt, steuerfrei
* Filter nach **Warengruppe** und **Stufe**, Sortierung nach Gewinn, Marge
  oder **Silber je Fokuspunkt**

Ein Lauf über alle Verzauberungsstufen dauert rund **8 Sekunden** und ergab
im Test 2.079 vollständige Rechnungen, davon 861 mit Gewinn.

Gegengerechnet von Hand, *Elder's Sickle* (T8, Stadtbonus 36,7 %, Gebühr 800):
6 Planken × (1−0,367) = 3,798 zu 33.450 plus 2 Barren × 0,633 = 1,266 zu
26.434 ergibt 160.509 Material; Item-Wert 2.048 × 0,1125 × 8 = 1.843 Gebühr;
198.984 × 0,935 − 162.352 = **23.698 Gewinn**. Die Tabelle zeigt dieselben
Zahlen.

### Nie über dem günstigsten Angebot

Steht die Rechengrundlage auf **zuletzt erzielt**, wird der Preis in einer
Stadt jetzt beim aktuellen günstigsten Angebot gedeckelt. Wer darüber
einstellt, verkauft nämlich nicht – er wartet, bis die billigeren Angebote
weg sind.

Der Fall, an dem es auffiel: *Adept's Mercenary Shoes .3* in Fort Sterling,
Qualität Normal. In drei Wochen wurden dort 50 Stück zu durchschnittlich
**84.901** verkauft – inzwischen liegt das günstigste Angebot aber bei
**59.990**. Gerechnet wurde mit 84.901 und damit ein Gewinn von +24.946
ausgewiesen; tatsächlich sind es **+17.240**.

Am **Schwarzmarkt gilt der Deckel nicht**: dort ist der gemeldete Preis die
Kauforder des Spiels, kein konkurrierendes Angebot – und die liegt im Median
34 % unter dem, was dort real gezahlt wird. Gegengeprüft: eine
*Grandmaster's Stalker Jacket .3* rechnet weiterhin mit 2.732.174 erzielt
statt mit der momentanen Kauforder von 448.103.

Nebenbei bestätigt der Fall, dass die Qualität stimmt: 84.901 ist der
Normal-Durchschnitt in Fort Sterling, 59.990 das Normal-Angebot dort. Das
Exzellent-Niveau lag zur selben Zeit bei 88.984 und ist nirgends in die
Rechnung eingegangen.

### Immer die schlechteste Qualität

Beim Herstellen lässt sich die Qualität nicht bestimmen – was aus der Station
kommt, ist ganz überwiegend **Normal**. Mit einer besseren Stufe zu rechnen
heißt, sich einen Preis auszurechnen, den man gar nicht erreicht.

Deshalb gilt in allen Craft-Rechnungen die schlechteste Stufe:

* **Craft-Chancen**: keine Auswahl mehr, fest auf Normal. Material wird
  ohnehin nur in Normal gehandelt.
* **Crafting-, Koch-, Trank- und Refining-Rechner**: Normal als Vorgabe. Wer
  höher stellt, sieht darunter ausdrücklich „Gerechnet wird mit *Exzellent*.
  Beim Herstellen bekommt man die Qualität nicht geschenkt – verlässlich ist
  nur Normal."
* **Serien-Rechner**: dieselbe Kennzeichnung.

Nicht betroffen ist der **Aufwertungs-Rechner**: dort kauft man den Gegenstand,
die Qualität ist also eine echte Wahl und bleibt beim Aufwerten erhalten.

### Klick auf eine Zeile

Ein Klick führt in den passenden Einzelrechner – Ausrüstung in den
Crafting-Rechner, raffinierte Rohstoffe ins Refining, Nahrung und Fisch ins
Kochen, Tränke in den Trank-Rechner – und stellt ihn auf **genau diesen
Gegenstand** ein, samt Verzauberung, Einkaufs- und Verkaufsort, Qualität,
Gebühr, Rückgabemodus und Fokus.

Anfangs wurde nur die Ansicht gewechselt, ohne die Auswahl weiterzureichen –
dort stand dann noch der Gegenstand, den man zuletzt selbst ausgewählt hatte,
also ein völlig anderer. Die Einzelrechner haben dafür jetzt eine
`select(itemId, annahmen)`-Schnittstelle: sie löst aus der ID die Familie auf
(`T5_2H_CLAYMORE` → `2H_CLAYMORE`, Stufe 5), setzt den Zustand und baut die
Bedienelemente neu auf.

Gegengerechnet: derselbe Gegenstand zeigt in beiden Ansichten dieselben Zahlen –
*Master's Boltcasters* 79.305 Kosten, 223.957 Verkauf, **+130.095** Gewinn,
164,0 % Marge; ebenso geprüft für Refining, Nahrung, Tränke und einen
verzauberten Gegenstand (*Adept's Mistwalker Jacket .2*, +53.441).

Wer gerade einen Namen markiert hat, wechselt nicht die Ansicht – Markierung
schlägt Klick.

### Ein Fehler, der dabei ans Licht kam

Verzauberte Rohstoffe heißen im Spielbestand `T4_METALBAR_LEVEL1`, am Markt
aber `T4_METALBAR_LEVEL1@1`. Der Einkauf von Material lief bisher über die
Kennung **ohne** den Zusatz – und zu der liefert die API überhaupt keine
Preise. Nachgeprueft an Holz, Erz, Faser, Stoff, Barren und Leder: die Form
ohne `@` hat in keiner Stadt ein Angebot, die mit `@` in allen.

Betroffen war jeder Rechner, der verzaubertes Material einkauft – Crafting,
Serien-Rechner, Chancen und die neuen Craft-Chancen. Sichtbar wurde es hier:
bei Verzauberung .1 kamen **109** vollständige Rechnungen zustande, nach dem
Fix **664**.

Die Umschreibung sitzt in der Marktschicht (`AO.market.marketId`), nicht in
den Rechnern: so arbeiten alle weiterhin mit der Kennung aus den Spieldaten,
und nur der Marktzugriff spricht die Sprache des Marktes. Sie ist idempotent,
eine bereits vollständige Kennung bleibt unverändert. Selbst eingetragene
Preise, die noch unter der alten Kennung lagen, werden einmalig umgeschrieben.

Gegenprobe im Crafting-Rechner: `T4_METALBAR_LEVEL1` in Caerleon jetzt 827 –
identisch mit der API. Für `T4_PLANKS_LEVEL1` meldet die API dort tatsächlich
kein Angebot, und der Rechner sagt genau das, statt eine Zahl zu erfinden.

## Aufwertungs-Rechner

Für den Schwarzmarkt-Handel: eine .0-Waffe günstig kaufen, mit Runen, Seelen
und Relikten hochstufen und die gefragte .2 verkaufen.

Aus den Spieldaten belegt (4.458 Rezepte, 1.240 aufwertbare Gegenstände):

| Schritt | Material |
|---|---|
| .0 → .1 | Runen |
| .1 → .2 | Seelen |
| .2 → .3 | Relikte |

Die Menge hängt am Gegenstand – Schwert 288, Bogen 384, Helm 96 – und ist über
alle Tiers und Stufen gleich. **Aufwerten kostet kein Silber** und keine
Nutzungsgebühr, nur das Material; Steuer und Ordergebühren fallen wie üblich
beim Kaufen und Verkaufen an. Eine Stufe **.4 lässt sich nicht aufwerten** –
dafür gibt es im Spiel kein Rezept.

Ausgewählt wird über **Kategorie und Stufe** (alle 16 Waffenarten, Rüstung,
Nebenhand, Taschen, Umhänge – Artefaktwaffen inbegriffen), wahlweise per Suche.
Gegenstand, Material und Verkauf lassen sich in unterschiedlichen Städten
ansetzen, Verkauf auch am Schwarzmarkt.

**Flip-Übersicht:** Ein Knopf durchsucht **alle 1.240 aufwertbaren Gegenstände**
in jeder Stufe und jedem Weg (.0→.1, .0→.3, .2→.3 …) und listet auf, was sich
gerade rechnet – standardmäßig nur die Wege mit Gewinn, sortierbar nach Gewinn
oder Marge, mit Mindestgewinn-Filter. Ein Klick auf eine Zeile übernimmt den Weg
nach oben in die Detailrechnung. Wahlweise lässt sich die Suche auf die gewählte
Kategorie eingrenzen.

Das sind rund 5.000 Preisabfragen; sie laufen in 25 Blöcken zu je 200 IDs,
gedrosselt auf 6 gleichzeitige Anfragen. Wege mit fehlenden Preisen erscheinen
nicht, werden aber gezählt.

### Warum der Schwarzmarkt zu schlecht aussah

Der Schwarzmarkt führt keine stehenden Preise, sondern **Kauforders, die das
Spiel laufend erneuert**. Was die API als höchste Kauforder meldet, ist also
eine Momentaufnahme eines ständig wechselnden Orderbuchs – und die ist
systematisch die schlechtere Hälfte davon.

Nachgemessen an **241 Gegenständen** mit Handelsdaten am Schwarzmarkt
(zufällige Auswahl aus allen aufwertbaren, Verzauberung 1–3):

| aktuelle Kauforder / real dort erzielt | |
|---|---|
| Median | **0,66×** – also 34 % darunter |
| darunter liegend | 88 % der Fälle |
| unter 0,8× | 67 % |
| unter 0,5× | 34 % |

An der Datenqualität liegt es ausdrücklich **nicht**: die Schwarzmarkt-Preise
sind sogar frischer als die der Städte (Median 0,3 Std. gegen 6,1 Std.) und
viel vollständiger (84 % der Einträge haben eine Kauforder gegen 9,5 % in den
Städten). Die Zahl stimmt – sie ist nur ein Schnappschuss.

Der Rechner sagt das jetzt dort, wo es auffällt: beim gewählten Gegenstand
steht die aktuelle Kauforder neben dem dort real erzielten Preis samt
Abweichung, und in der Flip-Suche wird gezählt, bei wie vielen Wegen die
Momentaufnahme darunter liegt. Ein Knopf stellt auf „zuletzt erzielt" um.
Im Testlauf stieg die Zahl der Wege mit Gewinn dadurch von **227 auf 432**.

Beide Zahlen sind ehrlich, sie beantworten nur verschiedene Fragen: die
Kauforder sagt, was du bekommst, wenn du **jetzt sofort** abgibst; der erzielte
Preis, was zu bekommen war, wenn man eine brauchbare Order abgewartet hat.

#### Ordergebühr am Schwarzmarkt – ein echter Rechenfehler

Dabei fiel auf: der Rechner zog beim Verkauf an den Schwarzmarkt **2,5 %
Verkaufsorder-Gebühr** ab, sobald in den Einstellungen „Verkaufsorder" stand.
Diese Gebühr fällt aber nur an, wenn man eine **eigene** Order einstellt –
nicht, wenn man eine bestehende bedient. Am Schwarzmarkt wird immer in eine
vorhandene Kauforder hinein verkauft; dort gibt es nichts einzustellen.

Behoben über `AO.craft.sellOrderFeeAt(ort, art)`, das die Gebühr nur dort
ansetzt, wo tatsächlich eine Order aufgegeben wird. Das gilt jetzt in allen
Rechnern, die über `AO.craft.calc()` gehen. Die Wege mit Gewinn stiegen dadurch
von 227 auf 284, und die Zeilen gehen sauber auf: Gewinn = Verkauf × 0,96
− Kosten.

#### Und eine Spalte, die nicht zur Rechnung passte

Die Spalte „Verkauf" zeigte weiterhin das Marktangebot, auch wenn mit dem
zuletzt erzielten Preis oder dem Gildenpreis gerechnet wurde – Gewinn und
angezeigter Verkaufspreis passten sichtbar nicht zusammen. Sie zeigt jetzt
immer den Preis, mit dem tatsächlich gerechnet wird; die jeweils andere Zahl
steht im Tooltip.

### Gildenverkauf

Ein Haken in der linken Spalte stellt den ganzen Rechner auf den direkten
Handel mit Gildenmitgliedern um. Der Preis ergibt sich dann aus dem
**Marktwert abzüglich eines Rabatts** (Vorgabe 15 %), und es fallen weder
Verkaufssteuer noch Ordergebühr an – ein Handel von Hand zu Hand kennt beides
nicht. Die Flip-Suche rechnet im selben Modus, sortiert also danach, was sich
für diesen Weg lohnt.

**Der Marktwert ist überschreibbar.** Das Feld verhält sich wie jedes andere
Preisfeld: eingetippt schlägt gerechnet, ein ↺ stellt den berechneten Wert
wieder her. Das ist wichtig, weil unsere Zahl eine Nachbildung aus echten
Abschlüssen ist – was der Spielclient als *Estimated Market Value* anzeigt,
kann abweichen. Wer ihn im Spiel abliest, trägt ihn ein.

#### Warum daneben immer der Marktweg steht

Ein Rabatt vom Marktwert ist keine Steuerersparnis, sondern ein Geschenk –
und wie groß es ist, sieht man erst im Vergleich. Mit Premium bleiben beim
normalen Verkauf über eine Verkaufsorder **93,5 %** des Preises übrig
(4 % Steuer + 2,5 % Gebühr). Ab etwa **−6,5 %** ist der Gildenverkauf also
nicht mehr günstiger, sondern teurer als der Markt – ohne Premium ab −10,5 %.
Gegen einen Sofortverkauf in eine Kauforder sieht es umgekehrt aus: die liegt
bei Ausrüstung im Median bei 61 % des Angebots, dagegen trägt der
Gildenverkauf bis rund −40 %.

Der Erlöskasten zeigt deshalb drei Zahlen:

* **Gleichstand mit dem Marktweg bei −X %** – darüber hinaus verschenkst du.
* **Bei diesem Rabatt bist du bei null −Y %** – die harte Untergrenze.
* **Netto über \<Verkaufsort\>** – was derselbe Gegenstand über den Markt
  gebracht hätte.

Liegt der Gildenpreis unter den Einstandskosten, wird die Box rot. Deckt schon
der volle Marktwert die Kosten nicht, sagt sie das ausdrücklich – dann taugt
der Gegenstand für diesen Weg nicht.

Ein Beispiel aus dem Testlauf, das genau davor bewahrt: *Expert's Mage
Sandals .3* kosten in der Herstellung 182.124. Der Schwarzmarkt zahlt dafür
257.652, der Marktwert über alle Städte beträgt aber nur 109.423. Ein
Gildenpreis von −15 % wäre **93.010** gewesen – ein Verlust von 89.114 je
Stück, während derselbe Gegenstand am Schwarzmarkt 58.781 Gewinn gebracht
hätte.

#### Zwei Phasen in der Suche

Die Flip-Suche holt Handelsdaten nur für die aussichtsreichen Wege – sonst
wären es über 100 MB. Der Marktwert kommt aber aus genau diesen Handelsdaten.
Ohne Vorkehrung findet die Vorauswahl im Gildenmodus deshalb nichts, lädt
nichts und bleibt bei null Treffern stehen (im ersten Anlauf: 3 geprüfte Wege
statt 9.238).

Gelöst ist das über eine Obergrenze: die Vorauswahl rechnet mit dem vollen
Marktpreis ohne Abgaben – mehr als das kann kein Gildenpreis bringen. Was
diese Hürde nicht nimmt, kommt auch als Gildenverkauf nicht in Frage. Danach
wird mit den geladenen Marktwerten richtig gerechnet: 1.411 vollständige Wege,
59 davon mit Gewinn.

### Welche Wege in der Liste stehen

Neben dem Stufenfilter steht eine Reihe Schalter für die sechs
Aufwertungswege – *.0 → .1, .0 → .2, .0 → .3, .1 → .2, .1 → .3,
.2 → .3*. Mehrfachauswahl: ein Klick blendet einen Weg ein, ein zweiter
wieder aus, *Alle Wege* setzt zurück. Gesucht wird wie bisher immer alles;
gefiltert wird erst die Anzeige, das Umschalten dauert rund 0,4 Sekunden.

Stufen- und Wegefilter greifen zusammen – *T5* plus *.2 → .3* zeigt genau
die Schnittmenge.

### Marktwert

Das Spiel zeigt im Markt einen **Estimated Market Value**. Diese Zahl rechnet
der Spielserver selbst und veröffentlicht sie nicht: der Data-Project-Endpunkt
kennt nur `sell_price_min` / `buy_price_max` und die Handelshistorie.
Nachgebildet wird sie deshalb aus derselben Grundlage, auf der auch das Spiel
sie bildet – aus tatsächlichen Abschlüssen: der mengengewichtete Durchschnitt
der letzten drei Wochen über **alle Städte** zusammen.

Die Spalte steht neben „zuletzt erzielt" und meint den Gegenstand, den man
**verkauft**. Der Unterschied zwischen beiden ist die eigentliche Aussage:
„zuletzt erzielt" gilt am gewählten Verkaufsort, der Marktwert für den
Gegenstand überhaupt. Bei den *Expert's Mage Sandals .3* etwa zahlt der
Schwarzmarkt 231.779, während über alle Städte hinweg 109.423 gezahlt wurden
(21 Stück in drei Wochen) – der Aufschlag ist genau der Grund, warum sich der
Weg dorthin lohnt.

Der **Schwarzmarkt bleibt draußen**: dort kauft nicht ein Spieler, sondern das
Spiel, und zu ganz eigenen Preisen. Beim T4-Speer stammten 7.191 von 9.327
gehandelten Stück von dort und hoben den Wert von 4.855 auf 7.614 – eine Zahl,
zu der man den Gegenstand nirgends bekommt.

Gegengerechnet direkt im laufenden Client gegen den API-Endpunkt, mit derselben
Städteliste: 21 Stück, 109.423,24 auf beiden Seiten.

#### Ein Fehler, der dabei auffiel

Handelsdaten wurden bisher nur **überschrieben**, nie entfernt. Eine Antwort
deckt aber immer alle abgefragten Städte ab – wo jetzt nichts mehr gehandelt
wird, muss auch nichts mehr stehen. Sonst schleppt der Bestand Abschlüsse mit,
die längst aus dem Zeitfenster gelaufen sind.

Sichtbar wurde das am T4-Speer: der Rechner führte 9.327 Stück über sechs
Städte, die API meldete 2.364 über vier – darunter Caerleon mit 100 Stück zu
Ø 17.054, wo aktuell überhaupt nicht gehandelt wird. Jetzt wird der Altbestand
der abgefragten Gegenstände vor dem Eintragen verworfen (fehlgeschlagene Blöcke
behalten ihren Stand). Nachgemessen über drei aufeinanderfolgende Suchläufe:
21 Stück / 109.423 – konstant und deckungsgleich mit der API.

### Stufen auseinanderhalten

Die Suche über **Alles** bleibt, wie sie war – sie prüft weiterhin jeden
aufwertbaren Gegenstand in jeder Stufe. Neu ist ein **Stufenschalter** über der
Trefferliste (*Alle Stufen · T4 · T5 · T6 · T7 · T8*), der nur die Anzeige
umblendet. Es wird also nichts neu gesucht: das Umschalten dauert rund
0,4 Sekunden, weil nur gefiltert und sortiert wird.

Unter der Infozeile steht zusätzlich, wie sich die Treffer auf die Stufen
verteilen („angezeigt je Stufe: T4 10 · T5 16 · T6 11"). Diese Zahlen sind
selbst Schalter – ein Klick blendet auf die Stufe um, ein zweiter zurück.

Gezählt wird dabei **nach** allen übrigen Filtern. Ein erster Entwurf zählte
davor und meldete „T7 15", während unter T7 nichts stand – der Mindestgewinn
hatte sie längst aussortiert. Die Aufschlüsselung summiert sich jetzt exakt auf
die angezeigte Zeilenzahl (10 + 16 + 11 = 37).

Die Wahl bleibt über den Ansichtswechsel hinweg erhalten.

### Kauforder gilt nur für das Material

Der Schalter **Kauforder** wirkt in der Aufwertung ausschließlich auf **Runen,
Seelen und Relikte**. Der Gegenstand selbst wird immer **sofort gekauft**, und
die Einstellgebühr von 2,5 % fällt entsprechend nur auf das Material an.

Grund ist die Marktrealität: Auf eine bestimmte Waffe in einer bestimmten
Qualität eine Kauforder zu stellen und darauf zu warten, dass ein Verkäufer
hineinverkauft, funktioniert praktisch nie. Aufwertungsmaterial dagegen ist
Massenware, die ständig durchläuft.

Am geladenen Bestand nachgemessen (39.897 Ausrüstungs-Einträge, alle Städte):

| | höchste Kauforder in % des Angebots (Median) | Anteil unter dem halben Angebot |
|---|---|---|
| Ausrüstung | **61,1 %** | 34,6 % |
| Runen / Seelen / Relikte | **91,8 %** | 2,0 % |

Beim Material liegen Angebot und Kauforder also dicht beieinander – eine Order
wird dort wirklich bedient. Bei Ausrüstung klafft ein Drittel dazwischen; mit
diesem Preis zu rechnen hätte den Einkauf systematisch zu billig angesetzt.

Die alte Fassung hat dabei doppelt gestört: Wo gar keine Kauforder vorlag – bei
den drei aussichtsreichsten Wegen des Testlaufs war das der Fall – galt der Weg
als „ohne vollständige Preise" und verschwand ganz aus der Liste.

### Handelbarkeit

Ein Preis sagt nur, was jemand *verlangt* – nicht, ob je einer kauft. Deshalb
holt die Suche in einem zweiten Schritt die **echten Handelszahlen** der letzten
drei Wochen (History-Endpunkt, `item_count` = tatsächlich verkaufte Stück je
Tag) und prüft **beide Enden**: Lässt sich die Ausgangsstufe am Einkaufsort
überhaupt kaufen, und nimmt jemand die Zielstufe am Verkaufsort ab?

Die Spalte „Umsatz/Tag“ zeigt beides (Einkauf / Verkauf), und ein Mindestwert
filtert tote Ware aus. Warum das nötig ist, zeigt ein realer Fall: Das
Grandmaster's Clarent Blade stand mit **+367.213 Silber Gewinn** auf Platz 1 –
am Einkaufsort wurde es in drei Wochen aber **kein einziges Mal** gehandelt. Mit
Filter verschwindet es, ohne Filter führt es die Liste an.

Handelsdaten sind um ein Vielfaches umfangreicher als Preise – über alle
Qualitäten wären es mehr als 100 MB für den ganzen Bestand. Deshalb wird erst
gerechnet und danach nur für die **aussichtsreichen Wege** nachgesehen, ob sie
sich handeln lassen. Liegen für einen Gegenstand keine Handelsdaten vor, wird er
nicht heimlich verworfen – die Prüfung greift nur, wenn überhaupt Daten da sind.

### Datenalter

Ein Preis ist nur so gut wie sein letzter Scan. Die Suche führt deshalb für jeden
Weg mit, wie alt der **älteste beteiligte Preis** ist – Einkauf, Material und
Verkauf zusammengenommen – und zeigt es in der Spalte „Daten“ (grün unter 3 Std.,
grau unter 24, gelb darüber). Ein Auswahlschalter wirft alles Ältere raus.

Was das ausmacht, zeigt ein realer Lauf: bei „max. 24 Std.“ standen 51 Wege in
der Liste, angeführt von **+53.766 Silber** – die Preise dahinter waren aber
**12 Stunden alt**. Bei „max. 3 Std.“ blieben **2 Wege** übrig, der beste mit
+4.590. Rund 9.000 Wege fielen wegen veralteter Daten heraus.

Selbst eingetragene Preise gelten immer als frisch – sie kommen ja von dir.

### Angebot gegen tatsächlich erzielten Preis

Ein Angebot ist eine Behauptung, kein Geschäft. Wer eine Deathgivers für
5.000.000 einstellt, hat sie damit nicht verkauft – in der Suche stand sie
trotzdem mit **+3,8 Mio Gewinn** an der Spitze.

Aus denselben Handelsdaten, die schon die Umsatzprüfung speisen, wird deshalb
zusätzlich der **mengengewichtete Durchschnitt der tatsächlich gezahlten
Preise** der letzten drei Wochen gebildet (`avg_price` gewichtet mit
`item_count`). Er steht in der neuen Spalte **„zuletzt erzielt"** direkt neben
dem Verkaufspreis; liegt das Angebot mehr als 50 % darüber, wird die
Verkaufsspalte gelb.

Zwei Stellschrauben daneben:

* **Rechengrundlage** – *Marktpreis* (aktuelles Angebot bzw. Kauforder) oder
  *zuletzt erzielt*. Die zweite Einstellung rechnet den ganzen Weg mit dem
  Preis durch, zu dem wirklich gehandelt wurde.
* **„höchstens ×N über erzielt"** – wirft Wege raus, deren Verkaufspreis das
  N-fache des erzielten übersteigt (Vorgabe 2, `0` schaltet ab). Ausgelassene
  Wege werden gezählt: „… · 4 mit Fantasieangeboten ausgelassen".

Geprüft am gemeldeten Fall: mit dem 5-Mio-Angebot als eigenem Preis meldet die
Suche genau **1 mit Fantasieangeboten ausgelassen**. Das echte Angebot lag
inzwischen bei 850.309 gegen 723.621 erzielt – Faktor 1,2, also unauffällig;
der Gewinn fällt beim Umschalten auf *zuletzt erzielt* von +198.571 auf
+80.118.

Wo keine Handelsdaten vorliegen, greift die Prüfung nicht – sie verwirft
nichts blind.

### Qualitätsstufen

Beim Aufwerten bleibt die Qualität erhalten: eine Waffe in *Gut* gekauft bleibt
*Gut*. Damit ist jede Qualitätsstufe ein eigener Handel mit eigenen Preisen auf
beiden Seiten. Der Schalter **„alle Qualitäten"** durchsucht alle fünf Stufen und
weist in einer eigenen Spalte aus, welche gemeint ist; ein Klick auf die Zeile
übernimmt sie.

Ein Vollscan über alle Qualitäten prüft rund **9.250 Wege** und dauert etwa
**6 Sekunden**.

Zusätzlich vergleicht eine Tabelle für den gewählten Gegenstand alle
erreichbaren Zielstufen nebeneinander. Fehlt ein Preis, verweigert der Rechner
die Gewinnangabe, statt eine Zahl zu erfinden.

Nicht aufwertbar und deshalb nicht in der Auswahl: **Werkzeuge** sowie
**T2- und T3-Ausrüstung** – die haben im Spiel gar keine Verzauberung.

## Serien-Rechner

Für den Fall, dass man einer ganzen Kategorie auf einmal auf den Zahn fühlen
will – und den Marktpreisen ohnehin nicht traut.

Kategorie wählen (z. B. Platte – Helme, T4), und alle Gegenstände stehen
untereinander. **Oben** trägt man die Preise der gemeinsamen Ressourcen ein
(Steel Bar, Leather …); sie gelten sofort für jede Zeile, jeweils mit der
Menge, die das Rezept dort braucht. **In der Zeile** lässt sich derselbe
Rohstoff für einen einzelnen Gegenstand abweichend eintragen, ebenso der
Artefaktpreis (der gehört ohnehin nur zu diesem einen Stück) und der
Verkaufspreis.

Alles Eingetragene wird dauerhaft gespeichert und übersteht jeden Neustart.
Gold umrandete Felder sind eigene Werte, `↺` nimmt wieder den Preis von oben
bzw. den Marktpreis.

Preis-Vorrang je Feld: Zeilen-Eintrag → eigener Preis (oben) → Marktpreis.

## Chancen-Reiter

Sucht in einer Warengruppe (Refining, Nahrung, Tränke, Fisch) nach dem, was sich
gerade am ehesten lohnt – und nennt den **kompletten Weg**: in welcher Stadt jedes
Material am günstigsten ist, wo raffiniert bzw. gecraftet wird und wo das Produkt
am besten weggeht. Ein Klick auf die Zeile klappt die Einzelpreise auf.

Zwei Regeln, damit nichts Falsches als Chance erscheint:

- Eine Zeile taucht **nur** auf, wenn wirklich jeder Preis vorliegt – jedes
  Material und das Endprodukt. Unvollständiges wird gezählt und ausgewiesen,
  aber nicht angezeigt.
- Zu alte Preise fliegen ebenfalls raus (einstellbar, Vorgabe 24 Stunden).
  Veraltete Daten erzeugen sonst Scheinchancen.

## Fischsoßen

Basic, Fancy und Special Fish Sauce sowie Seaweed stehen im Koch-Rechner und in
der Chancen-Suche. Sie liegen im Dump als `simpleitem` der Kategorie „fish“ und
haben laut Spieldaten **Item-Wert 0** – es fällt also keine Nutzungsgebühr an.

## Sprache

Deutsch, Englisch, Spanisch – umschaltbar in der Kopfzeile und unter
*Einstellungen*. Die Wahl gilt für die Bedienoberfläche **und** die
Item-Namen; die Namen sind dabei nicht übersetzt, sondern aus der
Lokalisierung des Spiels selbst übernommen. Alle drei stecken in den
Datendateien (`n` = Englisch, `d` = Deutsch, `s` = Spanisch). Einzelheiten
im Abschnitt [Drei Sprachen](#drei-sprachen).

## Schwarzmarkt

Der Schwarzmarkt liegt in Caerleon, ist in der API aber eine **eigene Location**
mit völlig anderen Preisen – der Unterschied entscheidet über Gewinn oder Verlust
(Beispiel T4-Breitschwert: 23.999 auf dem Caerleon-Markt gegenüber 9.717 als
Schwarzmarkt-Kauforder). Im Crafting-Rechner steht er deshalb als eigener
Verkaufsort zur Auswahl. Er handelt **nur Ausrüstung**, keine Ressourcen –
im Refining-Rechner erscheint er darum nicht.

Der Schwarzmarkt führt **ausschließlich Kauforders** – man verkauft in sie
hinein und kann dort nichts erwerben. Deshalb:

- Er steht **nicht als Einkaufsort** zur Wahl.
- Beim Verkauf gilt dort **immer der Ankaufspreis** (die höchste Kauforder),
  auch wenn „Verkaufsorder" eingestellt ist. Was die API dort als „Angebot"
  führt, sind Verkaufsorders anderer Spieler – Konkurrenz, nicht dein Erlös.
  Beim Adept's Spear .3 waren das 246.887 als Angebot gegenüber **227.400** als
  Kauforder; nur die zweite Zahl bekommt man tatsächlich.
- Der Hinweis nennt das Scan-Alter dieses Ankaufspreises und warnt: eine
  Kauforder hat eine **begrenzte Stückzahl**. Wer sie leerkauft, drückt den
  Preis auf die nächste, meist deutlich niedrigere Order – ein zweiter Flip
  desselben Gegenstands rechnet sich oft nicht mehr.

## Woher die Zahlen kommen

| Größe | Quelle |
|---|---|
| Rezepte, Fokuskosten, Item-Werte | offizielle Spieldaten ([ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps)) |
| Marktpreise | [Albion Online Data Project](https://www.albion-online-data.com) (crowdsourced) |
| Item-Bilder | Albion Online Render Service |

**Nachgeprüfte Formeln**

- Item-Wert der Ressourcen = `2^(Tier + Verzauberung)` – für alle 115 Refined-Einträge
  ohne Abweichung bestätigt
- Item-Wert craftbarer Gegenstände = Summe der Zutatenwerte
  (Gegenprobe T4-Metallbarren: 2× T4-Erz (4) + 1× T3-Barren (8) = 16 ✓).
  Führt das Spiel für das Erzeugnis selbst einen Wert, gilt dieser – im Dump sind
  Rohstoffwerte gerundet (T5-Erz 5,34 statt 16/3), die Summe ergäbe sonst 32,02
  statt der amtlichen 32.
- Markt-IDs verzauberter Ware: Ausrüstung heißt `T4_MAIN_SWORD@1`, raffinierte
  Ressourcen dagegen `T4_PLANKS_LEVEL1@1` – beides gegen die API geprüft
- Nutzungsgebühr je Craft = `Item-Wert × 0,1125 × Stationsgebühr ÷ 100`
- Rückgaberate: zurückerhaltenes Material wird weiterverarbeitet →
  Verbrauch = Bedarf × (1 − Rate). **Ausgenommen Artefakte** – die werden beim
  Craften immer vollständig verbraucht und kommen nie zurück
  ([Albion-Wiki](https://wiki.albiononline.com/wiki/Resource_return_rate)).
  Erkannt über `shopcategory="artefacts"` aus den Spieldaten; 705 Materialien
  sind entsprechend markiert (`nr=1` in `data/materials.js`). In der
  Materialtabelle steht dort „kein Rücklauf“ statt einer Rückgabemenge.
- Verkauf: 4 % Steuer mit Premium, sonst 8 %; Kauf- und Verkaufsorder je 2,5 %
  Einstellgebühr, Sofortkauf gebührenfrei

**Bewusst einstellbar statt geraten** – diese beiden Werte stehen *nicht* in den
offiziellen Spieldaten:

- Welche Stadt beim **Item-Crafting** welche Kategorie begünstigt. Im
  Crafting-Rechner wählt man die Rückgaberate deshalb direkt (die Prozentsätze
  selbst sind belegt). Die **Refining**-Boni sind dagegen bekannt und fest hinterlegt.
- Der Umrechnungsfaktor für **Handwerks-Fame**. Der Fame-Rechner lässt sich in
  Sekunden am Handwerksfenster kalibrieren: einmal die dort angezeigte Fame
  eintragen, der Faktor gilt danach für alle Gegenstände.

Bei 26 von 1.418 Rezepten führt das Spiel für einzelne Zutaten (Mob-Beute wie
Werwolfzähne) keinen Item-Wert. Diese erhöhen die Nutzungsgebühr nicht; die
betroffenen Rechner weisen es aus.

## Gegengelesen

Die Rechenlogik wurde von einem zweiten, unabhängigen Durchgang geprüft (Lesen
plus numerisches Nachstellen in Node). Vier Fehler kamen dabei heraus und sind
behoben:

1. Bei „Vorstufe selbst herstellen“ wurde auch der **Verkaufspreis des Endprodukts**
   durch die eigenen Herstellkosten ersetzt, sobald Einkaufs- und Verkaufsstadt
   gleich waren – der Gewinn brach zusammen. Die Ersetzung trifft jetzt
   ausschließlich Materialien.
2. Die **Kauforder-Gebühr** lief über alle Materialien, auch über selbst gebaute,
   die gar nicht am Markt gekauft werden. Sie sitzt jetzt nur auf dem
   tatsächlichen Einkauf; umgekehrt fehlten der Eigenbau-Kette die 2,5 % auf ihre
   eigenen Rohstoffe.
3. Der **Sprachwechsel** erreichte die Item-Auswahllisten nicht, weil deren
   Familienliste zwischengespeichert war.
4. Der **Stufenvergleich** rechnete T2/T3 mit einer Verzauberung, die es dort
   nicht gibt, und fragte dafür nicht existierende Markt-IDs ab.

## Bekannte Eigenheiten

- **Zeilenpreise im Serien-Rechner gelten unabhängig von der Einkaufsstadt.**
  Trägst du dort für einen Gegenstand einen Materialpreis ein, bleibt er auch
  nach einem Stadtwechsel stehen. Das ist Absicht – der Sinn der Eingabe ist ja
  ein Preis, dem du traust. Gold umrandet siehst du sofort, wo eigene Werte
  stehen; `↺` nimmt wieder den Preis von oben.
- **Eigene Preise hängen am Server.** Ein für Europa eingetragener Preis gilt
  nicht auf dem Asien-Server und verdeckt dort auch nicht den echten Marktpreis.

## Preise

Marktdaten werden **nur auf Knopfdruck** geladen, nie automatisch im Hintergrund.
Jedes Preisfeld lässt sich überschreiben; eigene Preise haben Vorrang und
überstehen jede Aktualisierung. `↺` setzt ein Feld auf den Marktpreis zurück.
Der farbige Punkt zeigt das Alter der Daten (grün < 3 h, gelb < 24 h, rot älter,
grau = keine Daten).

Alles liegt ausschließlich im Browser (localStorage). Unter *Einstellungen* lässt
sich alles einzeln oder komplett zurücksetzen.

---

Inoffizielles Fan-Tool. Albion Online ist ein eingetragenes Markenzeichen der
Sandbox Interactive GmbH; dieses Projekt steht in keiner Verbindung dazu.

---

# Windows-Client

Das Toolkit gibt es zusätzlich als **installierbares Windows-Programm** mit
eigenem Fenster, Startmenü- und Desktop-Eintrag. Der Rechner selbst ist
derselbe: Electron lädt genau die `index.html`, die auch per Doppelklick
funktioniert. **Kein Server, kein Hosting, keine Portfreigabe.**

## Als Benutzer: installieren

1. Unter *Releases* die Datei `Albion Toolkit Setup x.y.z.exe` herunterladen.
2. Ausführen, Zielordner wählen, fertig.

**Beim ersten Start warnt Windows SmartScreen**, weil der Installer nicht
signiert ist. Das ist bei kleinen quelloffenen Werkzeugen der Normalfall und
sagt nichts über den Inhalt aus – eine Signatur kostet je nach Anbieter
100–400 € im Jahr. Zum Fortfahren: *Weitere Informationen* → *Trotzdem
ausführen*. Wer das nicht möchte, nimmt den Ordner aus dem Quellcode und
öffnet `index.html` direkt – das ist dieselbe Anwendung.

## Als Entwickler: bauen

```
npm install          # einmalig, holt Electron und electron-builder
npm start            # zum Ausprobieren, startet das Fenster
npm run dist         # baut dist/Albion Toolkit Setup x.y.z.exe
```

Gebraucht wird nur Node.js. **Der Rechner selbst braucht davon nichts** –
`index.html`, `css/`, `js/` und `data/` bleiben unverändert und laufen
weiterhin ohne jede Werkzeugkette. Node ist nur zum Verpacken da.

`node_modules/` und `dist/` sind in `.gitignore` und gehören nicht ins Repo.
Ins Repo kommt der Quellcode, ans Release die fertige `.exe`.

## Was in der Hülle steckt

`electron/main.js` ist bewusst dünn: ein Fenster, Datei laden, Größe und Lage
merken. Sicherheitsseitig ist `nodeIntegration` **aus** und `contextIsolation`
**an** – die Seite bekommt keinerlei Zugriff aufs Dateisystem. Sie braucht ihn
auch nicht: sie rechnet und fragt zwei fremde Dienste nach Preisen und Bildern.

Aussenlinks öffnen im richtigen Browser statt in einem zweiten Fenster ohne
Adresszeile. Im Menü stehen *Neu laden*, Zoom, Vollbild und die
Entwicklerwerkzeuge – letztere helfen beim Nachsehen, wenn eine Preisabfrage
klemmt.

Das Anwendungssymbol (`build/icon.ico`, sechs Größen von 16 bis 256 px) ist
selbst gezeichnet – ein Amboss in Gold auf dunklem Schiefer. Die Item-Grafiken
von Sandbox Interactive gehören ihnen und sind dafür nicht verwendet worden.

## Was das Programm ins Netz schickt

Nichts von dir. Ausgehend gehen nur:

* **Preise** vom Albion Online Data Project (`*.albion-online-data.com`) – und
  nur auf Knopfdruck, nie von allein.
* **Item-Bilder** vom offiziellen Renderer (`render.albiononline.com`).
* **Schriften** von Google Fonts. Ohne Netz greifen die Ersatzschriften.

Deine eigenen Preise, Einstellungen und die Darstellungswahl liegen im
lokalen Speicher deines Rechners. Es gibt keine Anmeldung, kein Konto und
keine Zählpixel.

## Spenden

Das Toolkit ist kostenlos und bleibt es. In der Fußzeile steht ein
PayPal.Me-Link für alle, die freiwillig etwas dalassen möchten:
<https://www.paypal.com/paypalme/DevEnvi24>

**Ohne Gegenleistung** – das ist keine Floskel, sondern der Punkt: Sobald an
einer Zuwendung eine Gegenleistung hängt (Zugang zu Funktionen, Werbefreiheit,
Wunscherweiterungen), ist es Entgelt für eine Leistung und damit gewerblich.
Deshalb verspricht der Text nichts und wird auch nichts versprechen.
