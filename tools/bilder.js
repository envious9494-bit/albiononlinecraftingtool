/* Bildschirmfotos fuer die README.

   Aufruf aus dem Projektstamm:   npm run bilder

   Warum Electron und kein Browser-Werkzeug: Electron liegt ohnehin als
   Entwicklungsabhaengigkeit im Projekt, zeichnet die Seite genau wie der
   fertige Client und laesst sich vollstaendig fernsteuern - Marktpreise
   laden, Scans starten, Thema umschalten.

   Zwei Dinge waren beim ersten Anlauf falsch:
   - .view hat eine Einblend-Animation (viewIn). Wer sofort aufnimmt,
     bekommt eine halb durchsichtige Seite. Deshalb ueberall reichlich
     Wartezeit nach dem Ansichtswechsel.
   - Hell/Dunkel und die Kontrastfarben werden ueber die Schalter der
     Anwendung umgestellt, nicht ueber das Attribut - sonst zeigt die
     Kopfzeile weiter die alte Stellung an. */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const WURZEL = path.join(__dirname, '..');
const ZIEL = path.join(WURZEL, 'docs', 'bilder');
const BREITE = 1440, HOEHE = 900;
const RUHE = 2600;                     // Einblend-Animation abwarten

function warte(ms) { return new Promise(r => setTimeout(r, ms)); }
async function js(w, code) { return w.webContents.executeJavaScript(code, true); }

async function bild(w, name) {
  w.webContents.invalidate();
  await warte(900);                      // frisches Einzelbild abwarten
  const b = await w.webContents.capturePage();
  const datei = path.join(ZIEL, name + '.png');
  fs.writeFileSync(datei, b.toPNG());
  console.log('  ' + name + '.png  ' + Math.round(fs.statSync(datei).size / 1024) + ' KB');
}

async function bisFertig(w, pruefung, maxMs) {
  const bis = Date.now() + (maxMs || 60000);
  while (Date.now() < bis) {
    if (await js(w, pruefung)) return true;
    await warte(500);
  }
  return false;
}

async function ansicht(w, hash, ms) {
  await js(w, "location.hash = '" + hash + "'");
  await warte(ms || RUHE);
}

async function druecke(w, view, x) {
  return js(w, "(function(){var b=document.querySelector('#view-" + view +
    " [data-x=\"" + x + "\"]'); if(!b) return false; b.click(); return true;})()");
}

/* Schalter der Kopfzeile bedienen, damit die Anzeige mitzieht. */
async function schalte(w, segId, wert) {
  return js(w, "(function(){var s=document.getElementById('" + segId + "');" +
    "if(!s) return false; var b=s.querySelector('[data-v=\"" + wert + "\"]');" +
    "if(!b) return false; b.click(); return true;})()");
}

async function zeige(w, selektor) {
  await js(w, "(function(){var e=document.querySelector('" + selektor + "');" +
    "if(e) e.scrollIntoView({block:'start'}); return !!e;})()");
  await warte(1200);
}

async function nachOben(w) {
  await js(w, "(function(){var h=document.getElementById('viewHost');" +
    "if(h) h.scrollTop=0; window.scrollTo(0,0);" +
    "document.querySelectorAll('*').forEach(function(e){if(e.scrollTop>0&&e.scrollHeight>e.clientHeight+40)e.scrollTop=0;});" +
    "return true;})()");
  await warte(600);
}

app.whenReady().then(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });

  /* Offscreen-Rendering: ein bloss verstecktes Fenster zeichnet nicht
     durchgehend, capturePage lieferte dann das letzte alte Einzelbild -
     einmal die halb eingeblendete Seite, einmal die helle Fassung, obwohl
     laengst auf Dunkel geschaltet war. */
  const w = new BrowserWindow({
    width: BREITE, height: HOEHE, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, offscreen: true }
  });
  w.webContents.setFrameRate(30);
  w.setContentSize(BREITE, HOEHE);
  await w.loadFile(path.join(WURZEL, 'index.html'));
  await warte(3000);

  await js(w, "AO.store.set('lang','de'); AO.store.set('ui.theme','parchment');" +
              "AO.store.set('ui.colors','normal'); AO.store.set('ui.density','kompakt'); true");
  w.reload();
  await warte(3000);

  console.log('Marktpreise laden ...');
  await ansicht(w, '#/crafting');
  await druecke(w, 'crafting', 'load');
  console.log('  ' + (await bisFertig(w, "!!(AO.market && AO.market.has && AO.market.has())", 90000)
    ? 'Marktdaten geladen' : 'Marktdaten unvollstaendig'));
  await warte(2000);

  /* 1 - Uebersicht */
  await ansicht(w, '#/dashboard', 3500);
  await nachOben(w);
  await bild(w, '01-uebersicht');

  /* 2 - Craft-Chancen mit Ergebnissen */
  await ansicht(w, '#/craftscan');
  await druecke(w, 'craftscan', 'scan');
  await bisFertig(w, "document.querySelectorAll('#view-craftscan table.data tbody tr').length > 5", 120000);
  await warte(2000);
  await nachOben(w);
  await bild(w, '02-craft-chancen');

  /* 3 - Aufwertung mit Ergebnissen */
  await ansicht(w, '#/upgrade');
  await druecke(w, 'upgrade', 'load');
  await warte(8000);
  await druecke(w, 'upgrade', 'scan');
  await bisFertig(w, "document.querySelectorAll('#view-upgrade table.data tbody tr').length > 5", 120000);
  await warte(2000);
  await nachOben(w);
  await bild(w, '03-aufwertung');

  /* 4 - Einzelrechner Crafting mit einem gaengigen Gegenstand */
  await ansicht(w, '#/crafting');
  await js(w, "AO.views.crafting && AO.views.crafting.select && AO.views.crafting.select('T6_MAIN_SWORD')");
  await warte(2500);
  await nachOben(w);
  await bild(w, '04-crafting-rechner');

  /* 5 - Koch-Rechner mit einem echten Gericht */
  await ansicht(w, '#/cooking');
  await druecke(w, 'cooking', 'load');
  await warte(7000);
  await js(w, "AO.views.cooking && AO.views.cooking.select && AO.views.cooking.select('T6_MEAL_STEW')");
  await warte(2500);
  await nachOben(w);
  await bild(w, '05-koch-rechner');

  /* 6 - Gewinnuebersicht: was lohnt sich auf einen Blick */
  await druecke(w, 'cooking', 'profScan');
  await bisFertig(w, "document.querySelectorAll('#view-cooking [data-x=\"profRows\"] tr').length > 3", 90000);
  await warte(2000);
  await zeige(w, '#view-cooking [data-x="profRows"]');
  await bild(w, '06-koch-gewinnuebersicht');

  /* 7 - dunkle Fassung */
  await schalte(w, 'themeSeg', 'dark');
  await warte(1200);
  await ansicht(w, '#/craftscan', 3200);
  await nachOben(w);
  await bild(w, '07-dunkel');

  /* 8 - Kontrastfarben fuer Rot-Gruen-Schwaeche */
  await schalte(w, 'colorSeg', 'cb');
  await warte(2500);
  await nachOben(w);
  await bild(w, '08-kontrastfarben');

  /* 9 - Einstellungen, wieder hell und normale Farben */
  await schalte(w, 'themeSeg', 'parchment');
  await schalte(w, 'colorSeg', 'normal');
  await warte(1200);
  await ansicht(w, '#/settings', 3200);
  await nachOben(w);
  await bild(w, '09-einstellungen');

  console.log('fertig');
  app.exit(0);
}).catch(e => { console.error('FEHLER', e); app.exit(1); });
