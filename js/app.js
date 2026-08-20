/* Startpunkt: Sidebar verdrahten, globale Einstellungen spiegeln, Router starten. */
(function () {
  "use strict";
  var S = AO.settings, U = AO.ui;

  /* Item-Namen in der gewaehlten Sprache bereitstellen (vor dem ersten Render) */
  AO.i18n.apply(AO.i18n.lang());

  /* --- Sprache ----------------------------------------------------------
     Drei Sprachen, mehr nicht: Deutsch, Englisch, Spanisch. Die Item-Namen
     stammen dabei immer aus der Lokalisierung des Spiels selbst - im
     Werkzeug steht also genau der Name, den man im Spiel sieht. */
  (function () {
    var sel = document.getElementById('langSel');
    if (!sel) return;
    U.fill(sel, AO.i18n.sprachen, AO.i18n.lang());
    sel.addEventListener('change', function () {
      AO.i18n.set(sel.value);
      /* Alles neu zeichnen: die Ansichten haben ihre Namen im HTML stehen. */
      location.reload();
    });
    /* Die Oberflaeche wird beim Zeichnen mituebersetzt. Beobachtet wird
       auch die Sidebar - sie entsteht erst beim Start des Routers. */
    /* Der ganze Rumpf, nicht nur der Ansichtsbereich: Kopfzeile,
       Seitenleiste und die Knoepfe darin werden beim Wechseln der
       Ansicht ebenfalls neu gezeichnet. */
    AO.i18n.beobachte(document.body);
  })();

  /* --- globale Server-Auswahl ------------------------------------------- */
  var sel = document.getElementById('globalServer');
  U.fill(sel, Object.keys(AO.data.servers).map(function (k) {
    return { v: k, n: AO.data.servers[k].name };
  }), S.server);

  sel.addEventListener('change', function () {
    S.server = sel.value; S.$save();
    /* Refining-Rechner bringt eine eigene Serverauswahl mit - mitziehen,
       ohne seine Logik anzufassen. */
    var own = document.getElementById('serverSel');
    if (own && own.value !== S.server) {
      own.value = S.server;
      own.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.dispatchEvent(new CustomEvent('ao:server'));
    U.toast('Server: ' + AO.data.servers[S.server].name);
  });

  /* umgekehrt: Aenderung im Refining-Rechner in die Kopfzeile spiegeln */
  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'serverSel' && e.target.value !== S.server) {
      S.server = e.target.value; S.$save();
      sel.value = S.server;
      document.dispatchEvent(new CustomEvent('ao:server'));
    }
  });

  /* --- Sidebar ein-/ausklappen ------------------------------------------ */
  var app = document.getElementById('app');
  if (AO.store.get('sidebarCollapsed', false)) app.classList.add('collapsed');

  document.getElementById('sbToggle').addEventListener('click', function () {
    app.classList.toggle('collapsed');
    AO.store.set('sidebarCollapsed', app.classList.contains('collapsed'));
  });
  document.getElementById('burger').addEventListener('click', function () {
    app.classList.toggle('nav-open');
  });
  document.getElementById('navScrim').addEventListener('click', function () {
    app.classList.remove('nav-open');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') app.classList.remove('nav-open');
  });

  /* --- Darstellung ------------------------------------------------------
     Drei Schalter, die nichts an den Rechnungen aendern, aber daran, ob man
     sie lesen kann:

     Ansicht   hell (Pergament) oder dunkel
     Farben    "Kontrast" ersetzt Rot/Gruen durch Blau/Zinnober und stellt
               Gewinn und Verlust ein Dreieck voran. Bei einer Rot-Gruen-
               Schwaeche sind gerade Gewinn und Verlust sonst nicht zu
               trennen - und das ist die wichtigste Unterscheidung im ganzen
               Werkzeug.
     Dichte    "Kompakt" schrumpft die Tabellen so weit, dass auch die
               breiten ohne Schieben auf den Bildschirm passen.

     Alles haengt an Attributen auf <html>, damit CSS allein die Arbeit
     macht und keine Ansicht davon wissen muss. */
  var DARSTELLUNG = [
    { id: 'theme',   attr: 'data-theme',   vor: 'parchment', seg: 'themeSeg' },
    { id: 'colors',  attr: 'data-colors',  vor: 'normal',    seg: 'colorSeg' },
    { id: 'density', attr: 'data-density', vor: 'kompakt',   seg: 'densitySeg' }
    /* Kompakt ist die Vorgabe: nur damit passen auch die breiten
       Tabellen ohne Schieben auf den Bildschirm. */
  ];

  DARSTELLUNG.forEach(function (d) {
    var wert = AO.store.get('ui.' + d.id, d.vor);
    document.documentElement.setAttribute(d.attr, wert);
    var seg = document.getElementById(d.seg);
    if (!seg) return;
    function malen() {
      U.qa('button', seg).forEach(function (b) {
        b.classList.toggle('on', b.dataset.v === wert);
      });
    }
    malen();
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]'); if (!b) return;
      wert = b.dataset.v;
      AO.store.set('ui.' + d.id, wert);
      document.documentElement.setAttribute(d.attr, wert);
      malen();
    });
  });

  /* Einstellungsspalte ausblenden - die breiten Ergebnistabellen bekommen
     damit rund 340 Pixel mehr. Gilt fuer alle Ansichten mit geteiltem
     Aufbau und haelt sich ueber den Ansichtswechsel. */
  (function () {
    var knopf = document.getElementById('sideToggle');
    if (!knopf) return;
    var zu = AO.store.get('ui.noSide', false);
    function anwenden() {
      U.qa('.split').forEach(function (n) { n.classList.toggle('no-side', zu); });
      knopf.classList.toggle('primary', zu);
      knopf.textContent = zu ? 'Spalte zeigen' : 'Spalte weg';
      knopf.title = zu
        ? 'Einstellungsspalte wieder einblenden'
        : 'Einstellungsspalte ausblenden - gibt den Tabellen die volle Breite';
    }
    anwenden();
    knopf.addEventListener('click', function () {
      zu = !zu; AO.store.set('ui.noSide', zu); anwenden();
    });
    /* Neu aufgebaute Ansichten bringen ihr eigenes .split mit. */
    window.addEventListener('hashchange', function () { setTimeout(anwenden, 0); });
  })();

  /* --- los -------------------------------------------------------------- */
  AO.router.start();

  /* Erst jetzt uebersetzen: die Sidebar baut der Router, und die Fusszeile
     steht zwar im HTML, wird aber zusammen mit allem anderen erfasst. */
  AO.i18n.dom(document.body);
})();
