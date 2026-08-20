/* Ressourcenwert: Item-Werte, Nährwert und Nutzungsgebühr je Stufe.
   Alle Werte stammen aus den offiziellen Spieldaten. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui, C = AO.data.consts;

  var KINDS = [
    { base: 'PLANKS',     n: 'Bretter',     raw: 'WOOD' },
    { base: 'METALBAR',   n: 'Metallbarren', raw: 'ORE' },
    { base: 'CLOTH',      n: 'Stoff',       raw: 'FIBER' },
    { base: 'LEATHER',    n: 'Leder',       raw: 'HIDE' },
    { base: 'STONEBLOCK', n: 'Steinblöcke', raw: 'ROCK' }
  ];

  var S = AO.store.bind('resource', { kind: 'METALBAR', ench: 0, fee: 800, city: 'Caerleon' });

  AO.views.resource = {
    id: 'resource',
    title: 'Ressourcenwert',
    subtitle: 'Item-Werte, Nährwert und Nutzungsgebühren aus den Spieldaten',

    html: function () {
      return '' +
      '<div class="view-toolbar">' +
        '<label class="mut">Ressource <select data-x="kind"></select></label>' +
        '<label class="mut">Verzauberung ' +
          U.seg([0, 1, 2, 3, 4].map(function (e) { return { v: String(e), n: e ? '.' + e : 'Normal' }; }), String(S.ench)) +
        '</label>' +
        '<label class="mut">Stationsgebühr <input class="num" data-x="fee" inputmode="numeric" style="width:90px"></label>' +
        '<label class="mut">Stadt <select data-x="city"></select></label>' +
        '<button class="btn primary" data-x="load"><span class="spin">⟳</span> Preise laden</button>' +
      '</div>' +
      '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
      '<div class="card">' +
        '<div class="card-head"><h3>Werte je Stufe</h3>' +
          '<div class="right"><span class="mut">Item-Wert = 2<sup>Tier + Verzauberung</sup></span></div></div>' +
        '<div class="tablewrap" style="border:none">' +
          '<table class="data"><thead><tr>' +
            '<th>Stufe</th><th title="Aus den Spieldaten">Item-Wert</th>' +
            '<th title="Item-Wert × 0,1125">Nährwert</th>' +
            '<th title="Nährwert × Stationsgebühr ÷ 100">Gebühr je Craft</th>' +
            '<th>Marktpreis</th><th title="Gebühr im Verhältnis zum Marktpreis">Gebührenanteil</th>' +
          '</tr></thead><tbody data-x="rows"></tbody></table></div>' +
      '</div>' +
      '<p class="view-footnote">Der Item-Wert bestimmt die Nutzungsgebühr jeder Station. ' +
      'Für craftbare Gegenstände ergibt er sich als Summe der Zutatenwerte – nachgerechnet z.&nbsp;B. beim ' +
      'T4-Metallbarren: 2× T4-Erz (4) + 1× T3-Barren (8) = 16.</p>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });
      var seg = U.q('.seg', root);

      U.fill(el.kind, KINDS.map(function (k) { return { v: k.base, n: k.n }; }), S.kind);
      U.fill(el.city, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.city);
      el.fee.value = S.fee;

      el.kind.addEventListener('change', function () { S.kind = el.kind.value; S.$save(); render(); });
      el.city.addEventListener('change', function () { S.city = el.city.value; S.$save(); render(); });
      el.fee.addEventListener('input', function () {
        var v = F.parse(el.fee.value); S.fee = v === null ? 0 : v; S.$save(); render();
      });
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.ench = +b.dataset.v; S.$save(); U.segSet(seg, b.dataset.v); render();
      });
      el.load.addEventListener('click', function () {
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(ids(), [1])
          .then(function () { U.toast('Preise aktualisiert', 'ok'); })
          .catch(function (e) { U.toast('Laden fehlgeschlagen: ' + e.message, 'err'); })
          .then(function () { el.load.classList.remove('loading'); el.load.disabled = false; render(); });
      });
      root.addEventListener('input', function (e) {
        var p = e.target.closest('.pinput'); if (!p) return;
        AO.market.setOwn(p.dataset.id, p.dataset.city, 1, 'sell', F.parse(p.value));
        p.classList.toggle('own', AO.market.isOwn(p.dataset.id, p.dataset.city, 1, 'sell'));
        /* Nur die abhaengigen Zahlen auffrischen - ein voller Aufbau wuerde das
           Eingabefeld ersetzen und den Tastaturfokus verlieren. */
        recalcShares();
      });
      document.addEventListener('ao:server', function () { if (document.contains(root)) render(); });
      U.onPrices(root, render);

      render();

      function noEnch() { return S.kind === 'STONEBLOCK'; }

      function idOf(t) {
        var e = noEnch() ? 0 : S.ench;
        return 'T' + t + '_' + S.kind + (e > 0 && t >= 4 ? '_LEVEL' + e : '');
      }

      function ids() {
        var out = [];
        for (var t = 2; t <= 8; t++) out.push(idOf(t));
        return out;
      }

      /* Gebuehrenanteil je Zeile neu berechnen, ohne die Tabelle neu zu bauen */
      function recalcShares() {
        U.qa('tbody[data-x="rows"] tr', root).forEach(function (tr) {
          var inp = tr.querySelector('.pinput');
          if (!inp) return;
          var id = inp.dataset.id;
          var e = (noEnch() || +id.charAt(1) < 4) ? 0 : S.ench;
          var m = AO.data.materials[id];
          var iv = m && m.iv ? m.iv : Math.pow(2, (+id.charAt(1)) + e);
          var fee = iv * C.nutritionFactor * S.fee / 100;
          var price = AO.market.get(id, S.city, 1, 'sell');
          var share = price ? fee / price * 100 : NaN;
          var cell = tr.querySelectorAll('td')[5];
          if (cell) {
            cell.textContent = F.pct(share);
            cell.className = share > 20 ? 'neg' : share > 8 ? 'warn' : 'mut';
          }
        });
      }

      function render() {
        U.qa('button', seg).forEach(function (b) {
          b.disabled = noEnch() && b.dataset.v !== '0';
          if (b.disabled) b.title = 'Stein hat keine Verzauberungen';
        });
        if (noEnch() && S.ench) { S.ench = 0; U.segSet(seg, '0'); }

        var rows = [], sumFee = 0, n = 0;
        for (var t = 2; t <= 8; t++) {
          var e = (noEnch() || t < 4) ? 0 : S.ench;
          var id = idOf(t);
          var m = AO.data.materials[id];
          var iv = m && m.iv ? m.iv : Math.pow(2, t + e);
          var nut = iv * C.nutritionFactor;
          var fee = nut * S.fee / 100;
          var price = AO.market.get(id, S.city, 1, 'sell');
          var share = (price ? fee / price * 100 : NaN);
          sumFee += fee; n++;
          rows.push('<tr class="hover"><td><div class="itemcell">' + F.img(id, 56, id) +
            '<div class="nm"><b>' + F.tier(t, e) + ' ' + F.esc((m && m.n) || id) + '</b>' +
            '<span>' + F.esc(id) + '</span></div></div></td>' +
            '<td><b>' + F.n2(iv) + '</b></td>' +
            '<td>' + F.n2(nut) + '</td>' +
            '<td>' + F.n2(fee) + '</td>' +
            '<td><span class="pwrap">' + U.dot(AO.market.date(id, S.city, 1, 'sell'), S.city) +
              '<input class="pinput' + (AO.market.isOwn(id, S.city, 1, 'sell') ? ' own' : '') +
              '" data-id="' + F.esc(id) + '" data-city="' + F.esc(S.city) + '" inputmode="numeric" value="' +
              (price === null || price === undefined ? '' : F.s(price)) + '" placeholder="—"></span></td>' +
            '<td class="' + (share > 20 ? 'neg' : share > 8 ? 'warn' : 'mut') + '">' + F.pct(share) + '</td></tr>');
        }
        el.rows.innerHTML = rows.join('');

        recalcShares();
        var t8 = Math.pow(2, 8 + (noEnch() ? 0 : S.ench));
        el.stats.innerHTML =
          U.stat('Item-Wert T8', F.n2(t8), 'höchste Stufe') +
          U.stat('Gebühr T8 / Craft', F.n2(t8 * C.nutritionFactor * S.fee / 100), 'bei ' + F.s(S.fee) + ' /100 NW') +
          U.stat('Gebühr T2–T8 zusammen', F.n2(sumFee), 'je ein Craft pro Stufe') +
          U.stat('Nährwert-Faktor', '0,1125', 'je Punkt Item-Wert');
      }
    }
  };
})();
