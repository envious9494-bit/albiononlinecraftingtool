/* Serien-Rechner: eine ganze Kategorie auf einen Blick.

   Gedanke dahinter: Marktpreise sind oft veraltet oder schlicht falsch. Hier
   trägt man die Preise selbst ein - einmal oben für die Ressourcen, und wo es
   abweicht direkt in der Zeile. Alles wird dauerhaft gespeichert.

   Preis-Vorrang je Zelle (von stark nach schwach):
     1. Zeilen-Überschreibung  (dieser Gegenstand, dieses Material)
     2. Eigener Preis          (gilt überall im Toolkit, auch oben eingetragen)
     3. Marktpreis             (nur wenn geladen)
*/
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  var SOURCES = {
    items:      { n: 'Ausrüstung', ench: true,  quality: true,  src: function () { return AO.data.items; } },
    refining:   { n: 'Refining',   ench: true,  quality: false, src: function () { return AO.data.refining; } },
    food:       { n: 'Nahrung',    ench: false, quality: false, src: function () { return AO.data.consumables.filter(function (c) { return c.c === 'food'; }).concat(AO.data.fish || []); } },
    potion:     { n: 'Tränke',     ench: true,  quality: false, src: function () { return AO.data.consumables.filter(function (c) { return c.c === 'potion'; }); } }
  };

  var S = AO.store.bind('batch', {
    source: 'items', cat: '', tier: 4, ench: 0, quality: 1,
    buyCity: 'Caerleon', sellCity: 'Caerleon',
    rrMode: 'none', rrManual: 15.2, fee: 800, crafts: 100, sort: 'margin'
  });

  /* Zeilenweise Überschreibungen: 'itemId|matId' -> Preis */
  var RO = AO.store.get('batchRowPrices', {}) || {};
  function roKey(itemId, matId) { return itemId + '|' + matId; }
  function roGet(itemId, matId) {
    var k = roKey(itemId, matId);
    return (k in RO) ? RO[k] : null;
  }
  function roSet(itemId, matId, v) {
    var k = roKey(itemId, matId);
    if (v === null) delete RO[k]; else RO[k] = v;
    AO.store.set('batchRowPrices', RO);
  }

  AO.views.batch = {
    id: 'batch',
    title: 'Serien-Rechner',
    subtitle: 'Eine ganze Kategorie vergleichen – mit eigenen, gespeicherten Preisen',

    html: function () {
      return '' +
      '<div class="card" style="margin-bottom:var(--s4)">' +
        '<div class="fieldset" style="display:flex;gap:var(--s4);flex-wrap:wrap;align-items:flex-end">' +
          '<div class="field stack" style="min-width:150px;margin:0"><label>Warengruppe</label><select data-x="source"></select></div>' +
          '<div class="field stack" style="min-width:190px;margin:0"><label>Kategorie</label><select data-x="cat"></select></div>' +
          '<div class="field stack" style="margin:0"><label>Stufe</label><div data-x="tierSeg"></div></div>' +
          '<div class="field stack" data-x="enchWrap" style="margin:0"><label>Verzauberung</label><div data-x="enchSeg"></div></div>' +
          '<div class="field stack" data-x="qualWrap" style="min-width:130px;margin:0" ' +
            'title="Beim Herstellen lässt sich die Qualität nicht bestimmen – verlässlich ' +
            'ist nur Normal. Alles darüber ist eine Annahme.">' +
            '<label>Qualität</label><select data-x="quality"></select>' +
            '<div class="hint" data-x="qualHint"></div></div>' +
        '</div>' +
        '<div class="fieldset" style="display:flex;gap:var(--s4);flex-wrap:wrap;align-items:flex-end">' +
          '<div class="field stack" style="min-width:140px;margin:0"><label>Einkauf</label><select data-x="buyCity"></select></div>' +
          '<div class="field stack" style="min-width:140px;margin:0"><label>Verkauf</label><select data-x="sellCity"></select></div>' +
          '<div class="field stack" style="margin:0"><label>Rückgaberate</label><div data-x="rrSeg"></div></div>' +
          '<div class="field stack" data-x="rrManualBox" hidden style="margin:0"><label data-x="rrLbl">%</label>' +
            '<input class="num" data-x="rrManual" inputmode="decimal" style="width:120px"></div>' +
          '<div class="field stack" style="margin:0"><label>Gebühr /100 NW</label>' +
            '<input class="num" data-x="fee" inputmode="numeric" style="width:100px"></div>' +
          '<div class="field stack" style="margin:0"><label>Crafts je Gegenstand</label>' +
            '<input class="num" data-x="crafts" inputmode="numeric" style="width:110px"></div>' +
        '</div>' +
      '</div>' +

      /* ---------- Ressourcenpreise, gelten für die ganze Tabelle ---------- */
      '<div class="card" style="margin-bottom:var(--s4)">' +
        '<div class="card-head"><h3>Ressourcenpreise</h3>' +
          '<div class="right"><span class="mut">gelten für alle Zeilen unten · werden gespeichert</span></div></div>' +
        '<div class="card-body tight" data-x="resBox"></div>' +
      '</div>' +

      '<div class="view-toolbar">' +
        '<button class="btn primary" data-x="load"><span class="spin">⟳</span> Marktpreise laden</button>' +
        '<span class="mut" data-x="stamp"></span>' +
        '<div data-x="sortSeg"></div>' +
        '<button class="btn sm ghost" data-x="clearRows">Eigene Zeilenpreise löschen</button>' +
      '</div>' +
      '<div class="chips" data-x="chips" style="margin-bottom:var(--s4)"></div>' +

      '<div class="card">' +
        '<div class="card-head"><h3 data-x="tblTitle">Gegenstände</h3>' +
          '<div class="right"><span class="mut" data-x="count"></span></div></div>' +
        '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
          '<table class="data"><thead><tr data-x="head"></tr></thead>' +
          '<tbody data-x="rows"></tbody></table></div>' +
      '</div>' +
      '<p class="view-footnote">Gold umrandete Felder sind von dir eingetragen und überschreiben den Marktpreis. ' +
      'Oben eingetragene Ressourcenpreise gelten überall im Toolkit; ein Preis direkt in der Zeile gilt nur ' +
      'für diesen einen Gegenstand. ↺ setzt zurück.</p>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      U.fill(el.source, Object.keys(SOURCES).map(function (k) { return { v: k, n: SOURCES[k].n }; }), S.source);
      U.fill(el.buyCity, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.buyCity);
      U.fill(el.sellCity, AO.data.sellLocations, S.sellCity);
      U.fill(el.quality, AO.data.qualities.map(function (q) { return { v: q.q, n: q.label }; }), S.quality);
      /* Beim Herstellen kommt ganz ueberwiegend Normal heraus. Eine bessere
         Stufe anzunehmen heisst, mit einem Preis zu rechnen, den man nicht
         erreicht - deshalb wird alles darueber ausdruecklich markiert. */
      function syncQualHint() {
        if (!el.qualHint) return;
        el.qualHint.innerHTML = S.quality > 1
          ? '<span class="warn">Annahme – verlässlich ist nur <b>Normal</b>.</span>'
          : 'Normal – die einzige Stufe, auf die beim Herstellen Verlass ist.';
      }
      syncQualHint();
      el.fee.value = S.fee; el.crafts.value = S.crafts;
      el.rrManual.value = String(S.rrManual).replace('.', ',');
      el.rrSeg.innerHTML = U.seg(AO.data.returnRates.map(function (r) {
        return { v: r.id, n: r.dynamic ? r.label : r.label + ' ' + F.n1(r.rate) + ' %' };
      }).concat([{ v: 'manual', n: 'Manuell' }]), S.rrMode);
      el.sortSeg.innerHTML = U.seg([
        { v: 'margin', n: 'nach Marge' }, { v: 'profit', n: 'nach Gewinn' }, { v: 'name', n: 'nach Name' }
      ], S.sort);
      syncRateBox();

      syncCats(); syncTierSeg(); syncEnchSeg();

      el.source.addEventListener('change', function () {
        S.source = el.source.value; S.cat = ''; S.$save();
        syncCats(); syncTierSeg(); syncEnchSeg(); render();
      });
      el.cat.addEventListener('change', function () { S.cat = el.cat.value; S.$save(); syncTierSeg(); render(); });
      el.tierSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.tier = +b.dataset.v; S.$save(); U.segSet(el.tierSeg.firstChild, b.dataset.v); render();
      });
      el.enchSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.ench = +b.dataset.v; S.$save(); U.segSet(el.enchSeg.firstChild, b.dataset.v); render();
      });
      el.rrSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.rrMode = b.dataset.v; S.$save(); U.segSet(el.rrSeg.firstChild, b.dataset.v);
        syncRateBox(); render();
      });
      el.sortSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.sort = b.dataset.v; S.$save(); U.segSet(el.sortSeg.firstChild, b.dataset.v); render();
      });
      ['buyCity', 'sellCity', 'quality'].forEach(function (k) {
        el[k].addEventListener('change', function () {
          S[k] = (k === 'quality') ? +el[k].value : el[k].value; S.$save();
          if (k === 'quality') syncQualHint();
          render();
        });
      });
      ['fee', 'crafts', 'rrManual'].forEach(function (k) {
        el[k].addEventListener('input', U.debounce(function () {
          /* Nur ganzzahlige Felder duerfen den Punkt als Tausendertrenner
             deuten - bei einer Rate/Bonus-Angabe ist er das Komma. */
          var raw = String(el[k].value);
          var v = parseFloat(k === 'rrManual' ? raw.replace(',', '.')
                                              : raw.replace(/\./g, '').replace(',', '.'));
          v = isFinite(v) ? v : 0;
          if (k === 'rrManual' && isHideout()) {
            AO.settings.hideoutBonus = v; AO.settings.$save();
            document.dispatchEvent(new CustomEvent('ao:settings'));
          } else { S[k] = v; S.$save(); }
          render();
        }, 220));
      });

      function syncRateBox() {
        var show = isHideout() || S.rrMode === 'manual';
        el.rrManualBox.hidden = !show;
        if (!show) return;
        el.rrLbl.textContent = isHideout() ? 'Produktionsbonus %' : 'Rate %';
        /* Waehrend getippt wird nicht ueberschreiben - sonst verschwindet das
           gerade gesetzte Komma und Nachkommastellen sind uneingebbar. */
        if (document.activeElement === el.rrManual) return;
        el.rrManual.value = String(isHideout() ? AO.settings.hideoutBonus : S.rrManual).replace('.', ',');
      }

      el.load.addEventListener('click', function () {
        var ids = allIds();
        if (!ids.length) return;
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(ids, cfg().quality ? [1, 2, 3, 4, 5] : [1])
          .then(function () { U.toast('Marktpreise geladen', 'ok'); })
          .catch(function (e) { U.toast('Laden fehlgeschlagen: ' + e.message, 'err'); })
          .then(function () { el.load.classList.remove('loading'); el.load.disabled = false; render(); });
      });
      el.clearRows.addEventListener('click', function () {
        RO = {}; AO.store.set('batchRowPrices', RO);
        U.toast('Zeilenpreise gelöscht', 'ok'); render();
      });

      /* --- Preiseingaben ------------------------------------------------- */
      root.addEventListener('input', function (e) {
        var i = e.target.closest('input[data-kind]');
        if (!i) return;
        var v = F.parse(i.value);
        if (i.dataset.kind === 'row') {
          roSet(i.dataset.item, i.dataset.id, v);
        } else {
          /* globaler eigener Preis - gilt im ganzen Toolkit */
          AO.market.setOwn(i.dataset.id, i.dataset.city, +(i.dataset.q || 1), i.dataset.side, v);
        }
        i.classList.toggle('own', v !== null);
        recalc();
      });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-reset]');
        if (!b) return;
        if (b.dataset.kind === 'row') roSet(b.dataset.item, b.dataset.id, null);
        else AO.market.setOwn(b.dataset.id, b.dataset.city, +(b.dataset.q || 1), b.dataset.side, null);
        render();
      });

      document.addEventListener('ao:server', function () { if (document.contains(root)) render(); });
      U.onPrices(root, render);
      /* Der Hideout-Bonus ist global - wird er anderswo geaendert, muss das
         Eingabefeld hier nachziehen, sonst zeigt es einen anderen Wert an,
         als gerechnet wird. */
      document.addEventListener('ao:settings', function () { syncRateBox(); render(); });

      render();

      /* ================================================================== */
      function cfg() { return SOURCES[S.source]; }
      function buySide() { return AO.craft.buySide(AO.settings.buyMethod); }
      function sellSide() { return AO.craft.sellSide(AO.settings.sellMethod); }
      function rate() { return AO.craft.returnRate(S.rrMode, S.rrManual); }
      function isHideout() { return S.rrMode === 'hideout' || S.rrMode === 'hideoutfocus'; }
      function enchOf(it) { return (cfg().ench && AO.craft.enchantable(it)) ? S.ench : 0; }

      function syncCats() {
        var seen = {};
        cfg().src().forEach(function (i) { seen[i.c] = 1; });
        var list = Object.keys(seen).sort(function (a, b) {
          return (AO.data.categories.catDe[a] || a).localeCompare(AO.data.categories.catDe[b] || b, 'de');
        });
        if (!S.cat || list.indexOf(S.cat) < 0) S.cat = list[0];
        U.fill(el.cat, list.map(function (c) {
          return { v: c, n: AO.data.categories.catDe[c] || c };
        }), S.cat);
        el.enchWrap.hidden = !cfg().ench;
        el.qualWrap.hidden = !cfg().quality;
      }

      function syncTierSeg() {
        var t = {};
        cfg().src().forEach(function (i) { if (i.c === S.cat) t[i.t] = 1; });
        var tiers = Object.keys(t).map(Number).sort(function (a, b) { return a - b; });
        if (tiers.length && tiers.indexOf(S.tier) < 0) S.tier = tiers[0];
        el.tierSeg.innerHTML = U.seg(tiers.map(function (x) {
          return { v: String(x), n: 'T' + x };
        }), String(S.tier));
      }

      function syncEnchSeg() {
        /* Hoechste Stufe der gewaehlten Warengruppe - Traenke enden bei .3. */
        var liste = cfg().src();
        var max = liste.length ? Math.max.apply(null, liste.map(AO.craft.enchMax)) : 4;
        if (S.ench > max) S.ench = 0;
        var stufen = [0];
        for (var i = 1; i <= max; i++) stufen.push(i);
        el.enchSeg.innerHTML = U.seg(stufen.map(function (e) {
          return { v: String(e), n: e ? '.' + e : 'Normal' };
        }), String(S.ench));
      }

      /* Gegenstände der aktuellen Auswahl */
      function rowsData() {
        return cfg().src().filter(function (i) { return i.c === S.cat && i.t === S.tier; });
      }

      /* Materialien aufteilen: normale Ressourcen (spaltenweise, geteilt)
         und Artefakte (gehören zum einzelnen Gegenstand). */
      function split(it) {
        var e = enchOf(it), norm = [], art = [];
        AO.craft.recipeFor(it, S.ench).forEach(function (entry) {
          var id = AO.craft.matId(entry[0], e, entry[2]);
          (AO.craft.noReturn(id) ? art : norm).push({ id: id, count: entry[1] });
        });
        return { normal: norm, artifacts: art };
      }

      /* Spalten = alle normalen Materialien, die in dieser Auswahl vorkommen */
      function columns() {
        var seen = {}, out = [];
        rowsData().forEach(function (it) {
          split(it).normal.forEach(function (m) {
            if (!seen[m.id]) { seen[m.id] = 1; out.push(m.id); }
          });
        });
        return out;
      }

      function allIds() {
        var ids = [];
        rowsData().forEach(function (it) {
          ids = ids.concat(AO.craft.idsFor(it, enchOf(it)));
        });
        return ids;
      }

      /* Preis eines Materials für einen bestimmten Gegenstand */
      function matPrice(itemId, matId) {
        var ro = roGet(itemId, matId);
        if (ro !== null) return ro;
        return AO.market.get(matId, S.buyCity, 1, buySide());
      }

      function calcRow(it) {
        var e = enchOf(it);
        var prodId = AO.craft.productId(it, e);
        return AO.craft.calc({
          priceOf: function (id, city, q, side) {
            /* Dieselbe Qualitaet wie Eingabefeld und Preisabruf: Refining,
               Nahrung und Traenke kennen keine Qualitaetsstufen, ein aus einer
               frueheren Auswahl stehengebliebenes S.quality wuerde sonst ins
               Leere greifen und den Erlos auf 0 setzen. */
            if (id === prodId) {
              return AO.market.get(prodId, S.sellCity, cfg().quality ? S.quality : 1, sellSide());
            }
            return matPrice(it.id, id);
          },
          recipe: AO.craft.recipeFor(it, e), ench: e, amountCrafted: it.a, crafts: S.crafts,
          returnRate: rate(), buyCity: S.buyCity, sellCity: S.sellCity,
          quality: cfg().quality ? S.quality : 1,
          premium: AO.settings.premium, buyMethod: AO.settings.buyMethod,
          sellMethod: AO.settings.sellMethod, stationFee: S.fee,
          focusPerCraft: 0, useFocus: false, productId: prodId
        });
      }

      /* Eingabefeld: globaler Preis (oben) bzw. Zeilenpreis (Tabelle) */
      function inputGlobal(id, city, q, side, width) {
        var own = AO.market.isOwn(id, city, q, side);
        var v = AO.market.get(id, city, q, side);
        var mk = AO.market.raw(id, city, q, side);
        return '<span class="pwrap">' + U.dot(AO.market.date(id, city, q, side), F.ort(city)) +
          '<input class="pinput' + (own ? ' own' : '') + '" data-kind="global" data-id="' + F.esc(id) +
          '" data-city="' + F.esc(city) + '" data-q="' + q + '" data-side="' + side +
          '" inputmode="numeric" spellcheck="false" style="width:' + (width || '10ch') + '"' +
          ' value="' + (v === null || v === undefined ? '' : F.s(v)) + '" placeholder="—"' +
          ' title="' + (mk != null ? 'Marktpreis: ' + F.s(mk) : 'Keine Marktdaten') + '">' +
          (own ? '<button class="reset" data-reset="1" data-kind="global" data-id="' + F.esc(id) +
                 '" data-city="' + F.esc(city) + '" data-q="' + q + '" data-side="' + side +
                 '" title="Auf Marktpreis zurücksetzen">↺</button>' : '') + '</span>';
      }

      function inputRow(itemId, matId, count) {
        var ro = roGet(itemId, matId);
        var eff = matPrice(itemId, matId);
        return '<span class="pwrap">' +
          '<input class="pinput' + (ro !== null ? ' own' : '') + '" data-kind="row" data-item="' + F.esc(itemId) +
          '" data-id="' + F.esc(matId) + '" inputmode="numeric" spellcheck="false"' +
          ' value="' + (eff === null || eff === undefined ? '' : F.s(eff)) + '" placeholder="—"' +
          ' title="' + F.q(count) + '× ' + F.esc(AO.craft.matName(matId)) +
          (ro !== null ? ' · eigener Preis nur für diesen Gegenstand' : ' · Preis von oben') + '">' +
          (ro !== null ? '<button class="reset" data-reset="1" data-kind="row" data-item="' + F.esc(itemId) +
                 '" data-id="' + F.esc(matId) + '" title="Wieder den Preis von oben nehmen">↺</button>' : '') +
          '<span class="mut" style="font-size:11px">×' + F.q(count) + '</span></span>';
      }

      /* ------------------------------------------------------------------ */
      function render() {
        var cols = columns();
        var list = rowsData();

        el.stamp.textContent = AO.market.has()
          ? 'Marktdaten: ' + F.time(AO.market.stamp()) + ' Uhr' : 'Noch keine Marktdaten';
        el.tblTitle.textContent = (AO.data.categories.catDe[S.cat] || S.cat) + ' · T' + S.tier +
          (enchOfAny() ? '.' + S.ench : '');
        el.chips.innerHTML =
          '<span class="chip">Rückgabe <b>' + F.pct(rate() * 100) + '</b></span>' +
          '<span class="chip">Steuer <b>' + (AO.settings.premium ? '4 %' : '8 %') + '</b>' +
            (AO.settings.sellMethod === 'order' ? ' + Order 2,5 %' : ' (Sofortverkauf)') + '</span>' +
          '<span class="chip">Kauf <b>' + (AO.settings.buyMethod === 'order' ? 'Order +2,5 %' : 'Sofort') + '</b></span>' +
          '<span class="chip">Eigene Zeilenpreise <b>' + Object.keys(RO).length + '</b></span>';

        /* Ressourcenpreise oben */
        el.resBox.innerHTML = cols.length
          ? '<div style="display:flex;gap:var(--s5);flex-wrap:wrap">' + cols.map(function (id) {
              return '<div style="display:flex;align-items:center;gap:var(--s3)">' +
                F.img(id, 56, AO.craft.matName(id)) +
                '<div><div style="font-size:13px;font-weight:600">' + F.esc(AO.craft.matName(id)) + '</div>' +
                '<div style="font-size:11px" class="mut">' + F.esc(id) + '</div></div>' +
                inputGlobal(id, S.buyCity, 1, buySide(), '11ch') + '</div>';
            }).join('') + '</div>'
          : '<div class="mut">Für diese Auswahl gibt es keine gemeinsamen Ressourcen.</div>';

        /* Tabellenkopf */
        el.head.innerHTML = '<th>Gegenstand</th>' +
          cols.map(function (id) {
            return '<th title="' + F.esc(AO.craft.matName(id)) + ' – Preis gilt aus dem Feld oben, ' +
              'kann hier je Gegenstand überschrieben werden">' + F.esc(AO.craft.matName(id)) + '</th>';
          }).join('') +
          '<th title="Artefakte werden nie zurückerstattet – Preis gehört zum einzelnen Gegenstand">Artefakt</th>' +
          '<th>Verkauf</th><th>Kosten / Stück</th><th>Gewinn / Stück</th><th>Marge</th><th>Gewinn gesamt</th>';

        if (!list.length) {
          el.rows.innerHTML = '<tr><td colspan="' + (cols.length + 7) + '" class="t-empty">' +
            'Für diese Kategorie gibt es auf T' + S.tier + ' nichts.</td></tr>';
          el.count.textContent = '';
          return;
        }

        var data = list.map(function (it) { return { it: it, d: calcRow(it) }; });
        data.sort(function (a, b) {
          if (S.sort === 'name') return a.it.n.localeCompare(b.it.n, 'de');
          if (S.sort === 'profit') return (b.d.profit || -Infinity) - (a.d.profit || -Infinity);
          return (b.d.margin || -Infinity) - (a.d.margin || -Infinity);
        });
        var luecken = data.filter(function (x) { return x.d.missingPrice.length; }).length;
        el.count.textContent = data.length + ' Gegenstände' +
          (luecken ? ' · ' + luecken + ' ohne vollständige Preise' : '');

        el.rows.innerHTML = data.map(function (x) {
          var it = x.it, d = x.d, e = enchOf(it);
          var sp = split(it);
          var byId = {};
          sp.normal.forEach(function (m) { byId[m.id] = m.count; });
          var prodId = AO.craft.productId(it, e);

          var matCells = cols.map(function (id) {
            return '<td>' + (byId[id] ? inputRow(it.id, id, byId[id]) : '<span class="faint">—</span>') + '</td>';
          }).join('');

          var artCell = sp.artifacts.length
            ? sp.artifacts.map(function (m) {
                return '<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">' +
                  F.img(m.id, 40, AO.craft.matName(m.id)) + inputRow(it.id, m.id, m.count) + '</div>';
              }).join('')
            : '<span class="faint">—</span>';

          /* Fehlt ein Materialpreis, rechnet der Kern ihn als 0 - der Gewinn
             waere dann geschoent. Solche Zeilen werden markiert und ihre
             Gewinnspalten ausgeblendet statt falsch gefuellt. */
          var luecke = d.missingPrice.length > 0;
          var ok = isFinite(d.margin) && !luecke;
          return '<tr class="hover" data-item="' + F.esc(it.id) + '">' +
            '<td><div class="itemcell">' + F.img(prodId, 56, it.n) +
              '<div class="nm"><b>' + F.tier(it.t, e) + ' ' + F.esc(it.n) +
              (luecke ? ' <span class="warn" title="Ohne Preis: ' +
                F.esc(d.missingPrice.map(AO.craft.matName).join(', ')) +
                ' – Gewinn lässt sich nicht berechnen">⚠</span>' : '') + '</b>' +
              '<span>' + F.esc(it.id) + '</span></div></div></td>' +
            matCells +
            '<td>' + artCell + '</td>' +
            '<td>' + inputGlobal(prodId, S.sellCity, cfg().quality ? S.quality : 1, sellSide(), '11ch') + '</td>' +
            '<td' + (luecke ? ' class="faint"' : '') + '>' + F.s(d.out ? d.costTotal / d.out : NaN) + '</td>' +
            '<td class="' + (ok ? (d.perItem >= 0 ? 'pos' : 'neg') : 'faint') + '"><b>' + (ok ? F.sg(d.perItem) : '—') + '</b></td>' +
            '<td class="' + (ok ? (d.margin >= 0 ? 'pos' : 'neg') : 'faint') + '">' + (ok ? F.pct(d.margin) : '—') + '</td>' +
            '<td class="' + (ok ? (d.profit >= 0 ? 'pos' : 'neg') : 'faint') + '">' + (ok ? F.sg(d.profit) : '—') + '</td></tr>';
        }).join('');
      }

      function enchOfAny() {
        return cfg().ench && S.ench > 0 && rowsData().some(function (i) { return AO.craft.enchantable(i); });
      }

      /* Nach einer Preiseingabe nur die Zahlen auffrischen - Eingabefelder
         behalten dabei den Tastaturfokus. */
      function recalc() {
        var cols = columns();
        var list = rowsData();
        var trs = U.qa('tbody[data-x="rows"] tr', root);
        var byRow = {};
        list.forEach(function (it) { byRow[it.id] = calcRow(it); });
        trs.forEach(function (tr) {
          /* Zuordnung über data-item am <tr> - ein Selektor auf das Namensfeld
             würde die Tier-Marke erwischen, die ebenfalls ein <span> ist. */
          var d = byRow[tr.dataset.item];
          if (!d) return;
          var tds = tr.querySelectorAll('td');
          var base = 1 + cols.length + 2;          /* Item + Materialien + Artefakt + Verkauf */
          var ok = isFinite(d.margin) && !d.missingPrice.length;
          if (tds[base])     tds[base].textContent = F.s(d.out ? d.costTotal / d.out : NaN);
          if (tds[base + 1]) { tds[base + 1].innerHTML = '<b>' + (ok ? F.sg(d.perItem) : '—') + '</b>';
                               tds[base + 1].className = ok ? (d.perItem >= 0 ? 'pos' : 'neg') : 'faint'; }
          if (tds[base + 2]) { tds[base + 2].textContent = ok ? F.pct(d.margin) : '—';
                               tds[base + 2].className = ok ? (d.margin >= 0 ? 'pos' : 'neg') : 'faint'; }
          if (tds[base + 3]) { tds[base + 3].textContent = ok ? F.sg(d.profit) : '—';
                               tds[base + 3].className = ok ? (d.profit >= 0 ? 'pos' : 'neg') : 'faint'; }
        });
        /* Zeilenfelder, die den Preis von oben erben, mitziehen */
        U.qa('input[data-kind="row"]', root).forEach(function (i) {
          if (document.activeElement === i) return;
          if (roGet(i.dataset.item, i.dataset.id) !== null) return;
          var p = matPrice(i.dataset.item, i.dataset.id);
          i.value = (p === null || p === undefined) ? '' : F.s(p);
        });
      }
    }
  };
})();
