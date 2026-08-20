/* Wiederverwendbare Crafting-Ansicht.
   Der Crafting-, Koch- und Trank-Rechner sind nur noch Konfigurationen davon.
   Rechenkern liegt in js/core/craft.js. */
(function () {
  "use strict";
  window.AO = window.AO || {}; AO.views = AO.views || {};
  var F = AO.fmt, U = AO.ui;

  /* Items zu Familien buendeln: T4_MAIN_SWORD .. T8_MAIN_SWORD -> "MAIN_SWORD" */
  function families(list, cfg) {
    var fam = {};
    list.forEach(function (it) {
      var key = it.id.replace(/^T\d_/, '');
      var f = fam[key] || (fam[key] = { key: key, cat: it.c, group: it.g, name: it.n, tiers: {} });
      f.tiers[it.t] = it;
      /* Namen ohne Tier-Zusatz: mittlere Stufe liefert die schoenste Bezeichnung */
      if (it.t === 4 || (!f.tiers[4] && it.t > (f.bestT || 0))) { f.name = it.n; f.bestT = it.t; }
    });
    /* Familien koennen einen eigenen Sammelnamen bekommen (z.B. "Metallbarren"
       statt des T4-Namens "Stahlbarren"). */
    if (cfg && cfg.familyName) {
      Object.keys(fam).forEach(function (k) { fam[k].name = cfg.familyName(k, fam[k]) || fam[k].name; });
    }
    return fam;
  }

  AO.craftView = function (cfg) {
    var FAM = null, ORDER = null;

    /* Wird unten zurueckgegeben. Frueh angelegt, damit mount() eine
       select()-Schnittstelle daran haengen kann - andere Ansichten (etwa die
       Craft-Chancen) schicken damit einen Gegenstand herueber. */
    var view = {
      id: cfg.id, title: cfg.title, subtitle: cfg.subtitle,
      html: function () { return html(); },
      mount: function (root) { return mount(root); },
      /* Solange nichts gemountet ist, gibt es nichts zu waehlen. Der Aufrufer
         navigiert erst und ruft danach - dann steht die echte Fassung hier. */
      select: function () { return false; }
    };

    var S = AO.store.bind(cfg.storeKey, {
      cat: '', fam: '', tier: 4, ench: 0, quality: 1,
      buyCity: 'Caerleon', sellCity: 'Caerleon',
      rrMode: 'none', rrManual: 15.2, focus: false, selfCraft: false,
      crafts: 100, fee: 800, search: '',
      profOnly: true, profSort: 'profit'
    });

    function data() {
      if (!FAM) {
        var list = cfg.source();
        FAM = families(list, cfg);
        ORDER = Object.keys(FAM).sort(function (a, b) {
          return FAM[a].name.localeCompare(FAM[b].name, 'de');
        });
      }
      return FAM;
    }

    function cats() {
      data();
      var seen = {};
      ORDER.forEach(function (k) { seen[FAM[k].cat] = 1; });
      return Object.keys(seen).sort(function (a, b) {
        return (AO.data.categories.catDe[a] || a).localeCompare(AO.data.categories.catDe[b] || b, 'de');
      });
    }

    function current() {
      data();
      var f = FAM[S.fam];
      if (!f) return null;
      return f.tiers[S.tier] || f.tiers[Object.keys(f.tiers)[0]];
    }

    function canEnch(item) { return cfg.ench && item && AO.craft.enchantable(item); }

    function rate() { return AO.craft.returnRate(S.rrMode, S.rrManual); }
    function isHideout() { return S.rrMode === 'hideout' || S.rrMode === 'hideoutfocus'; }

    /* ------------------------------------------------------------------ HTML */
    function html() {
      var G = AO.settings;
      S.buyCity = S.buyCity || G.city; S.sellCity = S.sellCity || G.city;
      var cityOpts = AO.data.cities.map(function (c) { return { v: c, n: c }; });

      return '' +
      '<div class="split">' +

        /* ---------------- Einstellungen ---------------- */
        '<div class="card" id="cfgCard">' +
          '<div class="fieldset">' +
            '<h4>Auswahl</h4>' +
            '<div class="field stack"><label>Kategorie</label><select data-x="cat"></select></div>' +
            '<div class="field stack"><label>' + F.esc(cfg.itemLabel || 'Gegenstand') + '</label>' +
              '<div class="picker"><input data-x="search" placeholder="suchen…" autocomplete="off" spellcheck="false">' +
              '<div class="picker-list" data-x="list" hidden></div></div>' +
              '<div class="hint" data-x="chosen"></div>' +
            '</div>' +
            '<div class="field stack"><label>Stufe</label><div data-x="tierSeg"></div>' +
              '<div class="hint" data-x="tierHint"></div></div>' +
            (cfg.ench ? '<div class="field stack"><label>Verzauberung</label><div data-x="enchSeg"></div></div>' : '') +
            (cfg.quality ? '<div class="field stack"><label>Qualität (Verkauf)</label>' +
              '<select data-x="quality"></select>' +
              '<div class="hint" data-x="qualHint"></div></div>' : '') +
          '</div>' +

          '<div class="fieldset">' +
            '<h4>Markt</h4>' +
            '<div class="field"><span class="lbl w">Einkauf</span><select data-x="buyCity"></select></div>' +
            '<div class="field"><span class="lbl w">Verkauf</span><select data-x="sellCity"></select></div>' +
            '<div class="field stack"><label>Einkauf über</label>' +
              U.seg([{ v: 'instant', n: 'Sofortkauf' }, { v: 'order', n: 'Kauforder +2,5 %' }], AO.settings.buyMethod, '') +
            '</div>' +
            '<div class="field stack"><label>Verkauf über</label>' +
              U.seg([{ v: 'order', n: 'Verkaufsorder +2,5 %' }, { v: 'instant', n: 'Sofortverkauf' }], AO.settings.sellMethod, '') +
            '</div>' +
            '<label class="field check"><input type="checkbox" data-x="premium"> Premium <span class="mut">(4 % statt 8 % Steuer)</span></label>' +
          '</div>' +

          '<div class="fieldset">' +
            '<h4>Herstellung</h4>' +
            '<div class="field stack"><label>Rückgaberate</label><div data-x="rrSeg"></div>' +
              '<div class="field" data-x="rrManualBox" hidden style="margin-top:6px">' +
                '<span class="lbl" data-x="rrLbl"></span>' +
                '<input class="num" data-x="rrManual" inputmode="decimal" style="max-width:100px">' +
                '<span class="mut">%</span></div>' +
              '<div class="hint" data-x="rrHint" hidden></div>' +
            '</div>' +
            '<label class="field check"><input type="checkbox" data-x="focus"> Fokus verwenden</label>' +
            (cfg.selfCraft
              ? '<label class="field check"><input type="checkbox" data-x="selfCraft"> Vorstufe selbst herstellen' +
                ' <span class="mut">(statt am Markt kaufen)</span></label>' : '') +
            '<div class="field"><span class="lbl w">Gebühr</span><input class="num" data-x="fee" inputmode="numeric">' +
              '<span class="mut">/100 NW</span></div>' +
            '<div class="field"><span class="lbl w">Anzahl</span><input class="num" data-x="crafts" inputmode="numeric">' +
              '<span class="mut">Crafts</span></div>' +
          '</div>' +
        '</div>' +

        /* ---------------- Ergebnis ---------------- */
        '<div>' +
          '<div class="view-toolbar">' +
            '<button class="btn primary" data-x="load"><span class="spin">⟳</span> Marktpreise laden</button>' +
            '<span class="mut" data-x="stamp"></span>' +
            '<button class="btn sm ghost" data-x="clearOwn" hidden>Eigene Preise verwerfen</button>' +
          '</div>' +
          '<div class="chips" data-x="chips" style="margin-bottom:var(--s4)"></div>' +
          '<div class="notice warn" data-x="bmNote" style="margin-bottom:var(--s4)" hidden></div>' +
          '<div data-x="notice"></div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
          '<div class="card" style="margin-bottom:var(--s4)">' +
            '<div class="card-head"><h3>Benötigte Materialien</h3>' +
              '<div class="right"><span class="mut" data-x="recipeNote"></span></div></div>' +
            '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
              '<table class="data"><thead><tr>' +
                '<th>Material</th>' +
                '<th title="Menge laut Rezept für einen Craft">je Craft</th>' +
                '<th title="Rezeptmenge × Anzahl Crafts, ohne Rückgabe">brutto</th>' +
                '<th title="Wird durch die Rückgaberate eingespart">Rückgabe</th>' +
                '<th title="Was du tatsächlich einkaufen musst">einkaufen</th>' +
                '<th>Preis</th><th>Kosten</th>' +
              '</tr></thead><tbody data-x="matRows"></tbody>' +
              '<tfoot><tr><td colspan="6">Materialkosten</td><td data-x="matTotal">—</td></tr></tfoot>' +
            '</table></div>' +
          '</div>' +
          '<div class="grid cols-2">' +
            '<div class="card"><div class="card-head"><h3>Kosten</h3></div>' +
              '<div class="card-body" data-x="costBox"></div></div>' +
            '<div class="card"><div class="card-head"><h3>Erlös &amp; Gewinn</h3></div>' +
              '<div class="card-body" data-x="sellBox"></div></div>' +
          '</div>' +
          (cfg.overview
            ? '<div class="card" data-fold="stufen" data-fold-default="zu" style="margin-top:var(--s4)">' +
                '<div class="card-head"><h3>Alle Stufen im Vergleich</h3>' +
                  '<div class="right"><span class="mut">gleiche Einstellungen, T2 bis T8</span></div></div>' +
                '<div class="tablewrap" style="border:none">' +
                  '<table class="data"><thead><tr><th>Stufe</th><th>Kosten / Stück</th>' +
                  '<th>Verkauf / Stück</th><th>Gewinn / Stück</th><th>Marge</th></tr></thead>' +
                  '<tbody data-x="ovRows"></tbody></table></div></div>'
            : '') +
          '<div class="card" data-fold="lohnt" style="margin-top:var(--s4)">' +
            '<div class="card-head"><h3>Was lohnt sich gerade?</h3>' +
              '<div class="right">' +
                '<div data-x="profSeg"></div>' +
                '<button class="btn sm primary" data-x="profScan">' +
                  '<span class="spin">\u27f3</span> \u00dcbersicht berechnen</button>' +
              '</div></div>' +
            '<div class="card-body tight" style="display:flex;gap:var(--s4);align-items:center;flex-wrap:wrap">' +
              '<label class="field check" style="margin:0"><input type="checkbox" data-x="profOnly"> ' +
                'nur mit Gewinn</label>' +
              '<div class="bar" data-x="profBar" style="flex:1;min-width:120px" hidden><i style="width:0"></i></div>' +
            '</div>' +
            '<div class="card-body tight" data-x="profInfo"></div>' +
            '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
              '<table class="data"><thead><tr>' +
                '<th>Gegenstand</th><th>Stufe</th><th>Material</th>' +
                '<th title="Nutzungsgeb\u00fchr der Station je St\u00fcck">Geb\u00fchr</th>' +
                '<th>Kosten / St\u00fcck</th><th>Verkauf</th>' +
                '<th title="Tats\u00e4chlich verkaufte St\u00fcck je Tag \u2013 nur, wenn Handelsdaten ' +
                'vorliegen. Die vollst\u00e4ndige Pr\u00fcfung steht unter Craft-Chancen.">verkauft/Tag</th>' +
                '<th title="Alter des \u00e4ltesten beteiligten Preises">Daten</th>' +
                '<th>Gewinn / St\u00fcck</th><th>Marge</th>' +
                '<th title="Gewinn je eingesetztem Fokuspunkt">je Fokus</th>' +
              '</tr></thead><tbody data-x="profRows"></tbody></table></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    /* ------------------------------------------------------------------ Mount */
    function mount(root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });
      var segs = U.qa('.seg', root);
      el.buySeg = segs[0]; el.sellSeg = segs[1];

      data();
      if (!S.cat || cats().indexOf(S.cat) < 0) S.cat = cats()[0];
      U.fill(el.cat, cats().map(function (c) {
        return { v: c, n: AO.data.categories.catDe[c] || c };
      }), S.cat);
      U.fill(el.buyCity, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.buyCity);
      /* Verkauf zusaetzlich am Schwarzmarkt moeglich - nur wenn das Werkzeug
         Ausruestung behandelt; Rohstoffe handelt der Schwarzmarkt nicht. */
      U.fill(el.sellCity, cfg.blackMarket ? AO.data.sellLocations
                                          : AO.data.cities.map(function (c) { return { v: c, n: c }; }),
             S.sellCity);
      if (!cfg.blackMarket && S.sellCity === AO.data.blackMarket) {
        S.sellCity = 'Caerleon'; el.sellCity.value = S.sellCity;
      }
      /* Beim Herstellen laesst sich die Qualitaet nicht bestimmen - was aus
         der Station kommt, ist ganz ueberwiegend Normal. Eine hoehere
         anzunehmen heisst, mit einem Preis zu rechnen, den man gar nicht
         erreicht. Deshalb steht Normal als Vorgabe und alles darueber wird
         ausdruecklich als Annahme gekennzeichnet. */
      function syncQualHint() {
        if (!el.qualHint) return;
        el.qualHint.innerHTML = S.quality > 1
          ? '<span class="warn">Gerechnet wird mit <b>' +
            F.esc((AO.data.qualities.filter(function (q) { return q.q === S.quality; })[0] || {}).label ||
                  String(S.quality)) +
            '</b>. Beim Herstellen bekommt man die Qualität nicht geschenkt – ' +
            'verlässlich ist nur <b>Normal</b>.</span>'
          : 'Normal, die schlechteste Stufe – die einzige, auf die man sich beim ' +
            'Herstellen verlassen kann.';
      }

      if (el.quality) {
        U.fill(el.quality, AO.data.qualities.map(function (q) { return { v: q.q, n: q.label }; }), S.quality);
        syncQualHint();
      }
      el.premium.checked = AO.settings.premium;
      el.focus.checked = S.focus;
      el.fee.value = S.fee;
      el.crafts.value = S.crafts;
      el.rrManual.value = String(S.rrManual).replace('.', ',');

      /* Rückgaberate-Segment */
      el.rrSeg.innerHTML = U.seg(
        AO.data.returnRates.map(function (r) {
          return { v: r.id, n: r.dynamic ? r.label : r.label + ' ' + F.n1(r.rate) + ' %' };
        }).concat([{ v: 'manual', n: 'Manuell' }]), S.rrMode);

      if (!S.fam || !FAM[S.fam]) pickFirstOfCat();
      syncTierSeg(); syncEnchSeg(); syncChosen();

      el.profOnly.checked = S.profOnly;
      el.profSeg.innerHTML = U.seg([
        { v: 'profit', n: 'nach Gewinn' },
        { v: 'margin', n: 'nach Marge' },
        { v: 'focus',  n: 'je Fokus' }
      ], S.profSort);
      profRender();

      /* --- Auswahl von aussen -------------------------------------------
         Die Familie steckt in der ID: "T5_2H_CLAYMORE" gehoert zu
         "2H_CLAYMORE", die Stufe steht vorne. Mitgeschickte Annahmen
         (Verzauberung, Staedte, Gebuehr, Rueckgabe) werden uebernommen,
         damit hier dieselbe Zahl steht wie in der Liste, aus der man kam. */
      view.select = function (itemId, opts) {
        data();
        var key = String(itemId).replace(/^T\d_/, '');
        var f = FAM[key];
        if (!f) return false;
        var m = /^T(\d)_/.exec(itemId);
        var tier = (m && f.tiers[+m[1]]) ? +m[1] : +Object.keys(f.tiers).sort()[0];
        S.fam = key; S.cat = f.cat; S.tier = tier;
        opts = opts || {};
        if (opts.ench != null && cfg.ench) S.ench = +opts.ench;
        if (opts.buyCity) S.buyCity = opts.buyCity;
        if (opts.sellCity) S.sellCity = opts.sellCity;
        if (opts.quality != null && cfg.quality) S.quality = +opts.quality;
        if (opts.fee != null) S.fee = +opts.fee;
        if (opts.rrMode) S.rrMode = opts.rrMode;
        if (opts.rrManual != null) S.rrManual = +opts.rrManual;
        if (opts.focus != null) S.focus = !!opts.focus;
        S.$save();
        el.cat.value = S.cat;
        if (el.buyCity) el.buyCity.value = S.buyCity;
        if (el.sellCity) el.sellCity.value = S.sellCity;
        if (el.quality) { el.quality.value = S.quality; syncQualHint(); }
        if (el.fee) el.fee.value = S.fee;
        if (el.focus) el.focus.checked = S.focus;
        if (el.rrSeg && el.rrSeg.firstChild) U.segSet(el.rrSeg.firstChild, S.rrMode);
        el.list.hidden = true; el.search.value = '';
        syncRateBox(); syncRateHint();
        syncTierSeg(); syncEnchSeg(); syncChosen(); render();
        return true;
      };

      /* ---- Ereignisse ---- */
      el.cat.addEventListener('change', function () {
        S.cat = el.cat.value; pickFirstOfCat(); S.$save();
        syncTierSeg(); syncEnchSeg(); syncChosen(); render();
      });

      el.search.addEventListener('input', U.debounce(showList, 120));
      el.search.addEventListener('focus', showList);
      document.addEventListener('click', function (e) {
        if (!root.contains(e.target) || !el.search.parentElement.contains(e.target)) el.list.hidden = true;
      });
      el.list.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-fam]');
        if (!b) return;
        S.fam = b.dataset.fam;
        var f = FAM[S.fam];
        if (!f.tiers[S.tier]) S.tier = +Object.keys(f.tiers).sort()[0];
        S.cat = f.cat; el.cat.value = S.cat;
        el.list.hidden = true; el.search.value = '';
        S.$save(); syncTierSeg(); syncEnchSeg(); syncChosen(); render();
      });

      el.tierSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b || b.disabled) return;
        S.tier = +b.dataset.v; S.$save();
        U.segSet(el.tierSeg.firstChild, b.dataset.v);
        syncEnchSeg(); syncChosen(); render();
      });
      if (el.enchSeg) el.enchSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b || b.disabled) return;
        S.ench = +b.dataset.v; S.$save();
        U.segSet(el.enchSeg.firstChild, b.dataset.v);
        syncChosen(); render();
      });
      el.buySeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        AO.settings.buyMethod = b.dataset.v; AO.settings.$save();
        U.segSet(el.buySeg, b.dataset.v); render();
      });
      el.sellSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        AO.settings.sellMethod = b.dataset.v; AO.settings.$save();
        U.segSet(el.sellSeg, b.dataset.v); render();
      });
      el.rrSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.rrMode = b.dataset.v;
        /* Haekchen und Rate konsistent halten */
        S.focus = !!FOCUS_OFF[S.rrMode];
        el.focus.checked = S.focus;
        S.$save();
        U.segSet(el.rrSeg.firstChild, b.dataset.v);
        syncRateBox(); render();
      });
      syncRateBox();

      el.rrManual.addEventListener('input', function () {
        var v = parseFloat(el.rrManual.value.replace(',', '.'));
        v = isFinite(v) ? v : 0;
        if (isHideout()) {
          AO.settings.hideoutBonus = v; AO.settings.$save();
          document.dispatchEvent(new CustomEvent('ao:settings'));
        } else { S.rrManual = v; S.$save(); }
        syncRateHint(); render();
      });

      /* Eingabefeld auf den gewaehlten Modus einstellen */
      function syncRateBox() {
        var show = isHideout() || S.rrMode === 'manual';
        el.rrManualBox.hidden = !show;
        el.rrHint.hidden = !isHideout();
        if (!show) return;
        el.rrLbl.textContent = isHideout() ? 'Produktionsbonus' : 'Rate';
        el.rrManual.value = String(isHideout() ? AO.settings.hideoutBonus : S.rrManual).replace('.', ',');
        syncRateHint();
      }
      function syncRateHint() {
        if (!isHideout()) return;
        el.rrHint.innerHTML = 'Ergibt eine R\u00fcckgaberate von <b>' + F.pct(rate() * 100) + '</b>' +
          (S.rrMode === 'hideoutfocus' ? ' (inkl. Fokus, +59 Prozentpunkte)' : '') +
          '. Den Produktionsbonus zeigt die Station im Hideout an.';
      }
      el.premium.addEventListener('change', function () {
        AO.settings.premium = el.premium.checked; AO.settings.$save(); render();
      });
      /* Das Haekchen zieht die Rueckgaberate mit: Fokus einsetzen und
         gleichzeitig mit der Rate ohne Fokus rechnen waere ein Lauf, den es
         im Spiel nicht gibt. */
      var FOCUS_ON  = { none: 'focus', city: 'cityfocus', hideout: 'hideoutfocus' };
      var FOCUS_OFF = { focus: 'none', cityfocus: 'city', hideoutfocus: 'hideout' };
      el.focus.addEventListener('change', function () {
        S.focus = el.focus.checked;
        var map = S.focus ? FOCUS_ON : FOCUS_OFF;
        if (map[S.rrMode]) {
          S.rrMode = map[S.rrMode];
          U.segSet(el.rrSeg.firstChild, S.rrMode);
          syncRateBox();
        }
        S.$save(); render();
      });
      if (el.selfCraft) {
        el.selfCraft.checked = S.selfCraft;
        el.selfCraft.addEventListener('change', function () {
          S.selfCraft = el.selfCraft.checked; S.$save(); render();
        });
      }
      [['fee', 'fee'], ['crafts', 'crafts']].forEach(function (p) {
        el[p[0]].addEventListener('input', function () {
          var v = F.parse(el[p[0]].value);
          S[p[1]] = v === null ? 0 : v; S.$save(); render();
        });
      });
      ['buyCity', 'sellCity'].forEach(function (k) {
        el[k].addEventListener('change', function () { S[k] = el[k].value; S.$save(); render(); });
      });
      if (el.quality) el.quality.addEventListener('change', function () {
        S.quality = +el.quality.value; S.$save(); syncQualHint(); render();
      });

      el.load.addEventListener('click', loadPrices);
      el.profScan.addEventListener('click', profScan);
      el.profOnly.addEventListener('change', function () {
        S.profOnly = el.profOnly.checked; S.$save(); profRender();
      });
      el.profSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.profSort = b.dataset.v; S.$save();
        U.segSet(el.profSeg.firstChild, b.dataset.v);
        profRender();
      });
      el.profRows.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-fam]');
        /* Wer gerade Text markiert hat, wollte kopieren, nicht wechseln. */
        if (!tr || U.hasSelection()) return;
        S.fam = tr.dataset.fam; S.tier = +tr.dataset.tier;
        var f = FAM[S.fam]; if (f) { S.cat = f.cat; el.cat.value = S.cat; }
        S.$save();
        syncTierSeg(); syncEnchSeg(); syncChosen(); render();
        U.scrollIntoViewIfNeeded(root.querySelector('[data-x="matRows"]'));
      });
      el.clearOwn.addEventListener('click', function () {
        AO.market.clearOwn(); U.toast('Eigene Preise verworfen'); render();
      });

      /* Preisfelder in der Tabelle */
      root.addEventListener('input', function (e) {
        var i = e.target.closest('.pinput'); if (!i) return;
        AO.market.setOwn(i.dataset.id, i.dataset.city, +i.dataset.q, i.dataset.side, F.parse(i.value));
        /* Goldmarkierung sofort setzen, nicht erst beim naechsten vollen Aufbau */
        i.classList.toggle('own', AO.market.isOwn(i.dataset.id, i.dataset.city, +i.dataset.q, i.dataset.side));
        renderNumbers();
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('.reset');
        if (b) {
          AO.market.setOwn(b.dataset.id, b.dataset.city, +b.dataset.q, b.dataset.side, null);
          render();
          return;
        }
        if (e.target.closest('[data-x="toBM"]')) {
          AO.settings.sellMethod = 'instant'; AO.settings.$save();
          U.segSet(el.sellSeg, 'instant'); render();
          return;
        }
        var ub = e.target.closest('[data-x="useBonus"]');
        if (ub) {
          S.buyCity = ub.dataset.city; el.buyCity.value = S.buyCity;
          if (S.rrMode === 'none') { S.rrMode = 'city'; U.segSet(el.rrSeg.firstChild, 'city'); }
          else if (S.rrMode === 'focus') { S.rrMode = 'cityfocus'; U.segSet(el.rrSeg.firstChild, 'cityfocus'); }
          S.$save(); render();
        }
      });

      document.addEventListener('ao:server', function () { if (document.contains(root)) render(); });
      U.onPrices(root, render);
      document.addEventListener('ao:settings', function () {
        if (document.activeElement !== el.rrManual) syncRateBox();
        render();
      });

      render();

      /* ---- Helfer ---- */
      function pickFirstOfCat() {
        var first = ORDER.filter(function (k) { return FAM[k].cat === S.cat; })[0];
        if (first) {
          S.fam = first;
          var f = FAM[first];
          if (!f.tiers[S.tier]) S.tier = +Object.keys(f.tiers).sort()[0];
        }
      }

      function showList() {
        var term = el.search.value.trim().toLowerCase();
        var keys = ORDER.filter(function (k) {
          var f = FAM[k];
          if (term) return f.name.toLowerCase().indexOf(term) >= 0 || k.toLowerCase().indexOf(term) >= 0;
          return f.cat === S.cat;
        }).slice(0, 60);
        el.list.innerHTML = keys.length ? keys.map(function (k) {
          var f = FAM[k];
          var t = f.tiers[S.tier] || f.tiers[Object.keys(f.tiers)[0]];
          return '<button data-fam="' + F.esc(k) + '">' + F.img(t.id, 56, f.name) +
            '<span class="nm">' + F.esc(f.name) + '</span>' +
            '<span class="meta">' + F.esc(AO.data.categories.catDe[f.cat] || f.cat) + '</span></button>';
        }).join('') : '<div class="t-empty">Nichts gefunden</div>';
        el.list.hidden = false;
      }

      function syncTierSeg() {
        var f = FAM[S.fam];
        var tiers = f ? Object.keys(f.tiers).map(Number).sort(function (a, b) { return a - b; }) : [];
        if (tiers.length && tiers.indexOf(S.tier) < 0) S.tier = tiers[0];
        el.tierSeg.innerHTML = U.seg(tiers.map(function (t) {
          return { v: String(t), n: 'T' + t };
        }), String(S.tier));
        /* Nicht jeder Gegenstand existiert auf allen acht Stufen - Speisen
           etwa gibt es je Gericht nur auf dreien (Salat T2/T4/T6, Omelett
           T3/T5/T7, Sandwich T4/T6/T8). Ohne Hinweis sieht die kurze Leiste
           nach einem fehlenden Datensatz aus. */
        if (el.tierHint) {
          el.tierHint.textContent = tiers.length && tiers.length < 8
            ? (f && f.name ? f.name : 'Diesen Gegenstand') + ' gibt es im Spiel nur auf ' +
              (tiers.length === 1 ? 'Stufe ' : 'den Stufen ') +
              tiers.map(function (t) { return 'T' + t; }).join(', ').replace(/, ([^,]*)$/, ' und $1') + '.'
            : '';
        }
      }

      function syncEnchSeg() {
        if (!el.enchSeg) return;
        var it = current();
        var ok = canEnch(it);
        if (!ok) S.ench = 0;
        el.enchSeg.innerHTML = U.seg([0, 1, 2, 3, 4].map(function (e) {
          return { v: String(e), n: e ? '.' + e : 'Normal' };
        }), String(S.ench));
        U.qa('button', el.enchSeg).forEach(function (b) {
          if (!ok && b.dataset.v !== '0') { b.disabled = true; b.title = 'Für diesen Gegenstand nicht verzauberbar'; }
        });
      }

      function syncChosen() {
        var it = current();
        el.chosen.innerHTML = it
          ? F.img(AO.craft.productId(it, S.ench), 40, it.n) + ' <b>' + F.esc(it.n) + '</b> · ' +
            F.esc(it.id) + (S.ench ? '.' + S.ench : '')
          : '<span class="warn">Kein Gegenstand gewählt</span>';
      }

      function neededIds() {
        var it = current(); if (!it) return [];
        var ids = AO.craft.idsFor(it, (cfg.ench && AO.craft.enchantable(it)) ? S.ench : 0);
        /* Beim Stufenvergleich brauchen alle Stufen Preise, sonst bleibt die
           Tabelle halb leer. */
        var fam = FAM[S.fam];
        if (cfg.overview && fam) {
          Object.keys(fam.tiers).forEach(function (t) {
            var x = fam.tiers[t];
            ids = ids.concat(AO.craft.idsFor(x, (cfg.ench && AO.craft.enchantable(x)) ? S.ench : 0));
          });
        }
        return ids;
      }

      function loadPrices() {
        var it = current(); if (!it) return;
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(neededIds(), cfg.quality ? [1, 2, 3, 4, 5] : [1])
          .then(function () { U.toast('Marktpreise aktualisiert', 'ok'); })
          .catch(function (err) {
            U.toast('Laden fehlgeschlagen: ' + (err.name === 'AbortError' ? 'Zeitüberschreitung' : err.message), 'err');
          })
          .then(function () {
            el.load.classList.remove('loading'); el.load.disabled = false;
            render();
          });
      }

      /* --- Gewinnuebersicht ------------------------------------------------
         Rechnet jeden Gegenstand dieser Ansicht mit den EINGESTELLTEN Werten
         durch - gleiche Staedte, gleiche Rueckgaberate, gleiche Gebuehr.
         Bewusst schlank gehalten: Handelbarkeit und Marktwert pruefen die
         Craft-Chancen, hier geht es um den schnellen Blick. */
      var PROF = null;

      function profItems() {
        var raus = [];
        Object.keys(FAM).forEach(function (k) {
          var f = FAM[k];
          Object.keys(f.tiers).forEach(function (t) { raus.push({ fam: k, tier: +t, it: f.tiers[t] }); });
        });
        return raus;
      }

      function profScan() {
        if (el.profScan.disabled) return;
        data();
        var liste = profItems();
        var ids = {};
        liste.forEach(function (x) {
          var e = (cfg.ench && AO.craft.enchantable(x.it)) ? S.ench : 0;
          AO.craft.idsFor(x.it, e).forEach(function (i) { ids[i] = 1; });
        });
        var alle = Object.keys(ids);
        el.profScan.classList.add('loading'); el.profScan.disabled = true;
        el.profBar.hidden = false; el.profBar.firstChild.style.width = '0';
        el.profInfo.innerHTML = '<span class="mut">Lade Preise f\u00fcr ' + F.q(alle.length) +
          ' Gegenst\u00e4nde und Materialien\u2026</span>';
        AO.market.load(alle, cfg.quality ? [S.quality, 1] : [1], function (done, total) {
          el.profBar.firstChild.style.width = Math.round(done / total * 100) + '%';
        })
        .then(function () {
          /* Ein Gewinn ohne Kaeufer ist keiner. Die Handelszahlen kosten hier
             kaum etwas - es geht nur um die Erzeugnisse dieser Ansicht, nicht
             um den ganzen Bestand -, deshalb kommen sie gleich mit. */
          PROF = liste;
          var prod = {};
          liste.forEach(function (x) {
            var e2 = (cfg.ench && AO.craft.enchantable(x.it)) ? S.ench : 0;
            prod[AO.craft.productId(x.it, e2)] = 1;
          });
          var pids = Object.keys(prod);
          if (!pids.length) return null;
          el.profInfo.innerHTML = '<span class="mut">Prüfe für ' + F.q(pids.length) +
            ' Erzeugnisse, ob sie sich überhaupt verkaufen lassen…</span>';
          return AO.market.loadHistory(pids, [cfg.quality ? S.quality : 1], 21,
            function (done, total) {
              el.profBar.firstChild.style.width = Math.round(done / total * 100) + '%';
            }, { chunk: 40, concurrency: 4 });
        })
        .catch(function (err) { U.toast('Laden fehlgeschlagen: ' + err.message, 'err'); })
        .then(function () {
          el.profScan.classList.remove('loading'); el.profScan.disabled = false;
          el.profBar.hidden = true;
          profRender();
        });
      }

      function profAlter(it, e) {
        var alter = 0, side = AO.craft.buySide(AO.settings.buyMethod);
        function merke(id, city, q, sd) {
          if (AO.market.isOwn(id, city, q, sd)) return;
          var d = AO.market.date(id, city, q, sd);
          var h = d ? (Date.now() - d.getTime()) / 3600000 : Infinity;
          if (h > alter) alter = h;
        }
        it.r.forEach(function (r) { merke(AO.craft.matId(r[0], e, r[2]), S.buyCity, 1, side); });
        merke(AO.craft.productId(it, e), S.sellCity, cfg.quality ? S.quality : 1,
              AO.craft.sellSideAt(S.sellCity, AO.settings.sellMethod));
        return alter;
      }

      function profRender() {
        if (!el.profRows) return;
        if (!PROF) {
          el.profInfo.innerHTML = '<span class="mut">Rechnet <b>jeden Gegenstand dieser Ansicht</b> ' +
            'mit den Einstellungen links durch \u2013 gleiche St\u00e4dte, gleiche R\u00fcckgaberate, ' +
            'gleiche Geb\u00fchr. Ein Klick auf eine Zeile \u00fcbernimmt sie nach oben.</span>';
          el.profRows.innerHTML = '<tr><td colspan="11" class="t-empty">Noch nicht berechnet.</td></tr>';
          return;
        }
        var zeilen = [];
        var ohne = 0;
        PROF.forEach(function (x) {
          var e = (cfg.ench && AO.craft.enchantable(x.it)) ? S.ench : 0;
          var d = compute(x.it);
          if (!d || d.missingPrice.length || !isFinite(d.margin)) { ohne++; return; }
          zeilen.push({
            fam: x.fam, tier: x.tier, it: x.it, d: d, e: e,
            age: profAlter(x.it, e),
            sold: AO.market.soldPerDay(AO.craft.productId(x.it, e), S.sellCity,
                                       cfg.quality ? S.quality : 1)
          });
        });
        var lohnt = zeilen.filter(function (z) { return z.d.perItem > 0; }).length;
        var list = zeilen.filter(function (z) { return !S.profOnly || z.d.perItem > 0; })
          .sort(function (a, b) {
            if (S.profSort === 'margin') return b.d.margin - a.d.margin;
            if (S.profSort === 'focus') {
              var af = isFinite(a.d.silverPerFocus) ? a.d.silverPerFocus : -Infinity;
              var bf = isFinite(b.d.silverPerFocus) ? b.d.silverPerFocus : -Infinity;
              return bf - af;
            }
            return b.d.perItem - a.d.perItem;
          });

        el.profInfo.innerHTML = '<span class="mut">' + F.q(zeilen.length) +
          ' vollst\u00e4ndige Rechnungen, davon <b>' + lohnt + '</b> mit Gewinn' +
          (ohne ? ' \u00b7 ' + F.q(ohne) + ' ohne vollst\u00e4ndige Preise ausgelassen' : '') +
          ' \u00b7 Material aus <b>' + F.esc(S.buyCity) + '</b>, Verkauf in <b>' +
          F.esc(F.ort(S.sellCity)) + '</b>' +
          (list.length > 60 ? ' \u00b7 die besten 60 angezeigt' : '') +
          ' \u00b7 <span class="faint">Handelbarkeit und Marktwert pr\u00fcfen die Craft-Chancen</span></span>';

        el.profRows.innerHTML = list.length ? list.slice(0, 60).map(function (z) {
          var d = z.d;
          return '<tr class="hover" data-fam="' + F.esc(z.fam) + '" data-tier="' + z.tier +
            '" style="cursor:pointer" title="Anklicken, um oben nachzurechnen">' +
            '<td><div class="itemcell">' + F.img(AO.craft.productId(z.it, z.e), 56, z.it.n) +
              '<div class="nm"><b>' + F.esc(z.it.n) + '</b><span>' + F.esc(z.it.id) + '</span></div></div></td>' +
            '<td>' + F.tier(z.tier, z.e) + '</td>' +
            '<td>' + F.s(d.out ? d.matTotal / d.out : NaN) + '</td>' +
            '<td class="mut">' + F.s(d.out ? d.feeTotal / d.out : NaN) + '</td>' +
            '<td>' + F.s(d.out ? d.costTotal / d.out : NaN) + '</td>' +
            '<td>' + F.s(d.sellPrice) + '</td>' +
            '<td class="' + (z.sold >= 1 ? 'mut' : 'warn') + '" style="font-size:12px">' +
              (AO.market.hasHistory() ? F.n1(z.sold) : '<span class="faint">\u2014</span>') + '</td>' +
            '<td class="' + (z.age < 3 ? 'pos' : z.age < 24 ? 'mut' : 'warn') + '" style="font-size:12px">' +
              (isFinite(z.age)
                ? (z.age < 1 ? '<1 Std.' : z.age < 48 ? Math.round(z.age) + ' Std.'
                                                      : Math.round(z.age / 24) + ' Tage')
                : '<span class="faint">\u2014</span>') + '</td>' +
            '<td class="' + (d.perItem >= 0 ? 'pos' : 'neg') + '"><b>' + F.sg(d.perItem) + '</b></td>' +
            '<td class="' + (d.margin >= 0 ? 'pos' : 'neg') + '">' + F.pct(d.margin) + '</td>' +
            '<td class="mut">' + (isFinite(d.silverPerFocus) ? F.sg(d.silverPerFocus)
                                                             : '<span class="faint">\u2014</span>') + '</td>' +
            '</tr>';
        }).join('') : '<tr><td colspan="11" class="t-empty">' +
          (S.profOnly && lohnt === 0
            ? 'Mit diesen Einstellungen lohnt sich gerade nichts. Anderen Verkaufsort ' +
              'probieren \u2013 oder den Haken \u201enur mit Gewinn\u201c entfernen.'
            : 'Nichts gefunden.') + '</td></tr>';
      }

      function priceCell(id, city, q, side) {
        var own = AO.market.isOwn(id, city, q, side);
        var v = AO.market.get(id, city, q, side);
        var mk = AO.market.raw(id, city, q, side);
        return '<span class="pwrap">' + U.dot(AO.market.date(id, city, q, side), F.ort(city)) +
          '<input class="pinput' + (own ? ' own' : '') + '" data-id="' + F.esc(id) + '" data-city="' + F.esc(city) +
          '" data-q="' + q + '" data-side="' + side + '" inputmode="numeric" spellcheck="false" ' +
          'value="' + (v !== null && v !== undefined ? F.s(v) : '') + '" placeholder="—" ' +
          'title="' + (mk !== null && mk !== undefined ? 'Marktpreis: ' + F.s(mk) : 'Keine Marktdaten – Preis eintragen') + '">' +
          (own ? '<button class="reset" title="Auf Marktpreis zurücksetzen" data-id="' + F.esc(id) +
                 '" data-city="' + F.esc(city) + '" data-q="' + q + '" data-side="' + side + '">↺</button>' : '') +
          '</span>';
      }

      /* "Vorstufe selbst herstellen": statt des Marktpreises zaehlen die
         eigenen Herstellkosten der Vorstufe (rekursiv bis zur untersten Stufe).
         Gleiches Modell wie im urspruenglichen, geprueften Refining-Rechner. */
      function unitCost(item, ench, depth) {
        var r = rate(), mats = 0;
        var fee = AO.settings.buyMethod === 'order' ? 1 + AO.data.consts.orderFee : 1;
        item.r.forEach(function (e) {
          var id = AO.craft.matId(e[0], ench, e[2]);
          var sub = (depth < 8 && cfg.byId) ? cfg.byId(id) : null;
          var p;
          if (S.selfCraft && sub) {
            /* selbst hergestellt - keine Einstellgebuehr, die steckt schon drin */
            p = unitCost(sub, e[2] ? ench : 0, depth + 1);
          } else {
            /* zugekauft - Kauforder-Gebuehr gehoert auf diesen Einkauf */
            p = (AO.market.get(id, S.buyCity, 1, AO.craft.buySide(AO.settings.buyMethod)) || 0) * fee;
          }
          /* Artefakte bekommt man nicht zurueck - sie zaehlen voll,
             waehrend normale Materialien unten um (1-r) gemindert werden. */
          mats += e[1] * (p || 0) * (AO.craft.noReturn(id) ? 1 / (1 - r) : 1);
        });
        var iv = AO.craft.itemValue(item.r, ench, AO.craft.productId(item, ench)).value;
        return (mats * (1 - r) + AO.craft.stationFee(iv, S.fee)) / (item.a || 1);
      }

      /* Wird dieses Material gerade selbst hergestellt statt gekauft? */
      function isBuilt(id) {
        return !!(cfg.selfCraft && S.selfCraft && cfg.byId && cfg.byId(id));
      }

      /* Preisfunktion für genau ein Erzeugnis. Die Eigenbau-Ersetzung darf
         NUR Materialien treffen - niemals das Endprodukt selbst. Sonst würde
         der Verkaufserlös durch die eigenen Herstellkosten ersetzt, sobald
         Einkaufs- und Verkaufsstadt übereinstimmen. */
      function makePriceOf(prodId) {
        return function (id, city, q, side) {
          if (S.selfCraft && cfg.byId &&
              id !== prodId &&
              city === S.buyCity &&
              side === AO.craft.buySide(AO.settings.buyMethod)) {
            var sub = cfg.byId(id);
            if (sub) return unitCost(sub, AO.craft.matId(sub.id, S.ench, 1) === id ? S.ench : 0, 1);
          }
          return AO.market.get(id, city, q, side);
        };
      }

      function compute(itemOverride) {
        var it = itemOverride || current(); if (!it) return null;
        /* Nicht verzauberbare Stufen (T2/T3) bleiben normal, auch wenn oben
           eine Verzauberung gewählt ist - sonst entstehen Markt-IDs, die es
           gar nicht gibt. */
        var e = (cfg.ench && AO.craft.enchantable(it)) ? S.ench : 0;
        var prodId = AO.craft.productId(it, e);
        return AO.craft.calc({

          priceOf: cfg.selfCraft ? makePriceOf(prodId) : null,
          isBuilt: cfg.selfCraft ? isBuilt : null,
          recipe: it.r, ench: e, amountCrafted: it.a, crafts: S.crafts,
          returnRate: rate(), buyCity: S.buyCity, sellCity: S.sellCity,
          quality: cfg.quality ? S.quality : 1,
          premium: AO.settings.premium, buyMethod: AO.settings.buyMethod,
          sellMethod: AO.settings.sellMethod, stationFee: S.fee,
          focusPerCraft: (it.f && it.f[e]) || 0, useFocus: S.focus,
          productId: prodId
        });
      }

      function render() {
        var it = current();
        el.stamp.textContent = AO.market.has()
          ? 'Marktdaten: ' + F.time(AO.market.stamp()) + ' Uhr' : 'Noch keine Marktdaten geladen';
        el.clearOwn.hidden = AO.market.ownCount() === 0;

        if (!it) {
          el.matRows.innerHTML = '<tr><td colspan="7" class="t-empty">Bitte einen Gegenstand wählen.</td></tr>';
          el.stats.innerHTML = ''; el.costBox.innerHTML = ''; el.sellBox.innerHTML = '';
          return;
        }
        el.recipeNote.textContent = '1 Craft ergibt ' + it.a + '× ' + it.n +
          ' · Item-Wert ' + F.n2(AO.craft.itemValue(it.r, S.ench, AO.craft.productId(it, S.ench)).value);

        var d = compute();
        el.matRows.innerHTML = d.rows.map(function (r) {
          return '<tr class="hover"><td><div class="itemcell">' + F.img(r.id, 56, r.name) +
            '<div class="nm"><b>' + F.esc(r.name) + '</b><span>' + F.esc(r.id) + '</span></div></div></td>' +
            '<td>' + F.q(r.perCraft) + '</td>' +
            '<td class="mut">' + F.q(r.needRaw) + '</td>' +
            '<td>' + (r.noReturn
              ? '<span class="warn" title="Artefakte werden beim Craften immer vollständig verbraucht – die Rückgaberate gilt für sie nicht">kein Rücklauf</span>'
              : '<span class="pos">−' + F.q(r.back) + '</span>') + '</td>' +
            '<td><b>' + F.q(r.need) + '</b></td>' +
            '<td>' + (isBuilt(r.id)
              ? '<span class="mut" title="Eigenbaukosten je Stück – wird nicht am Markt gekauft">' +
                F.s(r.price) + ' <small>Eigenbau</small></span>'
              : priceCell(r.id, S.buyCity, 1, AO.craft.buySide(AO.settings.buyMethod))) + '</td>' +
            '<td data-f="c' + F.esc(r.id) + '">' + F.s(r.cost) + '</td></tr>';
        }).join('');

        renderNumbers();
      }

      /* nur Zahlen neu setzen (bei Preiseingabe, ohne Fokusverlust) */
      function renderNumbers() {
        var it = current(); if (!it) return;
        var d = compute(); if (!d) return;

        /* Merken, welches Preisfeld gerade bearbeitet wird - die Karten unten
           werden neu gezeichnet, der Cursor soll trotzdem stehen bleiben. */
        var act = document.activeElement;
        var keep = null;
        if (act && act.classList && act.classList.contains('pinput') && root.contains(act)) {
          keep = {
            id: act.dataset.id, city: act.dataset.city, q: act.dataset.q,
            side: act.dataset.side, start: act.selectionStart, end: act.selectionEnd
          };
        }

        d.rows.forEach(function (r) {
          var c = el.matRows.querySelector('[data-f="c' + r.id + '"]');
          if (c) c.textContent = F.s(r.cost);
        });
        el.matTotal.textContent = F.s(d.matTotal);

        /* Schwarzmarkt: eigene Location in Caerleon, kauft nur Ausruestung.
           Verkauft wird dort praktisch immer in bestehende Kauforders hinein. */
        var bm = S.sellCity === AO.data.blackMarket;
        el.bmNote.hidden = !bm;
        if (bm) {
          var vgl = AO.market.get(AO.craft.productId(it, S.ench), 'Caerleon',
                                  cfg.quality ? S.quality : 1, AO.craft.sellSide(AO.settings.sellMethod));
          el.bmNote.innerHTML = '<b>Schwarzmarkt</b> – eigener Handelsposten in Caerleon, nimmt nur Ausrüstung. ' +
            'Verkauft wird hier in bestehende Kauforders, also per <b>Sofortverkauf</b>' +
            (AO.settings.sellMethod === 'order'
              ? ' – du rechnest gerade mit Verkaufsorder.' +
                ' <button class="btn sm" data-x="toBM">Auf Sofortverkauf stellen</button>'
              : '.') +
            (vgl ? ' Zum Vergleich: Caerleon-Markt ' + F.s(vgl) + '.' : '');
        }

        var noPrice = d.missingPrice.length || d.sellPrice === null || d.sellPrice === undefined;
        el.notice.innerHTML = noPrice
          ? '<div class="notice warn" style="margin-bottom:var(--s4)">Für ' +
            (d.missingPrice.length ? '<b>' + d.missingPrice.map(F.esc).join(', ') + '</b>' : 'das Endprodukt') +
            ' liegen keine Marktpreise vor. Bitte „Marktpreise laden“ oder die Preise von Hand eintragen.</div>'
          : (d.missingValue.length
            ? '<div class="notice info" style="margin-bottom:var(--s4)">Für <b>' +
              d.missingValue.map(F.esc).join(', ') + '</b> führt das Spiel keinen Item-Wert – ' +
              'diese Zutat erhöht die Nutzungsgebühr nicht.</div>'
            : '');

        el.stats.innerHTML =
          U.stat('Kosten / Stück', F.s(d.out ? d.costTotal / d.out : NaN), 'inkl. Gebühren') +
          U.stat('Verkauf / Stück', F.s(d.sellPrice), (AO.settings.sellMethod === 'order' ? 'Verkaufsorder' : 'Sofortverkauf')) +
          U.stat('Gewinn / Stück', F.sg(d.perItem), 'nach Steuer', d.perItem >= 0 ? 'pos' : 'neg') +
          U.stat('Marge', F.pct(d.margin), 'Gewinn ÷ Kosten', d.margin >= 0 ? 'pos' : 'neg');

        var kaufOrder = AO.settings.buyMethod === 'order';
        el.costBox.innerHTML =
          line('Materialien', F.s(d.matTotal)) +
          line('Nutzungsgebühr (' + F.q(d.crafts) + ' × ' + F.n2(d.feePerCraft) + ')', F.s(d.feeTotal)) +
          line(kaufOrder ? 'Kauforder-Gebühr (2,5 % auf ' + F.s(d.buyTotal) +
                 (d.buyTotal < d.matTotal ? ' – ohne Eigenbau' : '') + ')'
               : 'Kauforder-Gebühr – entfällt bei Sofortkauf',
               kaufOrder ? F.s(d.orderBuy) : '0', !kaufOrder) +
          line('<b>Gesamtkosten</b>', '<b>' + F.s(d.costTotal) + '</b>', false, true) +
          (S.focus ? '<div class="hint">Fokus: ' + F.s(d.focusTotal) + ' Punkte · ' +
            F.n2(d.silverPerFocus) + ' Silber Gewinn je Fokuspunkt</div>' : '');

        var verkOrder = AO.settings.sellMethod === 'order';
        var pid = AO.craft.productId(it, S.ench);
        var qy = cfg.quality ? S.quality : 1;
        el.sellBox.innerHTML =
          '<div class="dl" style="align-items:center"><span>Verkaufspreis je Stück in ' + F.esc(F.ort(S.sellCity)) + '</span>' +
            '<span>' + priceCell(pid, S.sellCity, qy, AO.craft.sellSide(AO.settings.sellMethod)) + '</span></div>' +
          line(F.q(d.out) + '× ' + F.esc(it.n) + ' à ' + F.s(d.sellPrice), F.s(d.gross)) +
          line('Verkaufssteuer (' + (AO.settings.premium ? '4' : '8') + ' %)', '−' + F.s(d.tax)) +
          line(verkOrder ? 'Verkaufsorder-Gebühr (2,5 %)' : 'Verkaufsorder-Gebühr – entfällt bei Sofortverkauf',
               verkOrder ? '−' + F.s(d.orderSell) : '0', !verkOrder) +
          line('<b>Netto-Erlös</b>', '<b>' + F.s(d.net) + '</b>', false, true) +
          '<div class="stat" style="margin-top:var(--s3);background:none;border:none;padding:0">' +
            '<div class="v ' + (d.profit >= 0 ? 'pos' : 'neg') + '">' + F.sg(d.profit) + ' Silber</div>' +
            '<div class="s">Gesamtgewinn für ' + F.q(d.crafts) + ' Crafts · ' + F.sg(d.perItem) + ' je Stück</div></div>';

        /* Kurzuebersicht der aktiven Einstellungen */
        var chips = [];
        if (cfg.bonusCityOf) {
          var bc = cfg.bonusCityOf(it);
          var aktiv = bc && bc === S.buyCity;
          chips.push(aktiv
            ? '<span class="chip ok">✓ Stadtbonus ' + F.esc(bc) + '</span>'
            : '<button class="chip" data-x="useBonus" data-city="' + F.esc(bc) + '">💡 Bonus-Stadt: ' +
              F.esc(bc) + ' – übernehmen</button>');
        }
        chips.push('<span class="chip">Rückgabe <b>' + F.pct(rate() * 100) + '</b></span>');
        chips.push('<span class="chip">Steuer <b>' + (AO.settings.premium ? '4 %' : '8 %') + '</b>' +
          (AO.settings.sellMethod === 'order' ? ' + Order 2,5 %' : ' (Sofortverkauf)') + '</span>');
        chips.push('<span class="chip">Kauf <b>' +
          (AO.settings.buyMethod === 'order' ? 'Order +2,5 %' : 'Sofort') + '</b></span>');
        if (S.selfCraft) chips.push('<span class="chip">Vorstufe: <b>Eigenbau</b></span>');
        el.chips.innerHTML = chips.join('');

        /* Alle Stufen im Vergleich */
        if (el.ovRows) {
          var fam = FAM[S.fam];
          var tiers = fam ? Object.keys(fam.tiers).map(Number).sort(function (a, b) { return a - b; }) : [];
          el.ovRows.innerHTML = tiers.map(function (t) {
            var x = fam.tiers[t];
            var dd = compute(x);
            var cur = t === S.tier;
            var xe = (cfg.ench && AO.craft.enchantable(x)) ? S.ench : 0;
            var kosten = dd.out ? dd.costTotal / dd.out : NaN;
            return '<tr class="hover"' + (cur ? ' style="background:var(--goldDim)"' : '') + '>' +
              '<td><div class="itemcell">' + F.img(AO.craft.productId(x, xe), 56, x.n) +
                '<div class="nm"><b>' + F.tier(t, xe) + ' ' + F.esc(x.n) + '</b></div></div></td>' +
              '<td>' + F.s(kosten) + '</td>' +
              '<td>' + F.s(dd.sellPrice) + '</td>' +
              '<td class="' + (dd.perItem >= 0 ? 'pos' : 'neg') + '">' + F.sg(dd.perItem) + '</td>' +
              '<td class="' + (dd.margin >= 0 ? 'pos' : 'neg') + '">' + F.pct(dd.margin) + '</td></tr>';
          }).join('');
        }

        if (keep) {
          var again = root.querySelector('.pinput[data-id="' + keep.id + '"][data-city="' + keep.city +
                                         '"][data-q="' + keep.q + '"][data-side="' + keep.side + '"]');
          if (again && again !== document.activeElement) {
            again.focus();
            try { again.setSelectionRange(keep.start, keep.end); } catch (e) {}
          }
        }
      }

      function line(l, v, dim, total) {
        return '<div class="dl' + (total ? ' total' : '') + '"' + (dim ? ' style="opacity:.55"' : '') + '>' +
          '<span>' + l + '</span><span>' + v + '</span></div>';
      }
    }

    return view;
  };
})();
