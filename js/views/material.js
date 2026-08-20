/* Materialkosten: Einkaufsliste zusammenstellen und Städte vergleichen. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  var S = AO.store.bind('material', { list: [], city: 'Caerleon', method: 'instant' });

  AO.views.material = {
    id: 'material',
    title: 'Materialkosten',
    subtitle: 'Einkaufsliste mit Preisen und Städtevergleich',

    html: function () {
      return '' +
      '<div class="view-toolbar">' +
        '<div class="picker" style="flex:1;max-width:420px">' +
          '<input data-x="search" placeholder="Material suchen und hinzufügen…" autocomplete="off" spellcheck="false" style="width:100%">' +
          '<div class="picker-list" data-x="list" hidden></div>' +
        '</div>' +
        '<label class="mut">Stadt <select data-x="city"></select></label>' +
        U.seg([{ v: 'instant', n: 'Sofortkauf' }, { v: 'order', n: 'Kauforder' }], S.method) +
        '<button class="btn primary" data-x="load"><span class="spin">⟳</span> Preise laden</button>' +
        '<button class="btn sm ghost" data-x="clear">Liste leeren</button>' +
      '</div>' +
      '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
      '<div class="card">' +
        '<div class="card-head"><h3>Einkaufsliste</h3>' +
          '<div class="right"><span class="mut" data-x="stamp"></span></div></div>' +
        '<div class="tablewrap" style="border:none">' +
          '<table class="data"><thead><tr>' +
            '<th>Material</th><th>Menge</th><th>Preis</th><th>Kosten</th>' +
            '<th title="Stadt mit dem günstigsten Preis">günstigste Stadt</th><th></th>' +
          '</tr></thead><tbody data-x="rows"></tbody>' +
          '<tfoot><tr><td colspan="3">Summe</td><td data-x="total">—</td>' +
            '<td data-x="totalBest">—</td><td></td></tr></tfoot>' +
        '</table></div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });
      var seg = U.q('.seg', root);

      var MATS = Object.keys(AO.data.materials)
        .filter(function (k) { return AO.data.materials[k].n; })
        .sort(function (a, b) { return AO.data.materials[a].n.localeCompare(AO.data.materials[b].n, 'de'); });

      U.fill(el.city, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.city);

      el.search.addEventListener('input', U.debounce(showList, 120));
      el.search.addEventListener('focus', showList);
      document.addEventListener('click', function (e) {
        if (!el.search.parentElement.contains(e.target)) el.list.hidden = true;
      });
      el.list.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-id]'); if (!b) return;
        if (!S.list.some(function (r) { return r.id === b.dataset.id; })) {
          S.list.push({ id: b.dataset.id, qty: 100 });
          S.$save();
        }
        el.search.value = ''; el.list.hidden = true;
        render();
      });
      el.city.addEventListener('change', function () { S.city = el.city.value; S.$save(); render(); });
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.method = b.dataset.v; S.$save(); U.segSet(seg, b.dataset.v); render();
      });
      el.clear.addEventListener('click', function () { S.list = []; S.$save(); render(); });
      el.load.addEventListener('click', function () {
        if (!S.list.length) return U.toast('Die Liste ist leer');
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(S.list.map(function (r) { return r.id; }), [1])
          .then(function () { U.toast('Preise aktualisiert', 'ok'); })
          .catch(function (e) { U.toast('Laden fehlgeschlagen: ' + e.message, 'err'); })
          .then(function () { el.load.classList.remove('loading'); el.load.disabled = false; render(); });
      });

      root.addEventListener('input', function (e) {
        var q = e.target.closest('[data-qty]');
        if (q) {
          var row = S.list.filter(function (r) { return r.id === q.dataset.qty; })[0];
          if (row) { row.qty = F.parse(q.value) || 0; S.$save(); renderTotals(); }
          return;
        }
        var p = e.target.closest('.pinput');
        if (p) {
          AO.market.setOwn(p.dataset.id, p.dataset.city, 1, p.dataset.side, F.parse(p.value));
          renderTotals();
        }
      });
      root.addEventListener('click', function (e) {
        var d = e.target.closest('[data-del]');
        if (d) {
          S.list = S.list.filter(function (r) { return r.id !== d.dataset.del; });
          S.$save(); render();
        }
      });
      document.addEventListener('ao:server', function () { if (document.contains(root)) render(); });
      U.onPrices(root, render);

      render();

      function side() { return S.method === 'instant' ? 'sell' : 'buy'; }

      function showList() {
        var term = el.search.value.trim().toLowerCase();
        var hits = MATS.filter(function (k) {
          var m = AO.data.materials[k];
          return !term || m.n.toLowerCase().indexOf(term) >= 0 || k.toLowerCase().indexOf(term) >= 0;
        }).slice(0, 60);
        el.list.innerHTML = hits.length ? hits.map(function (k) {
          var m = AO.data.materials[k];
          return '<button data-id="' + F.esc(k) + '">' + F.img(k, 56, m.n) +
            '<span class="nm">' + F.esc(m.n) + '</span><span class="meta">' + F.esc(k) + '</span></button>';
        }).join('') : '<div class="t-empty">Nichts gefunden</div>';
        el.list.hidden = false;
      }

      function render() {
        el.stamp.textContent = AO.market.has() ? 'Marktdaten: ' + F.time(AO.market.stamp()) + ' Uhr' : 'Noch nichts geladen';
        if (!S.list.length) {
          el.rows.innerHTML = '<tr><td colspan="6" class="t-empty">Noch nichts auf der Liste – oben suchen und hinzufügen.</td></tr>';
        } else {
          el.rows.innerHTML = S.list.map(function (r) {
            var m = AO.data.materials[r.id] || { n: r.id };
            /* Materialien kauft man in Staedten - der Schwarzmarkt handelt
               keine Rohstoffe. */
            var best = AO.market.best(r.id, 1, side(), 'min', AO.data.cities);
            return '<tr class="hover"><td><div class="itemcell">' + F.img(r.id, 56, m.n) +
              '<div class="nm"><b>' + F.esc(m.n) + '</b><span>' + F.esc(r.id) + '</span></div></div></td>' +
              '<td><input class="num pinput" data-qty="' + F.esc(r.id) + '" value="' + F.q(r.qty) + '" inputmode="numeric"></td>' +
              '<td><span class="pwrap">' + U.dot(AO.market.date(r.id, S.city, 1, side()), S.city) +
                '<input class="pinput' + (AO.market.isOwn(r.id, S.city, 1, side()) ? ' own' : '') +
                '" data-id="' + F.esc(r.id) + '" data-city="' + F.esc(S.city) + '" data-side="' + side() +
                '" inputmode="numeric" value="' + priceStr(r.id) + '" placeholder="—"></span></td>' +
              '<td data-c="' + F.esc(r.id) + '">—</td>' +
              '<td class="mut">' + (best ? F.esc(best.city) + ' · ' + F.s(best.v) : '—') + '</td>' +
              '<td><button class="btn sm ghost" data-del="' + F.esc(r.id) + '" title="Entfernen">✕</button></td></tr>';
          }).join('');
        }
        renderTotals();
      }

      function priceStr(id) {
        var v = AO.market.get(id, S.city, 1, side());
        return (v === null || v === undefined) ? '' : F.s(v);
      }

      function renderTotals() {
        /* Kauforder kostet 2,5 % Einstellgebuehr - wie in allen anderen
           Ansichten auch. */
        var feeMult = S.method === 'order' ? 1 + AO.data.consts.orderFee : 1;
        var total = 0, totalBest = 0, unknown = 0;
        S.list.forEach(function (r) {
          var p = AO.market.get(r.id, S.city, 1, side());
          if (p === null || p === undefined) unknown++;
          var c = (p || 0) * r.qty;
          total += c;
          var b = AO.market.best(r.id, 1, side(), 'min', AO.data.cities);
          totalBest += ((b ? b.v : p) || 0) * r.qty;
          var cell = el.rows.querySelector('[data-c="' + r.id + '"]');
          if (cell) cell.textContent = F.s(c);
        });
        total *= feeMult;
        totalBest *= feeMult;
        el.total.textContent = F.s(total);
        el.totalBest.textContent = F.s(totalBest);

        el.stats.innerHTML =
          U.stat('Positionen', F.s(S.list.length), unknown ? unknown + ' ohne Preis' : 'alle mit Preis') +
          U.stat('Kosten in ' + S.city, F.s(total),
                 S.method === 'instant' ? 'Sofortkauf' : 'Kauforder inkl. 2,5 %') +
          U.stat('Beste Städte gemischt', F.s(totalBest), 'je Material günstigste Stadt') +
          U.stat('Ersparnis', F.s(total - totalBest), 'durch Reisen', (total - totalBest) > 0 ? 'pos' : '');
      }
    }
  };
})();
