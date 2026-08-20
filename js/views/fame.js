/* Fame-Rechner: Handwerks-Fame je Gegenstand.

   Ehrlicher Hinweis zur Datenlage: Item-Wert, Nährwert und Fokuskosten stehen
   in den offiziellen Spieldaten und werden hier exakt daraus berechnet. Der
   Umrechnungsfaktor "Fame je Nährwertpunkt" steht dort NICHT - deshalb ist er
   hier einstellbar und lässt sich in Sekunden am Handwerksfenster kalibrieren:
   einmal die angezeigte Fame eines Crafts eintragen, der Faktor wird daraus
   berechnet und gilt dann für alle Gegenstände. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui, C = AO.data.consts;

  var S = AO.store.bind('fame', {
    item: 'T4_MAIN_SWORD', ench: 0, crafts: 100,
    factor: 1, premium: true, calib: ''
  });

  function all() { return AO.data.items.concat(AO.data.consumables); }
  function find(id) { return all().filter(function (i) { return i.id === id; })[0] || null; }

  AO.views.fame = {
    id: 'fame',
    title: 'Fame-Rechner',
    subtitle: 'Handwerks-Fame je Gegenstand – kalibrierbar am Spiel',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Gegenstand</h4>' +
            '<div class="picker"><input data-x="search" placeholder="suchen…" autocomplete="off" spellcheck="false" style="width:100%">' +
              '<div class="picker-list" data-x="list" hidden></div></div>' +
            '<div class="hint" data-x="chosen"></div>' +
            '<div class="field stack" style="margin-top:var(--s3)"><label>Verzauberung</label><div data-x="enchSeg"></div></div>' +
            '<div class="field"><span class="lbl w">Crafts</span><input class="num" data-x="crafts" inputmode="numeric"></div>' +
            '<label class="field check"><input type="checkbox" data-x="premium"> Premium <span class="mut">(+50 % Fame)</span></label>' +
          '</div>' +
          '<div class="fieldset"><h4>Kalibrierung</h4>' +
            '<div class="field"><span class="lbl w">Faktor</span><input class="num" data-x="factor" inputmode="decimal">' +
              '<span class="mut">Fame/NW</span></div>' +
            '<div class="field"><span class="lbl w">oder</span><input class="num" data-x="calib" inputmode="numeric" placeholder="Fame laut Spiel"></div>' +
            '<div class="hint">Öffne im Spiel das Handwerksfenster für diesen Gegenstand, trage die dort ' +
              'angezeigte Fame für <b>einen</b> Craft ein – der Faktor wird daraus berechnet und gilt danach ' +
              'für alle Gegenstände. Er wird gespeichert.</div>' +
            '<button class="btn sm" data-x="apply" style="margin-top:var(--s2)">Faktor übernehmen</button>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
          '<div class="card" style="margin-bottom:var(--s4)">' +
            '<div class="card-head"><h3>Grundlage aus den Spieldaten</h3></div>' +
            '<div class="card-body" data-x="basis"></div></div>' +
          '<div class="card"><div class="card-head"><h3>Fame je Stufe</h3>' +
            '<div class="right"><span class="mut">gleiche Familie, alle Tiers</span></div></div>' +
            '<div class="tablewrap" style="border:none">' +
              '<table class="data"><thead><tr><th>Stufe</th><th>Item-Wert</th><th>Nährwert</th>' +
              '<th>Fame je Craft</th><th>Fame gesamt</th></tr></thead><tbody data-x="rows"></tbody></table></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      el.crafts.value = S.crafts;
      el.factor.value = String(S.factor).replace('.', ',');
      el.premium.checked = S.premium;

      el.search.addEventListener('input', U.debounce(showList, 120));
      el.search.addEventListener('focus', showList);
      document.addEventListener('click', function (e) {
        if (!el.search.parentElement.contains(e.target)) el.list.hidden = true;
      });
      el.list.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-id]'); if (!b) return;
        S.item = b.dataset.id; S.ench = 0; S.$save();
        el.search.value = ''; el.list.hidden = true;
        syncEnch(); render();
      });
      el.enchSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b || b.disabled) return;
        S.ench = +b.dataset.v; S.$save(); U.segSet(el.enchSeg.firstChild, b.dataset.v); render();
      });
      el.crafts.addEventListener('input', function () {
        var v = F.parse(el.crafts.value); S.crafts = v === null ? 0 : v; S.$save(); render();
      });
      el.factor.addEventListener('input', function () {
        var v = parseFloat(el.factor.value.replace(',', '.'));
        S.factor = isFinite(v) && v > 0 ? v : 0; S.$save(); render();
      });
      el.premium.addEventListener('change', function () { S.premium = el.premium.checked; S.$save(); render(); });
      el.apply.addEventListener('click', function () {
        var fame = F.parse(el.calib.value);
        var it = find(S.item);
        if (!fame || !it) return U.toast('Bitte die im Spiel angezeigte Fame eintragen', 'err');
        var nut = AO.craft.itemValue(it.r, S.ench, AO.craft.productId(it, S.ench)).value * C.nutritionFactor;
        if (!nut) return U.toast('Für diesen Gegenstand fehlt der Item-Wert', 'err');
        /* Der eingetragene Wert gilt inkl. Premium-Bonus, falls angehakt. */
        var base = S.premium ? fame / 1.5 : fame;
        S.factor = Math.round(base / nut * 10000) / 10000;
        S.$save();
        el.factor.value = String(S.factor).replace('.', ',');
        U.toast('Faktor kalibriert: ' + F.n2(S.factor) + ' Fame je Nährwertpunkt', 'ok');
        render();
      });

      syncEnch(); render();

      function showList() {
        var term = el.search.value.trim().toLowerCase();
        var hits = all().filter(function (i) {
          return !term || i.n.toLowerCase().indexOf(term) >= 0 || i.id.toLowerCase().indexOf(term) >= 0;
        }).slice(0, 60);
        el.list.innerHTML = hits.length ? hits.map(function (i) {
          return '<button data-id="' + F.esc(i.id) + '">' + F.img(i.id, 56, i.n) +
            '<span class="nm">' + F.esc(i.n) + '</span><span class="meta">T' + i.t + '</span></button>';
        }).join('') : '<div class="t-empty">Nichts gefunden</div>';
        el.list.hidden = false;
      }

      function syncEnch() {
        var it = find(S.item);
        var ok = it && AO.craft.enchantable(it);
        if (!ok) S.ench = 0;
        el.enchSeg.innerHTML = U.seg([0, 1, 2, 3, 4].map(function (e) {
          return { v: String(e), n: e ? '.' + e : 'Normal' };
        }), String(S.ench));
        U.qa('button', el.enchSeg).forEach(function (b) {
          if (!ok && b.dataset.v !== '0') b.disabled = true;
        });
      }

      function fameOf(iv) {
        return iv * C.nutritionFactor * S.factor * (S.premium ? 1.5 : 1);
      }

      function render() {
        var it = find(S.item);
        if (!it) { el.chosen.innerHTML = '<span class="warn">Kein Gegenstand gewählt</span>'; return; }
        el.chosen.innerHTML = F.img(AO.craft.productId(it, S.ench), 40, it.n) + ' <b>' + F.esc(it.n) + '</b> · T' + it.t;

        var info = AO.craft.itemValue(it.r, S.ench, AO.craft.productId(it, S.ench));
        var nut = info.value * C.nutritionFactor;
        var per = fameOf(info.value);
        var focusPer = (it.f && it.f[S.ench]) || 0;

        el.stats.innerHTML =
          U.stat('Fame je Craft', F.n2(per), S.premium ? 'inkl. Premium' : 'ohne Premium') +
          U.stat('Fame gesamt', F.s(per * S.crafts), F.q(S.crafts) + ' Crafts') +
          U.stat('Item-Wert', F.n2(info.value), 'Summe der Zutaten') +
          U.stat('Fokus je Craft', focusPer ? F.s(focusPer) : '—', 'aus den Spieldaten');

        el.basis.innerHTML =
          '<div class="dl"><span>Item-Wert (Summe der Zutatenwerte)</span><span><b>' + F.n2(info.value) + '</b></span></div>' +
          '<div class="dl"><span>Nährwert (Item-Wert × 0,1125)</span><span>' + F.n2(nut) + '</span></div>' +
          '<div class="dl"><span>Faktor Fame je Nährwertpunkt</span><span>' + F.n2(S.factor) + '</span></div>' +
          '<div class="dl"><span>Premium-Bonus</span><span>' + (S.premium ? '× 1,5' : '—') + '</span></div>' +
          '<div class="dl total"><span>Fame je Craft</span><span>' + F.n2(per) + '</span></div>' +
          (info.missing.length
            ? '<div class="notice warn" style="margin-top:var(--s3)">Für <b>' + info.missing.map(F.esc).join(', ') +
              '</b> führt das Spiel keinen Item-Wert – diese Zutat fließt nicht ein.</div>'
            : '') +
          '<div class="hint" style="margin-top:var(--s3)">Item-Wert, Nährwert und Fokus stammen aus den ' +
          'offiziellen Spieldaten. Der Fame-Faktor tut das nicht – bitte einmal links kalibrieren.</div>';

        /* Alle Tiers derselben Familie */
        var key = it.id.replace(/^T\d_/, '');
        var fam = all().filter(function (x) { return x.id.replace(/^T\d_/, '') === key; })
          .sort(function (a, b) { return a.t - b.t; });
        el.rows.innerHTML = fam.map(function (x) {
          var e = AO.craft.enchantable(x) ? S.ench : 0;
          var v = AO.craft.itemValue(x.r, e, AO.craft.productId(x, e)).value;
          var f = fameOf(v);
          var cur = x.id === it.id;
          return '<tr class="hover"' + (cur ? ' style="background:var(--goldDim)"' : '') + '>' +
            '<td><div class="itemcell">' + F.img(AO.craft.productId(x, e), 56, x.n) +
            '<div class="nm"><b>' + F.tier(x.t, e) + ' ' + F.esc(x.n) + '</b></div></div></td>' +
            '<td>' + F.n2(v) + '</td><td>' + F.n2(v * C.nutritionFactor) + '</td>' +
            '<td><b>' + F.n2(f) + '</b></td><td>' + F.s(f * S.crafts) + '</td></tr>';
        }).join('');
      }
    }
  };
})();
