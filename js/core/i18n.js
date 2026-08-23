/* Sprache: Item-Namen und Oberflächentexte.

   ITEM-NAMEN
   Die Datendateien führen jeden Gegenstand dreisprachig, und zwar mit
   genau den Namen, die auch im Spiel stehen (aus der Lokalisierung des
   Clients, ao-bin-dumps/formatted/items.json):
     n = Englisch, d = Deutsch, s = Spanisch
   Statt überall im Code zu unterscheiden, wird beim Umschalten einmal das
   Feld "n" auf die gewählte Sprache gesetzt - danach liest alles einfach
   ".n". Das englische Original bleibt in "_en" erhalten, damit das
   Umschalten beliebig oft in jede Richtung geht.

   OBERFLÄCHE
   Die Ansichten bauen ihr HTML mit deutschen Texten. Statt sechzehn
   Dateien umzubauen, übersetzt AO.i18n.dom() den fertig gezeichneten
   Baum: es ersetzt Textknoten und title-/placeholder-Angaben, die im
   Wörterbuch stehen. Was nicht drinsteht, bleibt unangetastet - deshalb
   bleiben Item-Namen und Zahlen immer, wie sie sind.
*/
(function () {
  "use strict";
  window.AO = window.AO || {};

  var SPRACHEN = [
    { v: 'de', n: 'Deutsch' },
    { v: 'en', n: 'English' },
    { v: 'es', n: 'Español' }
  ];

  var aktiv = null;

  /* --- Item-Namen ------------------------------------------------------ */
  function feldFuer(lang) {
    return lang === 'de' ? 'd' : lang === 'es' ? 's' : '_en';
  }

  function setze(obj, feld) {
    if (!obj) return;
    if (obj._en === undefined) obj._en = obj.n;   // Original einmal sichern
    obj.n = obj[feld] || obj._en;
  }

  /* Kategorie- und Gruppennamen sind unsere eigene Ordnung, nicht die des
     Spiels. Sie liegen in categories.js dreisprachig vor und werden - wie
     die Item-Namen - beim Umschalten an Ort und Stelle gesetzt, damit die
     Ansichten weiterhin einfach catDe lesen koennen. */
  function alleKategorien(lang) {
    var c = AO.data.categories;
    if (!c) return;
    if (!c._catDe) { c._catDe = c.catDe; c._groupDe = c.groupDe; }
    var suffix = lang === 'en' ? 'En' : lang === 'es' ? 'Es' : null;
    c.catDe   = suffix ? (c['cat' + suffix]   || c._catDe)   : c._catDe;
    c.groupDe = suffix ? (c['group' + suffix] || c._groupDe) : c._groupDe;
  }

  function alleGegenstaende(feld) {
    ['items', 'consumables', 'refining', 'fish'].forEach(function (k) {
      (AO.data[k] || []).forEach(function (o) { setze(o, feld); });
    });
    var m = AO.data.materials || {};
    Object.keys(m).forEach(function (k) { setze(m[k], feld); });
  }

  /* --- Oberfläche ------------------------------------------------------ */
  /* Wörterbuch: deutscher Text -> { en: …, es: … }. Wird von
     data/sprachen.js gefüllt; fehlt die Datei, bleibt alles deutsch. */
  function woerterbuch() { return AO.data.sprachen || {}; }

  /* Attribute, die sichtbaren Text tragen. */
  var ATTRS = ['title', 'placeholder', 'aria-label'];

  /* --- Muster mit Platzhaltern ----------------------------------------
     Viele Sätze tragen Zahlen oder Item-Namen in sich ("Bei 9 von 51 Wegen
     …"). Sie ändern sich bei jedem Neuzeichnen und lassen sich deshalb
     nicht über einen festen Schlüssel treffen. Solche Einträge stehen im
     Wörterbuch mit {n} für eine Zahl und {name} für einen Namen; hier
     werden sie einmalig zu einem regulären Ausdruck übersetzt, und die
     gefundenen Stücke wandern der Reihe nach in die Übersetzung.

     Der Zwischenspeicher ist kein Luxus: eine Tabelle mit hundert Zeilen
     bringt denselben Tooltip hundertmal mit. */
  var MUSTER = null;
  var GEMERKT = {};

  function musterBauen() {
    if (MUSTER) return MUSTER;
    MUSTER = [];
    var w = woerterbuch();
    Object.keys(w).forEach(function (k) {
      if (k.indexOf('{') < 0) return;
      var teile = k.split(/(\{n\}|\{name\})/);
      var re = '';
      teile.forEach(function (t) {
        /* {n} steht fuer eine Zahl - dort darf kein Buchstabe stehen.
           Sonst frisst ein kurzes Muster wie "{n}Stück" auch den Kopf
           "Preis je Stück" und macht daraus "Preis je units".
           {name} bleibt frei: dort stehen Orts- und Item-Namen. */
        if (t === '{n}') re += '([^A-Za-zÀ-ÖØ-öø-ÿ]*?)';
        else if (t === '{name}') re += '([\\s\\S]*?)';
        else re += t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
      MUSTER.push({ re: new RegExp('^' + re + '$'), ziel: w[k], len: k.length });
    });
    /* Das genauere Muster zuerst: "für {n}Stück · — je Stück" soll gewinnen
       und nicht das kurze "{n}Stück", das auf dasselbe Ende passt. Als Maß
       für Genauigkeit dient die Länge des Schlüssels. */
    MUSTER.sort(function (a, b) { return b.len - a.len; });
    return MUSTER;
  }

  function ueberMuster(roh, lang) {
    var liste = musterBauen();
    for (var i = 0; i < liste.length; i++) {
      var t = liste[i].ziel[lang];
      if (!t) continue;
      var m = liste[i].re.exec(roh);
      if (!m) continue;
      var k = 1;
      return t.replace(/\{n\}|\{name\}/g, function () { return m[k++] || ''; });
    }
    return null;
  }

  function uebersetze(text, lang) {
    if (lang === 'de' || typeof text !== 'string') return null;
    var roh = text.trim();
    if (roh.length < 2) return null;

    /* Die Ansichten setzen in "z. B." und zwischen Zahl und Einheit
       geschützte Leerzeichen. Im Wörterbuch stehen normale - deshalb wird
       zum Nachschlagen vereinheitlicht, ersetzt wird aber das Original,
       damit der Text sonst unverändert bleibt. */
    var norm = roh.replace(/[\u00a0\u202f]/g, ' ');

    var e = woerterbuch()[norm];
    if (e && e[lang]) return text.replace(roh, e[lang]);

    /* Nur was Platzhalter tragen könnte, durch die Muster schicken. */
    if (norm.length < 6) return null;
    var schluessel = lang + '\u0000' + norm;
    if (schluessel in GEMERKT) {
      return GEMERKT[schluessel] === null ? null : text.replace(roh, GEMERKT[schluessel]);
    }
    var neu = ueberMuster(norm, lang);
    GEMERKT[schluessel] = neu;
    return neu === null ? null : text.replace(roh, neu);
  }

  function domUebersetzen(wurzel, lang) {
    if (!wurzel || lang === 'de') return;
    var lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT, null);
    var knoten = [], n;
    while ((n = lauf.nextNode())) knoten.push(n);
    knoten.forEach(function (k) {
      var neu = uebersetze(k.nodeValue, lang);
      if (neu !== null) k.nodeValue = neu;
    });
    ATTRS.forEach(function (attr) {
      /* Der Wurzelknoten selbst gehört dazu: querySelectorAll findet nur
         Nachfahren, und der Beobachter reicht oft genau die eine Zeile
         herein, die den Tooltip trägt. */
      var liste = [].slice.call(wurzel.querySelectorAll('[' + attr + ']'));
      if (wurzel.nodeType === 1 && wurzel.hasAttribute(attr)) liste.unshift(wurzel);
      for (var i = 0; i < liste.length; i++) {
        var neu = uebersetze(liste[i].getAttribute(attr), lang);
        if (neu !== null) liste[i].setAttribute(attr, neu);
      }
    });
  }

  AO.i18n = {
    sprachen: SPRACHEN,

    lang: function () { return AO.store.get('lang', 'de'); },

    /* Item-Namen umstellen. Ohne Ereignis - der Aufrufer zeichnet neu. */
    apply: function (lang) {
      lang = (lang === 'de' || lang === 'es') ? lang : 'en';
      if (aktiv === lang) return;
      alleGegenstaende(feldFuer(lang));
      alleKategorien(lang);
      aktiv = lang;
      AO.store.set('lang', lang);
    },

    /* Umschalten samt Neuzeichnen der ganzen Anwendung. */
    set: function (lang) {
      AO.i18n.apply(lang);
      document.dispatchEvent(new CustomEvent('ao:lang'));
    },

    /* Einen frisch gezeichneten Teilbaum übersetzen. */
    dom: function (wurzel) { domUebersetzen(wurzel, AO.i18n.lang()); },

    /* Dauerhaft mitübersetzen.

       Die Ansichten zeichnen ihre Tabellen und Kästen bei jeder Änderung
       neu. Ein einmaliger Durchlauf beim Mounten würde deshalb nichts
       nützen. Der Beobachter übersetzt jeden neu eingehängten Teilbaum.
       Während des Übersetzens wird er abgehängt, damit die eigenen
       Änderungen ihn nicht erneut auslösen. */
    beobachte: function (wurzel) {
      if (!window.MutationObserver || !wurzel) return;
      var was = {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ATTRS
      };
      var b = new MutationObserver(function (eintraege) {
        if (AO.i18n.lang() === 'de') return;
        b.disconnect();
        try {
          eintraege.forEach(function (e) {
            /* Nachtraeglich gesetzte Tooltips: der Knoten bleibt, nur das
               Attribut wechselt - ohne diesen Zweig blieben sie deutsch. */
            if (e.type === 'attributes') {
              var alt = e.target.getAttribute(e.attributeName);
              var uebers = uebersetze(alt, AO.i18n.lang());
              if (uebers !== null) e.target.setAttribute(e.attributeName, uebers);
              return;
            }
            for (var i = 0; i < e.addedNodes.length; i++) {
              var k = e.addedNodes[i];
              if (k.nodeType === 1) domUebersetzen(k, AO.i18n.lang());
              else if (k.nodeType === 3) {
                var neu = uebersetze(k.nodeValue, AO.i18n.lang());
                if (neu !== null) k.nodeValue = neu;
              }
            }
          });
        } finally {
          b.observe(wurzel, was);
        }
      });
      b.observe(wurzel, was);
    },

    /* Einzelnen Text übersetzen, für Code, der Strings selbst zusammensetzt. */
    t: function (text) {
      var neu = uebersetze(text, AO.i18n.lang());
      return neu === null ? text : neu;
    }
  };
})();
