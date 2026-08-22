/* Sidebar-Navigation und Hash-Routing.
   Views werden beim ersten Aufruf erzeugt und danach nur ein-/ausgeblendet -
   so behaelt jede View ihren Zustand (wichtig fuer den Refining-Rechner). */
(function () {
  "use strict";
  window.AO = window.AO || {};

  /* Geordnet nach dem, was man vorhat - nicht danach, wann es entstanden
     ist. Zuerst die Frage "wo ist gerade Geld zu holen?", danach die
     Rechner fuer den konkreten Fall, zuletzt das Beiwerk. */
  var NAV = [
    { group: null, items: [
      { id: 'dashboard', icon: '\u2756', label: '\u00dcbersicht' }
    ]},
    { group: 'Wo lohnt es sich?', items: [
      { id: 'craftscan',   icon: '\u2726', label: 'Craft-Chancen',
        hint: 'Alles Herstellbare auf einen Blick' },
      { id: 'upgrade',     icon: '\u2727', label: 'Aufwertung',
        hint: 'Runen, Seelen, Relikte \u2013 und die Flip-Suche' },
      { id: 'opportunity', icon: '\u25c9', label: 'Refining-Chancen',
        hint: 'Rohstoffe, Nahrung, Tr\u00e4nke' }
    ]},
    { group: 'Rechner', items: [
      { id: 'refining', icon: '\u2692', label: 'Refining' },
      { id: 'crafting', icon: '\u2694', label: 'Crafting' },
      { id: 'cooking',  icon: '\u2668', label: 'Kochen' },
      { id: 'potion',   icon: '\u2697', label: 'Tr\u00e4nke' },
      { id: 'batch',    icon: '\u25a6', label: 'Serien' },
      { id: 'sheet',    icon: '\u270e', label: 'Freier Rechner',
        hint: 'Eigene Positionen und Abgaben' }
    ]},
    { group: 'Werkzeuge', items: [
      { id: 'profit',   icon: '\u2197', label: 'Gewinn' },
      { id: 'material', icon: '\u25a4', label: 'Materialkosten' },
      { id: 'tax',      icon: '%',       label: 'Steuer' },
      { id: 'focus',    icon: '\u25ce', label: 'Fokus' },
      { id: 'resource', icon: '\u25c8', label: 'Ressourcenwert' },
      { id: 'fame',     icon: '\u2605', label: 'Fame' }
    ]},
    { group: null, items: [
      { id: 'settings', icon: '\u2699', label: 'Einstellungen' }
    ]}
  ];

  var current = null;

  AO.router = {
    nav: NAV,

    start: function () {
      buildSidebar();
      window.addEventListener('hashchange', function () { go(hashView()); });
      go(hashView());
    },

    go: function (id) { location.hash = '#/' + id; },

    currentId: function () { return current; }
  };

  function hashView() {
    var m = (location.hash || '').match(/^#\/([\w-]+)/);
    var id = m ? m[1] : 'dashboard';
    return AO.views[id] ? id : 'dashboard';
  }

  function buildSidebar() {
    var nav = document.getElementById('sbNav');
    nav.innerHTML = NAV.map(function (g) {
      return '<div class="sb-group">' +
        (g.group ? '<div class="sb-label">' + g.group + '</div>' : '') +
        g.items.map(function (i) {
          return '<a class="sb-link" href="#/' + i.id + '" data-view="' + i.id +
            '" title="' + (i.hint ? i.label + ' \u2013 ' + i.hint : i.label) + '">' +
            '<span class="sb-ico">' + i.icon + '</span><span class="sb-txt">' + i.label + '</span></a>';
        }).join('') + '</div>';
    }).join('');
  }

  function go(id) {
    var view = AO.views[id];
    if (!view) return;
    current = id;

    /* Sidebar markieren */
    AO.ui.qa('.sb-link').forEach(function (a) {
      a.classList.toggle('on', a.dataset.view === id);
    });

    /* Kopfzeile */
    document.getElementById('tbTitle').textContent = view.title;
    document.getElementById('tbSub').textContent = view.subtitle || '';
    /* Der Fenstertitel steht nicht im Baum und wird deshalb nicht vom
       Beobachter erfasst - hier von Hand übersetzen. */
    document.title = AO.i18n.t(view.title) + ' · Albion Toolkit';

    /* View-Container anlegen oder wiederverwenden */
    var host = document.getElementById('viewHost');
    var el = document.getElementById('view-' + id);
    if (el && el.dataset.failed) { el.remove(); el = null; }
    if (!el) {
      el = document.createElement('section');
      el.id = 'view-' + id;
      el.className = 'view view-' + id;
      el.innerHTML = view.html();
      host.appendChild(el);
      try { view.mount(el); }
      catch (err) {
        /* Der halb aufgebaute Container wird verworfen, damit beim naechsten
           Aufruf wirklich neu gemountet wird - sonst bleiben Ereignis-
           Empfaenger auf abgehaengten Knoten zurueck. */
        el.remove();
        el = document.createElement('section');
        el.id = 'view-' + id;
        el.className = 'view view-' + id;
        el.dataset.failed = '1';
        el.innerHTML = '<div class="notice err">Diese Ansicht konnte nicht geladen werden: ' +
          AO.fmt.esc(err && err.message || String(err)) +
          '</div><p class="hint">Beim nächsten Aufruf wird sie erneut aufgebaut.</p>';
        host.appendChild(el);
        if (window.console) console.error('[' + id + ']', err);
      }
    } else if (view.refresh) {
      try { view.refresh(el); } catch (err) { if (window.console) console.error('[' + id + ']', err); }
    }

    try { AO.ui.foldCards(el, id); } catch (err) { if (window.console) console.error('[fold]', err); }

    AO.ui.qa('#viewHost > .view').forEach(function (v) { v.hidden = (v !== el); });

    /* Wurden anderswo Preise geaendert, waehrend diese Ansicht verborgen war,
       rechnet sie jetzt nach - sonst stuenden hier veraltete Zahlen. */
    if (el._aoDirty && el._aoRefresh) {
      el._aoDirty = false;
      try { el._aoRefresh(); } catch (err) { if (window.console) console.error('[' + id + ']', err); }
    }

    /* Mobil: Menue schliessen, nach oben scrollen */
    document.getElementById('app').classList.remove('nav-open');
    window.scrollTo({ top: 0, behavior: 'instant' in document.body.style ? 'instant' : 'auto' });
  }
})();
