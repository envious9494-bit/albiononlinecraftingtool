/* Fokus-Rechner: was ist ein Fokuspunkt in Silber wert?
   Fokuskosten je Gegenstand und Verzauberung stammen aus den Spieldaten. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  var S = AO.store.bind('focus', {
    item: 'T4_MAIN_SWORD', ench: 0, pool: 30000, fee: 800,
    city: 'Caerleon', place: 'none', crafts: 100
  });

  function all() { return AO.data.items.concat(AO.data.consumables); }
  function find(id) { return all().filter(function (i) { return i.id === id; })[0] || null; }

  AO.views.focus = {
    id: 'focus',
    title: 'Fokus-Rechner',
    subtitle: 'Fokuskosten, mögliche Crafts und Silber je Fokuspunkt',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Gegenstand</h4>' +
            '<div class="picker"><input data-x="search" placeholder="suchen…" autocomplete="off" spellcheck="false" style="width:100%">' +
              '<div class="picker-list" data-x="list" hidden></div></div>' +
            '<div class="hint" data-x="chosen"></div>' +
            '<div class="field stack" style="margin-top:var(--s3)"><label>Verzauberung</label><div data-x="enchSeg"></div></div>' +
          '</div>' +
          '<div class="fieldset"><h4>Rahmen</h4>' +
            '<div class="field"><span class="lbl w">Fokus da</span><input class="num" data-x="pool" inputmode="numeric"><span class="mut">Punkte</span></div>' +
            '<div class="field"><span class="lbl w">Crafts</span><input class="num" data-x="crafts" inputmode="numeric"></div>' +
            '<div class="field"><span class="lbl w">Gebühr</span><input class="num" data-x="fee" inputmode="numeric"><span class="mut">/100 NW</span></div>' +
            '<div class="field"><span class="lbl w">Stadt</span><select data-x="city"></select></div>' +
            '<div class="field stack"><label>Herstellungsort</label><div data-x="placeSeg"></div>' +
              '<div class="field" data-x="hoBox" hidden style="margin-top:6px">' +
                '<span class="lbl">Produktionsbonus</span>' +
                '<input class="num" data-x="hoBonus" inputmode="decimal" style="max-width:100px">' +
                '<span class="mut">%</span></div></div>' +
            '<div class="hint" data-x="placeHint"></div>' +
          '</div>' +
        '</div>' +
        '<div>' +
          '<div class="view-toolbar">' +
            '<button class="btn primary" data-x="load"><span class="spin">⟳</span> Marktpreise laden</button>' +
            '<span class="mut" data-x="stamp"></span></div>' +
          '<div data-x="notice"></div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +
          '<div class="card"><div class="card-head"><h3>Mit und ohne Fokus</h3></div>' +
            '<div class="tablewrap" style="border:none">' +
              '<table class="data"><thead><tr><th>Lauf</th><th>Rückgabe</th><th>Materialkosten</th>' +
              '<th>Gesamtkosten</th><th>Fokus</th></tr></thead><tbody data-x="cmp"></tbody></table></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      U.fill(el.city, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.city);
      el.pool.value = S.pool; el.fee.value = S.fee; el.crafts.value = S.crafts;
      /* Ohne Bonus / Stadtbonus / Hideout - der Hideout-Bonus kommt aus den
         globalen Einstellungen, damit er nur einmal gepflegt wird. */
      el.placeSeg.innerHTML = U.seg([
        { v: 'none', n: 'Ohne Bonus' }, { v: 'city', n: 'Stadtbonus' }, { v: 'hideout', n: 'Hideout' }
      ], S.place);
      el.hoBonus.value = String(AO.settings.hideoutBonus).replace('.', ',');
      syncPlace();
      el.placeSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.place = b.dataset.v; S.$save(); U.segSet(el.placeSeg.firstChild, b.dataset.v);
        syncPlace(); render();
      });
      el.hoBonus.addEventListener('input', function () {
        var v = parseFloat(String(el.hoBonus.value).replace(',', '.'));
        AO.settings.hideoutBonus = isFinite(v) ? v : 0; AO.settings.$save();
        document.dispatchEvent(new CustomEvent('ao:settings'));
        render();
      });
      document.addEventListener('ao:settings', function () {
        if (document.activeElement !== el.hoBonus) {
          el.hoBonus.value = String(AO.settings.hideoutBonus).replace('.', ',');
        }
        syncPlace();
        if (document.contains(root)) render();
      });
      function syncPlace() {
        el.hoBox.hidden = S.place !== 'hideout';
        el.placeHint.innerHTML = 'Ohne Fokus <b>' + F.pct(rateNo() * 100) + '</b>, mit Fokus <b>' +
          F.pct(rateYes() * 100) + '</b> Rückgabe. Der Unterschied zwischen beiden Läufen ' +
          'ist der Nutzen deines Fokus.';
      }
      function rateNo() {
        return AO.craft.returnRate(S.place === 'city' ? 'city' : S.place === 'hideout' ? 'hideout' : 'none');
      }
      function rateYes() {
        return AO.craft.returnRate(S.place === 'city' ? 'cityfocus' : S.place === 'hideout' ? 'hideoutfocus' : 'focus');
      }

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
      ['pool', 'fee', 'crafts'].forEach(function (k) {
        el[k].addEventListener('input', function () {
          var v = F.parse(el[k].value); S[k] = v === null ? 0 : v; S.$save(); render();
        });
      });
      el.city.addEventListener('change', function () { S.city = el.city.value; S.$save(); render(); });

      el.load.addEventListener('click', function () {
        var it = find(S.item); if (!it) return;
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(AO.craft.idsFor(it, S.ench), [1])
          .then(function () { U.toast('Preise aktualisiert', 'ok'); })
          .catch(function (e) { U.toast('Laden fehlgeschlagen: ' + e.message, 'err'); })
          .then(function () { el.load.classList.remove('loading'); el.load.disabled = false; render(); });
      });
      document.addEventListener('ao:server', function () { if (document.contains(root)) render(); });
      U.onPrices(root, render);

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
        /* Traenke gehen nur bis .3 - fuer .4 gibt es kein Rezept. */
        var max = it ? AO.craft.enchMax(it) : 4;
        if (S.ench > max) S.ench = 0;
        var stufen = [0];
        for (var i = 1; i <= max; i++) stufen.push(i);
        el.enchSeg.innerHTML = U.seg(stufen.map(function (e) {
          return { v: String(e), n: e ? '.' + e : 'Normal' };
        }), String(S.ench));
        U.qa('button', el.enchSeg).forEach(function (b) {
          if (!ok && b.dataset.v !== '0') b.disabled = true;
        });
      }

      function run(rate) {
        var it = find(S.item);
        return AO.craft.calc({
          recipe: AO.craft.recipeFor(it, S.ench), ench: S.ench, amountCrafted: it.a, crafts: S.crafts,
          returnRate: rate, buyCity: S.city, sellCity: S.city, quality: 1,
          premium: AO.settings.premium, buyMethod: AO.settings.buyMethod,
          sellMethod: AO.settings.sellMethod, stationFee: S.fee,
          focusPerCraft: 0, useFocus: false,
          productId: AO.craft.productId(it, S.ench)
        });
      }

      function render() {
        var it = find(S.item);
        el.stamp.textContent = AO.market.has() ? 'Marktdaten: ' + F.time(AO.market.stamp()) + ' Uhr' : 'Noch nichts geladen';
        if (!it) { el.chosen.innerHTML = '<span class="warn">Kein Gegenstand gewählt</span>'; return; }

        el.chosen.innerHTML = F.img(AO.craft.productId(it, S.ench), 40, it.n) + ' <b>' + F.esc(it.n) + '</b> · T' + it.t;

        var focusPer = (it.f && it.f[S.ench]) || 0;
        /* Rueckgaberaten zentral aufloesen - so gilt der Hideout-Bonus auch hier. */
        var rNo = rateNo(), rYes = rateYes();
        var a = run(rNo), b = run(rYes);
        var saved = a.costTotal - b.costTotal;
        var focusTotal = focusPer * S.crafts;
        var perPoint = focusTotal ? saved / focusTotal : NaN;
        var maxCrafts = focusPer ? Math.floor(S.pool / focusPer) : NaN;

        el.notice.innerHTML = (a.missingPrice.length)
          ? '<div class="notice warn" style="margin-bottom:var(--s4)">Ohne Materialpreise lässt sich der ' +
            'Silberwert nicht berechnen – bitte „Marktpreise laden“.</div>' : '';

        el.stats.innerHTML =
          U.stat('Fokus je Craft', focusPer ? F.s(focusPer) : '—', S.ench ? 'Stufe .' + S.ench : 'unverzaubert') +
          U.stat('Crafts mit ' + F.sk(S.pool), isFinite(maxCrafts) ? F.s(maxCrafts) : '—', 'aus deinem Fokusvorrat') +
          U.stat('Ersparnis', F.s(saved), 'für ' + F.q(S.crafts) + ' Crafts', saved > 0 ? 'pos' : '') +
          U.stat('Silber je Fokuspunkt', F.n2(perPoint), 'eingespartes Material', perPoint > 0 ? 'pos' : '');

        el.cmp.innerHTML =
          row('Ohne Fokus', rNo, a, 0) +
          row('Mit Fokus', rYes, b, focusTotal);

        function row(name, rate, d, foc) {
          return '<tr class="hover"><td><b>' + name + '</b></td>' +
            '<td>' + F.pct(rate * 100) + '</td>' +
            '<td>' + F.s(d.matTotal) + '</td>' +
            '<td><b>' + F.s(d.costTotal) + '</b></td>' +
            '<td>' + (foc ? F.s(foc) : '—') + '</td></tr>';
        }
      }
    }
  };
})();
