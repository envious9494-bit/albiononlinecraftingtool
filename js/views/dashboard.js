/* Dashboard: Einstieg, Datenlage und Schnellzugriff. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  var TOOLS = [
    { id: 'refining', icon: '⚒', t: 'Refining-Rechner',  d: 'Rohstoffe zu Barren, Brettern, Stoff, Leder, Steinblöcken.' },
    { id: 'crafting', icon: '⚔', t: 'Crafting-Rechner',  d: 'Waffen, Rüstung und Zubehör mit echten Rezepten.' },
    { id: 'cooking',  icon: '🍲', t: 'Koch-Rechner',      d: 'Gerichte samt Zutatenliste und Gewinn.' },
    { id: 'potion',   icon: '⚗', t: 'Trank-Rechner',     d: 'Tränke aus dem Alchemielabor.' },
    { id: 'profit',   icon: '↗', t: 'Gewinn-Rechner',    d: 'Kaufen und verkaufen – lohnt sich der Handel?' },
    { id: 'material', icon: '▤', t: 'Materialkosten',    d: 'Einkaufsliste mit Preisen je Stadt.' },
    { id: 'tax',      icon: '%', t: 'Steuer-Rechner',    d: 'Steuer, Ordergebühr und Netto-Erlös.' },
    { id: 'focus',    icon: '◎', t: 'Fokus-Rechner',     d: 'Was bringt ein Fokuspunkt in Silber?' },
    { id: 'resource', icon: '◈', t: 'Ressourcenwert',    d: 'Item-Werte und Nutzungsgebühren je Stufe.' },
    { id: 'fame',     icon: '★', t: 'Fame-Rechner',      d: 'Handwerks-Fame je Gegenstand.' }
  ];

  AO.views.dashboard = {
    id: 'dashboard',
    title: 'Dashboard',
    subtitle: 'Übersicht über Werkzeuge und Datenlage',

    html: function () {
      return '' +
        '<div class="grid cols-4" style="margin-bottom:var(--s5)" id="dashStats"></div>' +
        '<div class="card" style="margin-bottom:var(--s5)">' +
          '<div class="card-head"><h3>Marktdaten</h3>' +
            '<div class="right"><span class="mut" id="dashStamp"></span></div></div>' +
          '<div class="card-body">' +
            '<p class="mut" style="margin-bottom:var(--s3)">Preise stammen vom crowdsourcten ' +
            '<a href="https://www.albion-online-data.com" target="_blank" rel="noopener">Albion Online Data Project</a>. ' +
            'Sie werden nur auf Knopfdruck geladen – eigene Eingaben bleiben dabei erhalten.</p>' +
            '<div class="chips" id="dashChips"></div>' +
          '</div>' +
        '</div>' +
        '<h3 style="margin-bottom:var(--s3)">Werkzeuge</h3>' +
        '<div class="grid cols-3" id="dashTools"></div>' +
        '<p class="view-footnote">Alle Rezepte, Item-Werte und Fokuskosten stammen aus den offiziellen ' +
        'Spieldaten (ao-bin-dumps). Das Toolkit läuft vollständig im Browser – ohne Server, ohne Konto.</p>';
    },

    mount: function (root) {
      render(root);
      ['ao:server', 'ao:settings', 'ao:prices'].forEach(function (ev) {
        document.addEventListener(ev, function () { if (document.contains(root)) render(root); });
      });
      root.addEventListener('click', function (e) {
        var c = e.target.closest('[data-go]');
        if (c) AO.router.go(c.dataset.go);
      });
    },

    refresh: function (root) { render(root); }
  };

  function render(root) {
    var items = AO.data.items.length;
    var cons = AO.data.consumables.length;
    var mats = Object.keys(AO.data.materials).length;

    U.q('#dashStats', root).innerHTML =
      U.stat('Rezepte Ausrüstung', F.s(items), 'Waffen, Rüstung, Zubehör') +
      U.stat('Rezepte Nahrung & Tränke', F.s(cons), 'Küche und Alchemielabor') +
      U.stat('Materialien', F.s(mats), 'mit Item-Werten') +
      U.stat('Server', AO.data.servers[AO.settings.server].name, 'gilt für alle Rechner');

    U.q('#dashStamp', root).textContent = AO.market.has()
      ? 'Zuletzt geladen: ' + F.time(AO.market.stamp()) + ' Uhr'
      : 'Noch nichts geladen';

    var own = AO.market.ownCount();
    U.q('#dashChips', root).innerHTML =
      '<span class="chip' + (AO.market.has() ? ' ok' : ' warn') + '">' +
        (AO.market.has() ? '✓ Marktdaten vorhanden' : 'Noch keine Marktdaten') + '</span>' +
      '<span class="chip">Eigene Preise: <b>' + own + '</b></span>' +
      '<span class="chip">Steuer: <b>' + (AO.settings.premium ? '4 %' : '8 %') + '</b></span>' +
      '<span class="chip">Einkauf: <b>' + (AO.settings.buyMethod === 'order' ? 'Kauforder' : 'Sofortkauf') + '</b></span>';

    U.q('#dashTools', root).innerHTML = TOOLS.map(function (t) {
      return '<button class="stat" data-go="' + t.id + '" style="text-align:left;cursor:pointer;width:100%">' +
        '<div class="k">' + t.icon + '</div>' +
        '<div class="v" style="font-size:var(--fs-lg)">' + F.esc(t.t) + '</div>' +
        '<div class="s">' + F.esc(t.d) + '</div></button>';
    }).join('');
  }
})();
