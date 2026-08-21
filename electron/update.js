/* Nachsehen, ob es eine neuere Fassung gibt.

   Bewusst zurueckhaltend:
   - Es wird nur *gefragt*, nichts heruntergeladen und nichts installiert.
     Ein Klick oeffnet die Release-Seite im Browser, den Installer startet
     man wie immer selbst. Damit braucht es weder eine zusaetzliche
     Abhaengigkeit noch das Abschalten der Signaturpruefung, die bei
     unsignierten Dateien sonst im Weg stuende.
   - Faellt die Abfrage aus - kein Netz, GitHub nicht erreichbar, Antwort
     unverstaendlich - passiert gar nichts. Ein Fehlerfenster beim Start
     waere schlimmer als eine verpasste Version.
   - Wer eine Fassung ueberspringt, wird zu genau dieser nicht mehr
     gefragt.
   - Nur in der installierten Fassung. Beim Entwickeln waere es Laerm.
*/
'use strict';

const { app, dialog, shell, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const REPO = 'envious9494-bit/albiononlinecraftingtool';
const SEITE = 'https://github.com/' + REPO + '/releases/latest';
const VERZOEGERUNG = 4000;   // erst das Fenster, dann die Frage

/* --- gemerkte Entscheidungen ------------------------------------------- */
function datei() {
  return path.join(app.getPath('userData'), 'update.json');
}

function lesen() {
  try { return JSON.parse(fs.readFileSync(datei(), 'utf8')) || {}; }
  catch (e) { return {}; }
}

function schreiben(d) {
  try { fs.writeFileSync(datei(), JSON.stringify(d)); }
  catch (e) { /* dann wird eben nochmal gefragt */ }
}

/* --- Versionsvergleich --------------------------------------------------
   Reicht fuer "1.2.10" gegen "1.3.0". Nachgestelltes wie "-beta" wird
   abgeschnitten und gilt als aelter, damit eine Vorabfassung keine
   Aktualisierung ausloest. */
function teile(v) {
  return String(v || '').replace(/^v/, '').split('-')[0].split('.')
    .map(function (x) { return parseInt(x, 10) || 0; });
}

function istNeuer(fremd, eigen) {
  const a = teile(fremd), b = teile(eigen);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

/* --- Texte --------------------------------------------------------------
   Die Sprache steht im Browserspeicher der Seite; das Hauptfenster fragt
   sie dort ab. Klappt das nicht, bleibt es bei Deutsch. */
const TEXTE = {
  de: {
    titel: 'Neue Fassung verfügbar',
    kopf: 'Albion Toolkit {neu} ist da.',
    text: 'Du hast {alt}. Die neue Fassung wird über den Installer eingespielt; ' +
          'deine eigenen Preise und Einstellungen bleiben erhalten.',
    laden: 'Jetzt herunterladen',
    spaeter: 'Später',
    ueberspringen: 'Diese Fassung überspringen'
  },
  en: {
    titel: 'A new version is available',
    kopf: 'Albion Toolkit {neu} is out.',
    text: 'You have {alt}. The new version is installed through the installer; ' +
          'your own prices and settings are kept.',
    laden: 'Download now',
    spaeter: 'Later',
    ueberspringen: 'Skip this version'
  },
  es: {
    titel: 'Hay una versión nueva',
    kopf: 'Albion Toolkit {neu} ya está disponible.',
    text: 'Tienes {alt}. La versión nueva se instala con el instalador; ' +
          'tus precios y ajustes propios se conservan.',
    laden: 'Descargar ahora',
    spaeter: 'Más tarde',
    ueberspringen: 'Omitir esta versión'
  }
};

function spracheHolen(win) {
  return win.webContents
    .executeJavaScript("(window.AO && AO.i18n && AO.i18n.lang && AO.i18n.lang()) || 'de'", true)
    .then(function (l) { return TEXTE[l] ? l : 'de'; })
    .catch(function () { return 'de'; });
}

/* --- Abfrage ------------------------------------------------------------ */
function neuesteFassung() {
  return new Promise(function (fertig, fehler) {
    const anfrage = net.request({
      method: 'GET',
      url: 'https://api.github.com/repos/' + REPO + '/releases/latest'
    });
    anfrage.setHeader('Accept', 'application/vnd.github+json');
    anfrage.setHeader('User-Agent', 'AlbionToolkit/' + app.getVersion());

    let roh = '';
    const abbruch = setTimeout(function () {
      try { anfrage.abort(); } catch (e) { /* egal */ }
      fehler(new Error('Zeitüberschreitung'));
    }, 8000);

    anfrage.on('response', function (antwort) {
      antwort.on('data', function (stueck) { roh += stueck; });
      antwort.on('end', function () {
        clearTimeout(abbruch);
        try {
          const d = JSON.parse(roh);
          if (!d || !d.tag_name) throw new Error('keine Fassung genannt');
          fertig({ version: d.tag_name, seite: d.html_url || SEITE });
        } catch (e) { fehler(e); }
      });
    });
    anfrage.on('error', function (e) { clearTimeout(abbruch); fehler(e); });
    anfrage.end();
  });
}

/* Der Inhalt des Fensters - getrennt, damit er sich ohne Electron
   nachlesen und pruefen laesst. */
function nachricht(lang, neueVersion, eigeneVersion) {
  const t = TEXTE[lang] || TEXTE.de;
  return {
    type: 'info',
    title: t.titel,
    message: t.kopf.replace('{neu}', teile(neueVersion).join('.')),
    detail: t.text.replace('{alt}', eigeneVersion),
    buttons: [t.laden, t.spaeter, t.ueberspringen],
    defaultId: 0,
    cancelId: 1,
    noLink: true
  };
}

function fragen(win, neu, eigene) {
  return spracheHolen(win).then(function (lang) {
    const inhalt = nachricht(lang, neu.version, eigene);
    if (process.env.AO_UPDATE_TEST) {
      console.log('DIALOG ' + JSON.stringify({ sprache: lang, titel: inhalt.title,
        text: inhalt.message, knoepfe: inhalt.buttons }));
    }
    return dialog.showMessageBox(win, inhalt).then(function (antwort) {
      if (antwort.response === 0) shell.openExternal(neu.seite);
      if (antwort.response === 2) {
        const d = lesen();
        d.uebersprungen = neu.version;
        schreiben(d);
      }
    });
  });
}

/* Einstiegspunkt. Wirft nie - jeder Fehlschlag endet still. */
function pruefen(win) {
  /* AO_UPDATE_TEST=<version> laesst die Pruefung auch ungepackt laufen und
     tut so, als waere die angegebene Fassung installiert. Nur zum
     Nachpruefen - im Alltag ist die Variable nicht gesetzt. */
  const probe = process.env.AO_UPDATE_TEST;
  if (!app.isPackaged && !probe) return;
  const eigene = (probe && probe !== '1') ? probe : app.getVersion();

  setTimeout(function () {
    neuesteFassung().then(function (neu) {
      if (!istNeuer(neu.version, eigene)) return;
      if (lesen().uebersprungen === neu.version) return;
      if (!win || win.isDestroyed()) return;
      return fragen(win, neu, eigene);
    }).catch(function () {
      /* Still. Kein Netz ist kein Grund, jemanden anzusprechen. */
    });
  }, VERZOEGERUNG);
}

module.exports = { pruefen, istNeuer, teile, nachricht, neuesteFassung, TEXTE };
