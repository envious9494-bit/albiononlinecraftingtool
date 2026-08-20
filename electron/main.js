/* Electron-Huelle fuer das Albion Toolkit.

   Die Anwendung selbst bleibt unangetastet: hier wird nur ein Fenster
   geoeffnet und index.html hineingeladen - dieselbe Datei, die auch per
   Doppelklick im Browser laeuft. Es gibt keinen Server, keinen Build-Schritt
   fuer die Oberflaeche und keine Node-Schnittstelle in der Seite.

   Sicherheit: nodeIntegration bleibt aus, contextIsolation an. Die Seite
   bekommt also keinerlei Zugriff auf das Dateisystem - sie braucht ihn auch
   nicht, sie rechnet nur und fragt zwei fremde Dienste nach Preisen und
   Bildern.
*/
'use strict';

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

/* Fenstergroesse und -lage merken. Liegt in userData, nicht im Programm-
   ordner - sonst schriebe die Anwendung in ihr eigenes Installations-
   verzeichnis, was unter Programme nicht erlaubt ist. */
function lageDatei() {
  return path.join(app.getPath('userData'), 'fenster.json');
}

function lageLesen() {
  try {
    const d = JSON.parse(fs.readFileSync(lageDatei(), 'utf8'));
    if (d && d.width > 400 && d.height > 300) return d;
  } catch (e) { /* erster Start, oder Datei kaputt - dann Vorgabe */ }
  return { width: 1500, height: 950 };
}

function lageSchreiben(win) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(lageDatei(), JSON.stringify({
      width: b.width, height: b.height, x: b.x, y: b.y,
      maximiert: win.isMaximized()
    }));
  } catch (e) { /* nicht schlimm, dann startet es beim naechsten Mal mittig */ }
}

function fensterAufmachen() {
  const lage = lageLesen();

  const win = new BrowserWindow({
    width: lage.width,
    height: lage.height,
    x: lage.x,
    y: lage.y,
    minWidth: 900,
    minHeight: 600,
    /* Farbe des Rahmens waehrend des Ladens - sonst blitzt Weiss auf. */
    backgroundColor: '#2a201a',
    title: 'Albion Toolkit',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  if (lage.maximiert) win.maximize();

  win.once('ready-to-show', function () { win.show(); });
  win.on('close', function () { lageSchreiben(win); });

  /* Aussenlinks im richtigen Browser oeffnen, nicht in einem zweiten
     Programmfenster ohne Adresszeile. */
  win.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', function (e, url) {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  return win;
}

/* Schlankes Menue: Neu laden und Entwicklerwerkzeuge bleiben drin, weil sie
   beim Nachsehen helfen, wenn eine Preisabfrage klemmt. */
function menueBauen() {
  return Menu.buildFromTemplate([
    {
      label: 'Datei',
      submenu: [
        { label: 'Neu laden', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { type: 'separator' },
        { label: 'Beenden', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
      ]
    },
    {
      label: 'Ansicht',
      submenu: [
        { label: 'Vergrößern', role: 'zoomIn' },
        { label: 'Verkleinern', role: 'zoomOut' },
        { label: 'Normalgröße', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Vollbild', role: 'togglefullscreen' },
        { label: 'Entwicklerwerkzeuge', role: 'toggleDevTools' }
      ]
    }
  ]);
}

app.whenReady().then(function () {
  Menu.setApplicationMenu(menueBauen());
  fensterAufmachen();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) fensterAufmachen();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
