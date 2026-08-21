/* Chancen: was lohnt sich gerade – mit vollständigem Handelsweg.

   Grundregel: eine Zeile erscheint NUR, wenn wirklich jeder benötigte Preis
   vorliegt (jedes Material und das Endprodukt) und nicht veraltet ist.
   Alles andere wird ausgewiesen, aber nicht als Chance verkauft. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  var SCOPES = [
    { v: 'refining', n: 'Refining', src: function () { return AO.data.refining; }, ench: true, bonus: true },
    { v: 'food',     n: 'Nahrung',  src: function () { return AO.data.consumables.filter(function (c) { return c.c === 'food'; }); }, ench: true },
    { v: 'potion',   n: 'Tränke',   src: function () { return AO.data.consumables.filter(function (c) { return c.c === 'potion'; }); }, ench: true },
    { v: 'fish',     n: 'Fisch',    src: function () { return AO.data.fish || []; } }
  ];

  var AGES = [
    { v: '0',  n: 'egal' },
    { v: '24', n: 'max. 24 Std.' },
    { v: '8',  n: 'max. 8 Std.' },
    { v: '3',  n: 'max. 3 Std.' }
  ];

  var S = AO.store.bind('opportunity', {
    scope: 'refining', ench: 0, rrMode: 'city', rrManual: 36.7,
    fee: 800, crafts: 100, maxAge: '24', sort: 'margin', minMargin: 0
  });

  var RESULT = null, SKIPPED = 0, RUNNING = false;

  AO.views.opportunity = {
    id: 'opportunity',
    title: 'Chancen',
    subtitle: 'Was sich gerade lohnt – inklusive Einkaufs- und Verkaufsweg',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Suchbereich</h4>' +
            '<div class="field stack"><label>Warengruppe</label><div data-x="scopeSeg"></div></div>' +
            '<div class="field stack" data-x="enchWrap"><label>Verzauberung</label><div data-x="enchSeg"></div></div>' +
            '<div class="field stack"><label>Datenalter</label><div data-x="ageSeg"></div>' +
              '<div class="hint">Alte Preise erzeugen Scheinchancen. Zeilen mit zu alten ' +
              'Daten werden gar nicht erst angezeigt.</div></div>' +
          '</div>' +
          '<div class="fieldset"><h4>Annahmen</h4>' +
            '<div class="field stack"><label>Rückgaberate</label><div data-x="rrSeg"></div>' +
              '<div class="field" data-x="rrManualBox" hidden style="margin-top:6px">' +
                '<span class="lbl" data-x="rrLbl"></span>' +
                '<input class="num" data-x="rrManual" inputmode="decimal" style="max-width:100px">' +
                '<span class="mut">%</span></div>' +
              '<div class="hint" data-x="rrHint" hidden></div></div>' +
            '<div class="field"><span class="lbl w">Gebühr</span><input class="num" data-x="fee" inputmode="numeric">' +
              '<span class="mut">/100 NW</span></div>' +
            '<div class="field"><span class="lbl w">Anzahl</span><input class="num" data-x="crafts" inputmode="numeric">' +
              '<span class="mut">Crafts</span></div>' +
            '<div class="field"><span class="lbl w">Ab Marge</span><input class="num" data-x="minMargin" inputmode="decimal">' +
              '<span class="mut">%</span></div>' +
            '<div class="hint">Einkauf, Verkauf, Steuer und Premium kommen aus den ' +
              'globalen Einstellungen.</div>' +
          '</div>' +
          '<div class="fieldset">' +
            '<button class="btn primary block" data-x="scan"><span class="spin">⟳</span> Preise laden und suchen</button>' +
            '<div class="hint" data-x="progress" style="margin-top:var(--s2)"></div>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="chips" data-x="chips" style="margin-bottom:var(--s4)"></div>' +
          '<div data-x="notice"></div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
          '<div class="card">' +
            '<div class="card-head"><h3>Beste Gelegenheiten</h3>' +
              '<div class="right"><div data-x="sortSeg"></div></div></div>' +
            '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
              '<table class="data"><thead><tr>' +
                '<th>Produkt</th><th>Weg</th>' +
                '<th title="Materialeinkauf am günstigsten Ort, inkl. Rückgabe und Gebühren">Kosten / Stück</th>' +
                '<th>Verkauf / Stück</th><th>Gewinn / Stück</th><th>Marge</th>' +
                '<th title="Für die eingestellte Anzahl Crafts">Gewinn gesamt</th>' +
              '</tr></thead><tbody data-x="rows"></tbody></table></div>' +
          '</div>' +
          '<p class="view-footnote">Der Weg nennt für jedes Material die günstigste Stadt und für das ' +
          'Produkt die beste. Wer alles in einer Stadt kaufen will, nimmt den Crafting- oder ' +
          'Refining-Rechner und stellt die Stadt dort fest ein.</p>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      el.scopeSeg.innerHTML = U.seg(SCOPES.map(function (s) { return { v: s.v, n: s.n }; }), S.scope);
      el.ageSeg.innerHTML = U.seg(AGES, S.maxAge);
      el.enchSeg.innerHTML = U.seg([0, 1, 2, 3, 4].map(function (e) {
        return { v: String(e), n: e ? '.' + e : 'Normal' };
      }), String(S.ench));
      el.rrSeg.innerHTML = U.seg(AO.data.returnRates.map(function (r) {
        return { v: r.id, n: r.dynamic ? r.label : r.label + ' ' + F.n1(r.rate) + ' %' };
      }).concat([{ v: 'manual', n: 'Manuell' }]), S.rrMode);
      el.sortSeg.innerHTML = U.seg([
        { v: 'margin', n: 'nach Marge' }, { v: 'profit', n: 'nach Gewinn' }
      ], S.sort);

      el.fee.value = S.fee; el.crafts.value = S.crafts;
      el.minMargin.value = String(S.minMargin).replace('.', ',');
      el.rrManual.value = String(S.rrManual).replace('.', ',');
      syncRateBox();
      syncScope();

      el.scopeSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.scope = b.dataset.v; S.$save();
        U.segSet(el.scopeSeg.firstChild, b.dataset.v);
        syncScope(); RESULT = null; render();
      });
      el.ageSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.maxAge = b.dataset.v; S.$save(); U.segSet(el.ageSeg.firstChild, b.dataset.v); scan(false);
      });
      el.enchSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b || b.disabled) return;
        S.ench = +b.dataset.v; S.$save(); U.segSet(el.enchSeg.firstChild, b.dataset.v);
        RESULT = null; render();
      });
      el.rrSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.rrMode = b.dataset.v; S.$save(); U.segSet(el.rrSeg.firstChild, b.dataset.v);
        syncRateBox(); scan(false);
      });
      el.sortSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.sort = b.dataset.v; S.$save(); U.segSet(el.sortSeg.firstChild, b.dataset.v); render();
      });
      ['fee', 'crafts', 'minMargin', 'rrManual'].forEach(function (k) {
        el[k].addEventListener('input', U.debounce(function () {
          /* Rate und Bonus sind Dezimalzahlen - hier ist der Punkt kein
             Tausendertrenner. */
          var raw = String(el[k].value);
          var dec = (k === 'rrManual' || k === 'minMargin');
          var v = parseFloat(dec ? raw.replace(',', '.') : raw.replace(/\./g, '').replace(',', '.'));
          v = isFinite(v) ? v : 0;
          if (k === 'rrManual' && isHideout()) {
            AO.settings.hideoutBonus = v; AO.settings.$save();
            document.dispatchEvent(new CustomEvent('ao:settings'));
          } else { S[k] = v; S.$save(); }
          scan(false);
        }, 250));
      });

      function syncRateBox() {
        var show = isHideout() || S.rrMode === 'manual';
        el.rrManualBox.hidden = !show;
        el.rrHint.hidden = !isHideout();
        if (!show) return;
        el.rrLbl.textContent = isHideout() ? 'Produktionsbonus' : 'Rate';
        /* Nicht ins gerade bearbeitete Feld schreiben. */
        if (document.activeElement !== el.rrManual) {
          el.rrManual.value = String(isHideout() ? AO.settings.hideoutBonus : S.rrManual).replace('.', ',');
        }
        el.rrManual.title = isHideout() ? 'Produktionsbonus des Hideouts in Prozent'
                                        : 'R\u00fcckgaberate in Prozent';
        if (isHideout()) {
          el.rrHint.innerHTML = 'Ergibt <b>' + F.pct(rate() * 100) + '</b> R\u00fcckgabe' +
            (S.rrMode === 'hideoutfocus' ? ' (inkl. Fokus)' : '') + '.';
        }
      }
      el.scan.addEventListener('click', function () { scan(true); });

      root.addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-key]');
        if (!tr || U.hasSelection()) return;
        var d = root.querySelector('tr.detail[data-for="' + tr.dataset.key + '"]');
        if (d) d.hidden = !d.hidden;
      });

      document.addEventListener('ao:server', function () { if (document.contains(root)) { RESULT = null; render(); } });
      /* Preisaenderung: bereits berechnete Chancen NICHT wegwerfen, sondern
         mit den neuen Preisen noch einmal durchrechnen - ohne Netzzugriff. */
      U.onPrices(root, function () { if (RESULT) scan(false); else render(); });
      document.addEventListener('ao:settings', function () { syncRateBox(); scan(false); });

      render();

      /* ------------------------------------------------------------------ */
      function scopeCfg() {
        return SCOPES.filter(function (s) { return s.v === S.scope; })[0];
      }
      function syncScope() {
        var c = scopeCfg();
        el.enchWrap.hidden = !c.ench;
        if (!c.ench) { S.ench = 0; return; }
        /* Die Stufenleiste richtet sich nach der Warengruppe: Traenke gehen
           nur bis .3, raffinierte Rohstoffe bis .4. */
        var liste = c.src();
        var max = liste.length ? Math.max.apply(null, liste.map(AO.craft.enchMax)) : 4;
        if (S.ench > max) S.ench = 0;
        var stufen = [0];
        for (var i = 1; i <= max; i++) stufen.push(i);
        el.enchSeg.innerHTML = U.seg(stufen.map(function (e) {
          return { v: String(e), n: e ? '.' + e : 'Normal' };
        }), String(S.ench));
      }
      function rate() { return AO.craft.returnRate(S.rrMode, S.rrManual); }
      function isHideout() { return S.rrMode === 'hideout' || S.rrMode === 'hideoutfocus'; }
      function maxAgeMs() {
        var h = parseFloat(S.maxAge);
        return h > 0 ? h * 3600000 : Infinity;
      }
      function fresh(d) {
        if (maxAgeMs() === Infinity) return true;
        return !!d && (Date.now() - d.getTime()) <= maxAgeMs();
      }

      /* günstigster bzw. bester Ort für ein Item, nur mit frischen Daten */
      /* Bester Verkaufsort, wobei je Ort die passende Seite gilt. */
      function bestPlaceSell(id, q, method) {
        var best = null;
        AO.data.marketLocations.forEach(function (city) {
          var side = AO.craft.sellSideAt(city, method);
          var v = AO.market.get(id, city, q, side);
          if (v === null || v === undefined) return;
          if (!AO.market.isOwn(id, city, q, side) && !fresh(AO.market.date(id, city, q, side))) return;
          if (!best || v > best.v) best = { city: city, v: v, side: side };
        });
        return best;
      }

      function bestPlace(id, q, side, dir, locations) {
        var best = null;
        (locations || AO.data.marketLocations).forEach(function (city) {
          var v = AO.market.get(id, city, q, side);
          if (v === null || v === undefined) return;
          /* Eigene Preise gelten immer, Marktpreise nur wenn frisch genug */
          if (!AO.market.isOwn(id, city, q, side) && !fresh(AO.market.date(id, city, q, side))) return;
          if (!best || (dir === 'min' ? v < best.v : v > best.v)) best = { city: city, v: v };
        });
        return best;
      }

      function candidates() {
        var c = scopeCfg();
        return c.src().map(function (it) {
          var e = (c.ench && AO.craft.enchantable(it)) ? S.ench : 0;
          return { it: it, ench: e };
        });
      }

      function idsForScan() {
        var ids = [];
        candidates().forEach(function (k) {
          ids = ids.concat(AO.craft.idsFor(k.it, k.ench));
        });
        return ids;
      }

      function scan(load) {
        if (RUNNING) return;
        var run = function () {
          RESULT = []; SKIPPED = 0;
          var buySide = AO.craft.buySide(AO.settings.buyMethod);
          var sellSide = AO.craft.sellSide(AO.settings.sellMethod);
          var r = rate();

          candidates().forEach(function (k) {
            var it = k.it, e = k.ench;
            var prodId = AO.craft.productId(it, e);
            /* Am Schwarzmarkt zaehlt die Kauforder, in Staedten die
               eingestellte Verkaufsart - deshalb je Ort entscheiden. */
            var sell = bestPlaceSell(prodId, 1, AO.settings.sellMethod);
            var mats = [], ok = !!sell;

            AO.craft.recipeFor(it, e).forEach(function (entry) {
              if (!ok) return;
              var id = AO.craft.matId(entry[0], e, entry[2]);
              /* Der Schwarzmarkt handelt keine Rohstoffe - er darf nie als
             Einkaufsort fuer Materialien vorgeschlagen werden. */
          var p = bestPlace(id, 1, buySide, 'min', AO.data.cities);
              if (!p) { ok = false; return; }
              mats.push({ id: id, name: AO.craft.matName(id), count: entry[1], city: p.city, price: p.v });
            });

            if (!ok) { SKIPPED++; return; }

            /* Kalkulation mit den jeweils besten Orten */
            var priceMap = {};
            mats.forEach(function (m) { priceMap[m.id] = m.price; });
            var d = AO.craft.calc({
              priceOf: function (id, city, q, side) {
                if (id === prodId) return sell.v;
                return (id in priceMap) ? priceMap[id] : null;
              },
              recipe: AO.craft.recipeFor(it, e), ench: e, amountCrafted: it.a, crafts: S.crafts,
              returnRate: r, buyCity: '-', sellCity: sell.city, quality: 1,
              premium: AO.settings.premium, buyMethod: AO.settings.buyMethod,
              sellMethod: AO.settings.sellMethod, stationFee: S.fee,
              focusPerCraft: 0, useFocus: false, productId: prodId
            });
            if (!isFinite(d.margin)) { SKIPPED++; return; }

            RESULT.push({
              key: prodId, it: it, ench: e, prodId: prodId,
              mats: mats, sellCity: sell.city, sellPrice: sell.v,
              perItem: d.perItem, margin: d.margin, profit: d.profit,
              costPer: d.out ? d.costTotal / d.out : NaN,
              bonusCity: scopeCfg().bonus ? AO.data.refineBonus[
                it.id.replace(/^T\d_/, '').replace(/_LEVEL\d$/, '')] : null
            });
          });
          render();
        };

        if (!load) { if (AO.market.has()) run(); else render(); return; }

        RUNNING = true;
        el.scan.classList.add('loading'); el.scan.disabled = true;
        el.progress.textContent = 'Lade Preise…';
        AO.market.load(idsForScan(), [1], function (done, total) {
          el.progress.textContent = 'Lade Preise… ' + done + ' / ' + total;
        }).then(function () {
          el.progress.textContent = '';
          U.toast('Preise geladen', 'ok');
        }).catch(function (err) {
          el.progress.textContent = '';
          U.toast('Laden fehlgeschlagen: ' + (err.name === 'AbortError' ? 'Zeitüberschreitung' : err.message), 'err');
        }).then(function () {
          RUNNING = false;
          el.scan.classList.remove('loading'); el.scan.disabled = false;
          run();
        });
      }

      function render() {
        el.chips.innerHTML =
          '<span class="chip">Rückgabe <b>' + F.pct(rate() * 100) + '</b></span>' +
          '<span class="chip">Steuer <b>' + (AO.settings.premium ? '4 %' : '8 %') + '</b>' +
            (AO.settings.sellMethod === 'order' ? ' + Order 2,5 %' : ' (Sofortverkauf)') + '</span>' +
          '<span class="chip">Kauf <b>' + (AO.settings.buyMethod === 'order' ? 'Order +2,5 %' : 'Sofort') + '</b></span>' +
          '<span class="chip">Gebühr <b>' + F.s(S.fee) + '</b> /100 NW</span>';

        if (!RESULT) {
          el.rows.innerHTML = '<tr><td colspan="7" class="t-empty">' +
            (AO.market.has()
              ? 'Noch nicht gesucht – links auf „Preise laden und suchen“.'
              : 'Noch keine Marktdaten. Links auf „Preise laden und suchen“.') + '</td></tr>';
          el.stats.innerHTML = ''; el.notice.innerHTML = '';
          return;
        }

        var list = RESULT.filter(function (x) { return x.margin >= (S.minMargin || 0); });
        list.sort(function (a, b) {
          return S.sort === 'profit' ? b.profit - a.profit : b.margin - a.margin;
        });

        var geprueft = RESULT.length + SKIPPED;
        el.notice.innerHTML = SKIPPED
          ? '<div class="notice info" style="margin-bottom:var(--s4)"><b>' + SKIPPED + '</b> von ' + geprueft +
            ' Möglichkeiten ausgelassen – dort fehlt mindestens ein Preis oder die Daten sind älter als ' +
            (S.maxAge === '0' ? 'erlaubt' : S.maxAge + ' Stunden') + '. Sie erscheinen bewusst nicht, ' +
            'weil eine Rechnung mit Lücken keine Chance ist.</div>'
          : '';

        var best = list[0];
        el.stats.innerHTML =
          U.stat('Gefundene Chancen', F.s(list.length), 'von ' + geprueft + ' geprüft') +
          U.stat('Beste Marge', best ? F.pct(best.margin) : '—',
                 best ? best.it.n : 'nichts im Filter', best && best.margin > 0 ? 'pos' : '') +
          U.stat('Bester Gewinn / Stück', best ? F.sg(best.perItem) : '—',
                 best ? 'bei ' + F.esc(F.ort(best.sellCity)) : '', best && best.perItem > 0 ? 'pos' : '') +
          U.stat('Gewinn gesamt', best ? F.sg(best.profit) : '—',
                 'für ' + F.q(S.crafts) + ' Crafts', best && best.profit > 0 ? 'pos' : '');

        if (!list.length) {
          el.rows.innerHTML = '<tr><td colspan="7" class="t-empty">Nichts gefunden, das die Filter erfüllt.</td></tr>';
          return;
        }

        el.rows.innerHTML = list.slice(0, 60).map(function (x) {
          var kaufOrte = {};
          x.mats.forEach(function (m) { kaufOrte[m.city] = 1; });
          var orte = Object.keys(kaufOrte);
          var weg = orte.map(function (o) { return F.esc(F.ort(o)); }).join(' + ') +
            ' <span class="mut">→</span> ' +
            (x.bonusCity ? '<b>' + F.esc(x.bonusCity) + '</b>' : '<span class="mut">Station</span>') +
            ' <span class="mut">→</span> <b>' + F.esc(F.ort(x.sellCity)) + '</b>';

          return '<tr class="hover" data-key="' + F.esc(x.key) + '" style="cursor:pointer">' +
            '<td><div class="itemcell">' + F.img(x.prodId, 56, x.it.n) +
              '<div class="nm"><b>' + F.tier(x.it.t, x.ench) + ' ' + F.esc(x.it.n) + '</b>' +
              '<span>' + F.esc(x.prodId) + '</span></div></div></td>' +
            '<td style="text-align:left;white-space:normal;font-size:12.5px">' + weg + '</td>' +
            '<td>' + F.s(x.costPer) + '</td>' +
            '<td>' + F.s(x.sellPrice) + '</td>' +
            '<td class="' + (x.perItem >= 0 ? 'pos' : 'neg') + '"><b>' + F.sg(x.perItem) + '</b></td>' +
            '<td class="' + (x.margin >= 0 ? 'pos' : 'neg') + '">' + F.pct(x.margin) + '</td>' +
            '<td class="' + (x.profit >= 0 ? 'pos' : 'neg') + '">' + F.sg(x.profit) + '</td></tr>' +
            '<tr class="detail" data-for="' + F.esc(x.key) + '" hidden><td colspan="7" style="background:var(--bg2)">' +
              '<div style="padding:var(--s3) 0"><b>Einkauf</b>' +
              x.mats.map(function (m) {
                return '<div class="dl"><span>' + F.q(m.count) + '× ' + F.esc(m.name) +
                  ' <span class="mut">in ' + F.esc(F.ort(m.city)) + '</span></span><span>' +
                  F.s(m.price) + ' je Stück</span></div>';
              }).join('') +
              '<div class="dl total"><span>Verkauf in ' + F.esc(F.ort(x.sellCity)) +
              (AO.settings.sellMethod === 'order' ? ' (Verkaufsorder)' : ' (Sofortverkauf)') +
              '</span><span>' + F.s(x.sellPrice) + ' je Stück</span></div>' +
              '</div></td></tr>';
        }).join('');
      }
    }
  };
})();
