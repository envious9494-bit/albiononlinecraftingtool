/* Gewinn-Rechner: lohnt sich Kaufen und Weiterverkaufen?
   Rechnet Steuer, Order-Gebühren und Break-even mit. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui, C = AO.data.consts;

  var S = AO.store.bind('profit', {
    buy: 1000, sell: 1400, qty: 100,
    buyMethod: 'instant', sellMethod: 'order', premium: true
  });

  AO.views.profit = {
    id: 'profit',
    title: 'Gewinn-Rechner',
    subtitle: 'Einkauf, Verkauf, Steuern und Gebühren in einer Rechnung',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Handel</h4>' +
            '<div class="field"><span class="lbl w">Einkauf</span><input class="num" data-x="buy" inputmode="numeric"><span class="mut">je Stück</span></div>' +
            '<div class="field"><span class="lbl w">Verkauf</span><input class="num" data-x="sell" inputmode="numeric"><span class="mut">je Stück</span></div>' +
            '<div class="field"><span class="lbl w">Menge</span><input class="num" data-x="qty" inputmode="numeric"><span class="mut">Stück</span></div>' +
          '</div>' +
          '<div class="fieldset"><h4>Gebühren</h4>' +
            '<div class="field stack"><label>Einkauf über</label>' +
              U.seg([{ v: 'instant', n: 'Sofortkauf' }, { v: 'order', n: 'Kauforder +2,5 %' }], S.buyMethod) + '</div>' +
            '<div class="field stack"><label>Verkauf über</label>' +
              U.seg([{ v: 'order', n: 'Verkaufsorder +2,5 %' }, { v: 'instant', n: 'Sofortverkauf' }], S.sellMethod) + '</div>' +
            '<label class="field check"><input type="checkbox" data-x="premium"> Premium <span class="mut">(4 % statt 8 %)</span></label>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
          '<div class="grid cols-2">' +
            '<div class="card"><div class="card-head"><h3>Aufstellung</h3></div>' +
              '<div class="card-body" data-x="detail"></div></div>' +
            '<div class="card"><div class="card-head"><h3>Schwellen</h3></div>' +
              '<div class="card-body" data-x="thresh"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });
      var segs = U.qa('.seg', root);

      el.buy.value = S.buy; el.sell.value = S.sell; el.qty.value = S.qty;
      el.premium.checked = S.premium;

      ['buy', 'sell', 'qty'].forEach(function (k) {
        el[k].addEventListener('input', function () {
          var v = F.parse(el[k].value); S[k] = v === null ? 0 : v; S.$save(); render();
        });
      });
      el.premium.addEventListener('change', function () { S.premium = el.premium.checked; S.$save(); render(); });
      segs[0].addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.buyMethod = b.dataset.v; S.$save(); U.segSet(segs[0], b.dataset.v); render();
      });
      segs[1].addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.sellMethod = b.dataset.v; S.$save(); U.segSet(segs[1], b.dataset.v); render();
      });

      render();

      function render() {
        var tax = S.premium ? C.taxPremium : C.taxNormal;
        var buyFee = S.buyMethod === 'order' ? C.orderFee : 0;
        var sellFee = S.sellMethod === 'order' ? C.orderFee : 0;

        var cost = S.buy * S.qty * (1 + buyFee);
        var gross = S.sell * S.qty;
        var taxAmt = gross * tax;
        var feeAmt = gross * sellFee;
        var net = gross - taxAmt - feeAmt;
        var profit = net - cost;
        var margin = cost ? profit / cost * 100 : NaN;

        /* Break-even: Verkaufspreis, bei dem der Gewinn null ist */
        var breakEven = S.buy * (1 + buyFee) / (1 - tax - sellFee);
        /* Höchster Einkaufspreis, der beim aktuellen Verkaufspreis noch trägt */
        var maxBuy = S.sell * (1 - tax - sellFee) / (1 + buyFee);

        el.stats.innerHTML =
          U.stat('Gesamtgewinn', F.sg(profit), F.q(S.qty) + ' Stück', profit >= 0 ? 'pos' : 'neg') +
          U.stat('Gewinn / Stück', F.sg(S.qty ? profit / S.qty : NaN), 'nach allen Abzügen', profit >= 0 ? 'pos' : 'neg') +
          U.stat('Marge', F.pct(margin), 'Gewinn ÷ Einsatz', margin >= 0 ? 'pos' : 'neg') +
          U.stat('Einsatz', F.s(cost), 'gebundenes Silber');

        el.detail.innerHTML =
          line('Einkauf (' + F.q(S.qty) + ' × ' + F.s(S.buy) + ')', F.s(S.buy * S.qty)) +
          line(buyFee ? 'Kauforder-Gebühr (2,5 %)' : 'Kauforder-Gebühr – entfällt bei Sofortkauf',
               buyFee ? F.s(S.buy * S.qty * buyFee) : '0', !buyFee) +
          line('<b>Einsatz gesamt</b>', '<b>' + F.s(cost) + '</b>', false, true) +
          '<div style="height:var(--s4)"></div>' +
          line('Verkauf (' + F.q(S.qty) + ' × ' + F.s(S.sell) + ')', F.s(gross)) +
          line('Verkaufssteuer (' + (S.premium ? '4' : '8') + ' %)', '−' + F.s(taxAmt)) +
          line(sellFee ? 'Verkaufsorder-Gebühr (2,5 %)' : 'Verkaufsorder-Gebühr – entfällt bei Sofortverkauf',
               sellFee ? '−' + F.s(feeAmt) : '0', !sellFee) +
          line('<b>Netto-Erlös</b>', '<b>' + F.s(net) + '</b>', false, true);

        el.thresh.innerHTML =
          '<div class="dl"><span>Break-even Verkaufspreis</span><span><b>' + F.s(breakEven) + '</b></span></div>' +
          '<div class="hint">Darunter machst du beim aktuellen Einkaufspreis Verlust.</div>' +
          '<div class="dl" style="margin-top:var(--s4)"><span>Höchster Einkaufspreis</span><span><b>' + F.s(maxBuy) + '</b></span></div>' +
          '<div class="hint">Mehr darfst du beim aktuellen Verkaufspreis nicht zahlen.</div>' +
          '<div class="dl" style="margin-top:var(--s4)"><span>Abzüge gesamt</span><span>' +
            F.pct((tax + sellFee) * 100) + ' vom Verkauf' + (buyFee ? ' + 2,5 % beim Kauf' : '') + '</span></div>';
      }

      function line(l, v, dim, total) {
        return '<div class="dl' + (total ? ' total' : '') + '"' + (dim ? ' style="opacity:.55"' : '') + '>' +
          '<span>' + l + '</span><span>' + v + '</span></div>';
      }
    }
  };
})();
