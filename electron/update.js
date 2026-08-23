/* Haelt sich selbst auf dem neuesten Stand - ohne zu fragen.

   Ablauf: beim Start wird still bei GitHub nachgesehen. Gibt es eine
   neuere Fassung, wird sie im Hintergrund geladen und beim naechsten
   Beenden eingespielt. Es erscheint kein Fenster und keine Frage.

   Warum kein Browser-Download mehr: electron-updater holt den Installer
   selbst und prueft ihn gegen die SHA-512-Summe aus der latest.yml, die
   electron-builder beim Bauen erzeugt. Eine Datei, die so hereinkommt,
   traegt kein "Mark of the Web" - deshalb faellt auch die blaue
   SmartScreen-Meldung weg, die beim Herunterladen ueber den Browser
   erscheint.

   Auf die Signaturpruefung von Windows kann sich das nicht stuetzen: das
   Programm ist nicht signiert. Die Pruefsumme aus der latest.yml ist die
   Absicherung - und die kommt ueber HTTPS von GitHub.

   Grundsatz wie vorher: faellt irgendetwas aus - kein Netz, GitHub nicht
   erreichbar, Antwort unverstaendlich - passiert gar nichts. Ein
   Fehlerfenster beim Start waere schlimmer als eine verpasste Fassung.
   Deshalb faengt hier jeder Pfad seine Fehler selbst ab.
*/
'use strict';

const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const VERZOEGERUNG = 4000;   // erst das Fenster zeigen, dann das Netz belasten

/* --- Tagebuch -----------------------------------------------------------
   Still heisst nicht spurlos. Wenn eine Aktualisierung einmal klemmt,
   soll nachlesbar sein, woran es lag - ohne dass jemand dafuer beim
   Start angesprochen wird. Die Datei wird bei jedem Start neu begonnen,
   damit sie nicht unbegrenzt waechst. */
function logDatei() {
  return path.join(app.getPath('userData'), 'update.log');
}

let ersterEintrag = true;
function notiz(text) {
  try {
    const zeile = new Date().toISOString() + '  ' + text + '\n';
    if (ersterEintrag) { fs.writeFileSync(logDatei(), zeile); ersterEintrag = false; }
    else fs.appendFileSync(logDatei(), zeile);
  } catch (e) { /* dann eben ohne Tagebuch */ }
  if (process.env.AO_UPDATE_TEST) console.log('UPDATE ' + text);
}

/* electron-updater erwartet einen Logger mit diesen vier Namen. */
const logger = {
  info: function (m) { notiz('info  ' + m); },
  warn: function (m) { notiz('warn  ' + m); },
  error: function (m) { notiz('FEHLER ' + m); },
  debug: function () { /* zu gespraechig */ }
};

/* --- Stand fuer die Oberflaeche -----------------------------------------
   Die Seite laeuft abgeschottet: kein Node, kein Preload, keine
   IPC-Bruecke. Der Stand wird deshalb von hier aus hineingeschrieben -
   nur in diese eine Richtung, ohne dass die Seite dafuer Rechte braucht.
   Gelesen wird er in js/views/settings.js. */
let STAND = { zustand: 'ruht', version: app.getVersion() };

function standSetzen(win, neu) {
  STAND = Object.assign({}, STAND, neu);
  if (!win || win.isDestroyed()) return;
  win.webContents.executeJavaScript(
    'window.AO && (AO.update = ' + JSON.stringify(STAND) + ') && ' +
    'document.dispatchEvent(new CustomEvent("ao:update"));',
    true
  ).catch(function () { /* Seite noch nicht so weit - beim naechsten Mal */ });
}

/* --- Versionsvergleich --------------------------------------------------
   electron-updater vergleicht selbst; das hier bleibt, weil es geprueft
   ist und an zwei Stellen zum Nachsehen gebraucht wird. */
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

/* --- Einstiegspunkt ----------------------------------------------------- */
function pruefen(win) {
  /* Ungepackt gibt es keine installierte Fassung, die sich ersetzen
     liesse - electron-updater bricht dort ohnehin ab. AO_UPDATE_TEST
     laesst die Pruefung trotzdem laufen, um sie nachsehen zu koennen. */
  const probe = process.env.AO_UPDATE_TEST;
  if (!app.isPackaged && !probe) return;

  let autoUpdater;
  try {
    autoUpdater = require('electron-updater').autoUpdater;
  } catch (e) {
    notiz('electron-updater nicht ladbar: ' + e.message);
    return;
  }

  autoUpdater.logger = logger;
  autoUpdater.autoDownload = true;           /* still laden */
  autoUpdater.autoInstallOnAppQuit = true;   /* beim Beenden einspielen */
  autoUpdater.allowPrerelease = false;       /* Vorabfassungen aussen vor */
  if (probe) autoUpdater.forceDevUpdateConfig = true;

  autoUpdater.on('checking-for-update', function () {
    standSetzen(win, { zustand: 'sieht nach' });
  });
  autoUpdater.on('update-not-available', function () {
    notiz('nichts Neues - ' + app.getVersion() + ' ist aktuell');
    standSetzen(win, { zustand: 'aktuell' });
  });
  autoUpdater.on('update-available', function (i) {
    notiz('neue Fassung ' + i.version + ' gefunden, wird geladen');
    standSetzen(win, { zustand: 'laedt', neu: i.version });
  });
  autoUpdater.on('download-progress', function (p) {
    standSetzen(win, { zustand: 'laedt', prozent: Math.round(p.percent) });
  });
  autoUpdater.on('update-downloaded', function (i) {
    notiz('Fassung ' + i.version + ' liegt bereit, wird beim Beenden eingespielt');
    standSetzen(win, { zustand: 'bereit', neu: i.version });
  });
  autoUpdater.on('error', function (e) {
    notiz('Abfrage fehlgeschlagen: ' + ((e && e.message) || e));
    standSetzen(win, { zustand: 'fehlgeschlagen' });
  });

  setTimeout(function () {
    /* checkForUpdates gibt ein Promise zurueck, das bei Netzfehlern
       abgelehnt wird - unbehandelt waere das eine Warnung auf der
       Konsole und im schlimmsten Fall ein Absturz. */
    try {
      const p = autoUpdater.checkForUpdates();
      if (p && p.catch) p.catch(function () { /* das error-Ereignis hat es schon notiert */ });
    } catch (e) {
      notiz('Abfrage nicht moeglich: ' + e.message);
    }
  }, VERZOEGERUNG);
}

function stand() { return STAND; }

module.exports = { pruefen, istNeuer, teile, stand };
