/* Steuer-Rechner: was bleibt vom Verkauf übrig – und in beide Richtungen. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui, C = AO.data.consts;

  var S = AO.store.bind('tax', { price: 10000, qty: 1, premium: true, method: 'order', target: 10000 });

  AO.views.tax = {
    id: 'tax',
    title: 'Steuer-Rechner',
    subtitle: 'Verkaufssteuer, Order-Gebühr und Netto-Erlös',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Verkauf</h4>' +
            '<div class="field"><span class="lbl w">Preis</span><input class="num" data-x="price" inputmode="numeric"><span class="mut">je Stück</span></div>' +
            '<div class="field"><span class="lbl w">Menge</span><input class="num" data-x="qty" inputmode="numeric"><span class="mut">Stück</span></div>' +
            '<div class="field stack"><label>Verkauf über</label>' +
              U.seg([{ v: 'order', n: 'Verkaufsorder +2,5 %' }, { v: 'instant', n: 'Sofortverkauf' }], S.method) + '</div>' +
            '<label class="field check"><input type="checkbox" data-x="premium"> Premium</label>' +
          '</div>' +
          '<div class="fieldset"><h4>Rückwärts</h4>' +
            '<div class="field"><span class="lbl w">Ziel netto</span><input class="num" data-x="target" inputmode="numeric"></div>' +
            '<div class="hint">Welchen Preis muss ich verlangen, damit unterm Strich dieser Betrag ankommt?</div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
          '<div class="grid cols-2">' +
            '<div class="card"><div class="card-head"><h3>Aufstellung</h3></div>' +
              '<div class="card-body" data-x="detail"></div></div>' +
            '<div class="card"><div class="card-head"><h3>Vergleich</h3>' +
              '<div class="right"><span class="mut">alle vier Kombinationen</span></div></div>' +
              '<div class="tablewrap" style="border:none">' +
                '<table class="data"><thead><tr><th>Variante</th><th>Abzug</th><th>Netto</th></tr></thead>' +
                '<tbody data-x="cmp"></tbody></table></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });
      var seg = U.q('.seg', root);

      el.price.value = S.price; el.qty.value = S.qty; el.target.value = S.target;
      el.premium.checked = S.premium;

      ['price', 'qty', 'target'].forEach(function (k) {
        el[k].addEventListener('input', function () {
          var v = F.parse(el[k].value); S[k] = v === null ? 0 : v; S.$save(); render();
        });
      });
      el.premium.addEventListener('change', function () { S.premium = el.premium.checked; S.$save(); render(); });
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.method = b.dataset.v; S.$save(); U.segSet(seg, b.dataset.v); render();
      });

      render();

      function net(price, qty, premium, method) {
        var gross = price * qty;
        var tax = gross * (premium ? C.taxPremium : C.taxNormal);
        var fee = method === 'order' ? gross * C.orderFee : 0;
        return { gross: gross, tax: tax, fee: fee, net: gross - tax - fee };
      }

      function render() {
        var d = net(S.price, S.qty, S.premium, S.method);
        var rate = (S.premium ? C.taxPremium : C.taxNormal) + (S.method === 'order' ? C.orderFee : 0);
        var needed = rate < 1 ? S.target / (1 - rate) : NaN;

        el.stats.innerHTML =
          U.stat('Netto-Erlös', F.s(d.net), F.q(S.qty) + ' × ' + F.s(S.price)) +
          U.stat('Abzüge gesamt', F.s(d.tax + d.fee), F.pct(rate * 100) + ' vom Umsatz', 'neg') +
          U.stat('Netto je Stück', F.s(S.qty ? d.net / S.qty : NaN), 'nach Steuer und Gebühr') +
          U.stat('Für ' + F.sk(S.target) + ' netto', F.s(needed), 'musst du verlangen');

        el.detail.innerHTML =
          '<div class="dl"><span>Umsatz</span><span>' + F.s(d.gross) + '</span></div>' +
          '<div class="dl"><span>Verkaufssteuer (' + (S.premium ? '4' : '8') + ' %)</span><span>−' + F.s(d.tax) + '</span></div>' +
          '<div class="dl"' + (d.fee ? '' : ' style="opacity:.55"') + '><span>' +
            (d.fee ? 'Verkaufsorder-Gebühr (2,5 %)' : 'Order-Gebühr – entfällt bei Sofortverkauf') +
            '</span><span>' + (d.fee ? '−' + F.s(d.fee) : '0') + '</span></div>' +
          '<div class="dl total"><span>Netto-Erlös</span><span>' + F.s(d.net) + '</span></div>';

        var combos = [
          { p: true,  m: 'order',   n: 'Premium · Verkaufsorder' },
          { p: true,  m: 'instant', n: 'Premium · Sofortverkauf' },
          { p: false, m: 'order',   n: 'Ohne Premium · Verkaufsorder' },
          { p: false, m: 'instant', n: 'Ohne Premium · Sofortverkauf' }
        ];
        el.cmp.innerHTML = combos.map(function (c) {
          var x = net(S.price, S.qty, c.p, c.m);
          var cur = (c.p === S.premium && c.m === S.method);
          return '<tr class="hover"' + (cur ? ' style="background:var(--goldDim)"' : '') + '>' +
            '<td>' + (cur ? '<b>' + c.n + '</b>' : c.n) + '</td>' +
            '<td class="neg">−' + F.s(x.tax + x.fee) + '</td>' +
            '<td><b>' + F.s(x.net) + '</b></td></tr>';
        }).join('');
      }
    }
  };
})();
