/* Craft-Chancen: was lohnt sich gerade herzustellen?

   Dieselbe Maschinerie wie die Flip-Suche im Aufwertungs-Rechner, nur fuer
   das Herstellen: Material am Markt kaufen, mit Rueckgabe und Stationsgebuehr
   craften, verkaufen - und sofort sehen, was dabei herauskommt.

   Gerechnet wird ueber AO.craft.calc(), also mit genau derselben, mehrfach
   gegengerechneten Mathematik wie in den Einzelrechnern. Diese Ansicht
   sammelt nur Kandidaten ein, laedt Preise und sortiert das Ergebnis. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  /* Alle craftbaren Gegenstaende in einem Topf - Ausruestung, raffinierte
     Rohstoffe, Nahrung, Traenke, Fischsaucen. Sie teilen sich dieselbe
     Struktur {id,n,d,t,c,g,a,f,r}, deshalb genuegt eine Liste. */
  function pool() {
    return [].concat(
      AO.data.items || [],
      AO.data.refining || [],
      AO.data.consumables || [],
      AO.data.fish || []
    );
  }

  var GRUPPEN = [
    { v: 'all',         n: 'Alles' },
    { v: 'weapons',     n: 'Waffen' },
    { v: 'armor',       n: 'Rüstung' },
    { v: 'accessories', n: 'Zubehör' },
    { v: 'gear',        n: 'Werkzeug' },
    { v: 'refining',    n: 'Refining' },
    { v: 'food',        n: 'Nahrung' },
    { v: 'potion',      n: 'Tränke' },
    { v: 'fish',        n: 'Fisch' }
  ];

  var TIERS = [{ v: '0', n: 'Alle Stufen' }].concat(
    [2, 3, 4, 5, 6, 7, 8].map(function (t) { return { v: String(t), n: 'T' + t }; }));

  var ENCH = [{ v: 'alle', n: 'alle' }].concat(
    [0, 1, 2, 3, 4].map(function (e) { return { v: String(e), n: '.' + e }; }));

  var AGES = [
    { v: '0',  n: 'Alter egal' },
    { v: '48', n: 'max. 2 Tage' },
    { v: '24', n: 'max. 24 Std.' },
    { v: '8',  n: 'max. 8 Std.' },
    { v: '3',  n: 'max. 3 Std.' }
  ];

  var S = AO.store.bind('craftscan', {
    ench: '0', buyCity: 'Martlock', sellCity: 'Martlock',
    rrMode: 'city', rrManual: 36.7, fee: 800, focus: false,
    onlyProfit: true, minProfit: 0, minSold: 1, histDays: 21,
    maxAge: '24', basis: 'markt', maxUeber: 2,
    tier: '0', gruppe: 'all', sort: 'profit',
    guild: false, guildPct: 15
  });

  /* Beim Herstellen laesst sich die Qualitaet nicht bestimmen - was aus der
     Station kommt, ist ganz ueberwiegend Normal. Deshalb wird hier fest mit
     der schlechtesten Stufe gerechnet, statt sie zur Wahl zu stellen: eine
     hoehere anzunehmen hiesse, sich einen Preis auszurechnen, den man gar
     nicht erreicht. */
  var QUAL = 1;

  var SCAN = null, CACHE = null, VORAUSWAHL = false;
  var SKIPPED = 0, VERALTET = 0, PHANTOM = 0;

  AO.views.craftscan = {
    id: 'craftscan',
    title: 'Craft-Chancen',
    subtitle: 'Material kaufen, herstellen, verkaufen – was bleibt übrig?',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Wo gehandelt wird</h4>' +
            '<div class="field"><span class="lbl w">Material</span><select data-x="buyCity"></select></div>' +
            '<div class="field"><span class="lbl w">Verkauf</span><select data-x="sellCity"></select></div>' +
            '<div class="field"><span class="lbl w">Qualität</span>' +
              '<span class="chip">Normal</span></div>' +
            '<div class="hint">Gerechnet wird immer mit <b>Normal</b>, der schlechtesten Stufe. ' +
              'Beim Herstellen bekommt man die Qualität nicht geschenkt – wer damit rechnet, ' +
              'sie zu treffen, rechnet sich reich. Material wird ohnehin nur in Normal ' +
              'gehandelt.</div>' +
            '<div class="hint">Einkaufs- und Verkaufsart sowie Premium kommen aus den ' +
              'Einstellungen und gelten hier genauso.</div>' +
          '</div>' +
          '<div class="fieldset"><h4>Herstellung</h4>' +
            '<div class="field stack"><label>Verzauberung</label><div data-x="enchSeg"></div>' +
              '<div class="hint">„alle“ prüft jede Stufe einzeln – das sind rund fünfmal ' +
              'so viele Preisabfragen.</div></div>' +
            '<div class="field stack"><label>Rückgaberate</label><div data-x="rrSeg"></div>' +
              '<div class="field" data-x="rrManualBox" hidden style="margin-top:6px">' +
                '<span class="lbl" data-x="rrLbl">Rate</span>' +
                '<input class="num" data-x="rrManual" inputmode="decimal" style="max-width:100px">' +
                '<span class="mut">%</span></div>' +
              '<div class="hint" data-x="rrHint"></div></div>' +
            '<div class="field"><span class="lbl w">Gebühr</span>' +
              '<input class="num" data-x="fee" inputmode="numeric"><span class="mut">/100 NW</span></div>' +
            '<label class="field check"><input type="checkbox" data-x="focus"> Fokus einsetzen</label>' +
          '</div>' +
          '<div class="fieldset"><h4>Gildenverkauf</h4>' +
            '<label class="field check" title="Direkter Handel: keine Verkaufssteuer, keine ' +
              'Ordergebühr. Der Preis ist der Marktwert abzüglich Rabatt.">' +
              '<input type="checkbox" data-x="guild"> An Gilde verkaufen (direkt)</label>' +
            '<div class="field"><span class="lbl w">Rabatt</span>' +
              '<input class="num" data-x="guildPct" inputmode="decimal"><span class="mut">%</span></div>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="view-toolbar">' +
            '<button class="btn primary" data-x="scan"><span class="spin">⟳</span> Chancen suchen</button>' +
            '<span class="mut" data-x="stamp"></span>' +
          '</div>' +
          '<div class="chips" data-x="chips" style="margin-bottom:var(--s4)"></div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +

          '<div class="card">' +
            '<div class="card-head"><h3>Was lohnt sich gerade herzustellen?</h3>' +
              '<div class="right"><div data-x="sortSeg"></div></div></div>' +
            '<div class="filterbar">' +
              '<div data-x="grpSeg" class="chips"></div>' +
              '<div data-x="tierSeg"></div>' +
              '<label class="field check" style="margin:0"><input type="checkbox" data-x="onlyProfit"> ' +
                'nur mit Gewinn</label>' +
              '<button class="btn sm ghost" data-x="more">Mehr Filter</button>' +
              '<div class="bar" data-x="bar" style="flex:1;min-width:120px" hidden><i style="width:0"></i></div>' +
            '</div>' +
            '<div class="filterbar sub" data-x="moreBox" hidden>' +
              '<label class="mut">ab Gewinn ' +
                '<input class="num" data-x="minProfit" inputmode="numeric" style="width:100px"> Silber</label>' +
              '<label class="mut" title="Wie viele Stück davon in den letzten drei Wochen ' +
                'tatsächlich verkauft wurden. 0 schaltet die Prüfung ab.">mind. ' +
                '<input class="num" data-x="minSold" inputmode="decimal" style="width:64px"> verkauft/Tag</label>' +
              '<div data-x="basisSeg" title="Womit gerechnet wird: mit dem aktuellen Marktpreis ' +
                'oder mit dem Preis, zu dem zuletzt tatsächlich gehandelt wurde."></div>' +
              '<label class="mut" title="Ein einzelnes Fantasieangebot weit über dem erzielten ' +
                'Preis ist keine Chance. 0 schaltet die Prüfung ab.">höchstens ' +
                '<input class="num" data-x="maxUeber" inputmode="decimal" style="width:56px">× über erzielt</label>' +
              '<div data-x="ageSeg"></div>' +
            '</div>' +
            '<div class="card-body tight" data-x="info"></div>' +
            '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
              '<table class="data"><thead><tr>' +
                '<th>Gegenstand</th><th>Gruppe</th><th title="Verzauberungsstufe">Verz.</th>' +
                '<th>Material</th>' +
                '<th title="Nutzungsgebühr der Station je Stück">Gebühr</th>' +
                '<th>Kosten / Stück</th>' +
                '<th title="Preis, mit dem gerechnet wird">Verkauf</th>' +
                '<th title="Mengengewichteter Durchschnitt der Preise, zu denen am Verkaufsort ' +
                'tatsächlich gehandelt wurde.">zuletzt erzielt</th>' +
                '<th title="Was über alle Städte hinweg real gezahlt wurde – der Gegenwert ' +
                'unabhängig vom Verkaufsort.">Marktwert</th>' +
                '<th title="Tatsächlich verkaufte Stück je Tag am Verkaufsort">Umsatz/Tag</th>' +
                '<th title="Alter des ältesten beteiligten Preises">Daten</th>' +
                '<th>Gewinn / Stück</th><th>Marge</th>' +
                '<th title="Gewinn je eingesetztem Fokuspunkt">je Fokus</th>' +
              '</tr></thead><tbody data-x="rows"></tbody></table>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      /* ------------------------------------------------ Oberflaeche fuellen */
      U.fill(el.buyCity, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.buyCity);
      U.fill(el.sellCity, AO.data.sellLocations, S.sellCity);
      el.fee.value = S.fee;
      el.focus.checked = S.focus;
      el.guild.checked = S.guild;
      el.guildPct.value = String(S.guildPct).replace('.', ',');
      el.onlyProfit.checked = S.onlyProfit;
      el.minProfit.value = S.minProfit;
      el.minSold.value = String(S.minSold).replace('.', ',');
      el.maxUeber.value = String(S.maxUeber).replace('.', ',');
      el.enchSeg.innerHTML = U.seg(ENCH, S.ench);
      el.tierSeg.innerHTML = U.seg(TIERS, S.tier);
      el.ageSeg.innerHTML = U.seg(AGES, S.maxAge);
      el.sortSeg.innerHTML = U.seg([
        { v: 'profit', n: 'nach Gewinn' },
        { v: 'margin', n: 'nach Marge' },
        { v: 'focus',  n: 'je Fokus' }
      ], S.sort);
      el.basisSeg.innerHTML = U.seg([
        { v: 'markt', n: 'Marktpreis' }, { v: 'erzielt', n: 'zuletzt erzielt' }
      ], S.basis);
      el.rrSeg.innerHTML = U.seg(AO.data.returnRates.map(function (r) {
        return { v: r.id, n: r.label };
      }).concat([{ v: 'manual', n: 'eigene' }]), S.rrMode);
      renderGrp();
      syncRate();

      /* ------------------------------------------------------- Ereignisse */
      function segHandler(node, key, nachSuche) {
        node.addEventListener('click', function (e) {
          var b = e.target.closest('button[data-v]'); if (!b) return;
          S[key] = b.dataset.v; S.$save();
          U.segSet(node.firstChild, b.dataset.v);
          CACHE = null;
          if (nachSuche) { SCAN = null; }
          render();
        });
      }
      segHandler(el.enchSeg, 'ench', true);
      segHandler(el.tierSeg, 'tier');
      segHandler(el.ageSeg, 'maxAge');
      segHandler(el.sortSeg, 'sort');
      segHandler(el.basisSeg, 'basis');

      el.rrSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.rrMode = b.dataset.v; S.$save();
        U.segSet(el.rrSeg.firstChild, b.dataset.v);
        syncRate(); CACHE = null; render();
      });
      el.grpSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-g]'); if (!b) return;
        S.gruppe = b.dataset.g; S.$save(); renderGrp(); CACHE = null; render();
      });

      [['buyCity', 'buyCity'], ['sellCity', 'sellCity']].forEach(function (p) {
        el[p[0]].addEventListener('change', function () {
          S[p[1]] = el[p[0]].value; S.$save(); CACHE = null; render();
        });
      });

      el.focus.addEventListener('change', function () {
        S.focus = el.focus.checked; S.$save(); CACHE = null; render();
      });
      el.guild.addEventListener('change', function () {
        S.guild = el.guild.checked; S.$save(); CACHE = null; render();
      });

      function zahlFeld(node, key, min, max, ganz) {
        node.addEventListener('input', U.debounce(function () {
          var v = ganz ? F.parse(node.value)
                       : parseFloat(String(node.value).replace(',', '.'));
          if (!isFinite(v) || v === null) v = 0;
          S[key] = Math.min(Math.max(v, min), max); S.$save();
          CACHE = null;
          U.keepFocus(root, render);
        }, 220));
      }
      zahlFeld(el.fee, 'fee', 0, 100000, true);
      zahlFeld(el.guildPct, 'guildPct', 0, 100, false);
      zahlFeld(el.minProfit, 'minProfit', 0, 1e12, true);
      zahlFeld(el.minSold, 'minSold', 0, 10000, false);
      zahlFeld(el.maxUeber, 'maxUeber', 0, 100, false);
      zahlFeld(el.rrManual, 'rrManual', 0, 75, false);

      el.onlyProfit.addEventListener('change', function () {
        S.onlyProfit = el.onlyProfit.checked; S.$save(); render();
      });
      el.scan.addEventListener('click', runScan);
      /* Die feineren Filter braucht man selten - sie bleiben eingeklappt,
         bis jemand sie holt, und merken sich dann ihren Zustand. */
      (function () {
        var offen = AO.store.get('craftscan.more', false);
        function sync() {
          el.moreBox.hidden = !offen;
          el.more.textContent = offen ? 'Weniger Filter' : 'Mehr Filter';
          el.more.classList.toggle('on', offen);
        }
        sync();
        el.more.addEventListener('click', function () {
          offen = !offen; AO.store.set('craftscan.more', offen); sync();
        });
      })();

      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-goto]');
        /* Wer gerade Text markiert hat, wollte kopieren, nicht wechseln. */
        if (!b || U.hasSelection()) return;
        oeffne(b.dataset.goto, b.dataset.item, +b.dataset.ench || 0);
      });

      /* Ein Klick auf die Zeile fuehrt in den passenden Einzelrechner - und
         stellt ihn auf genau diesen Gegenstand samt allen Annahmen ein.
         Ohne das Weiterreichen zeigte der Rechner weiter, was zuletzt dort
         ausgewaehlt war, also einen voellig anderen Gegenstand. */
      function oeffne(ziel, itemId, e) {
        AO.router.go(ziel);
        /* Der Wechsel haengt am hashchange-Ereignis; die Zielansicht entsteht
           deshalb erst im naechsten Durchlauf. Vorher gibt es dort nichts
           auszuwaehlen. */
        setTimeout(function () {
          var v = AO.views[ziel];
          if (!v || !v.select) return;
          var ok = v.select(itemId, {
            ench: e, buyCity: S.buyCity, sellCity: S.sellCity, quality: QUAL,
            fee: S.fee, rrMode: S.rrMode, rrManual: S.rrManual, focus: S.focus
          });
          if (!ok) U.toast('Im ' + v.title + ' nicht gefunden: ' + itemId, 'err');
        }, 0);
      }

      document.addEventListener('ao:server', function () {
        if (document.contains(root)) { SCAN = null; CACHE = null; render(); }
      });
      document.addEventListener('ao:settings', function () {
        if (document.contains(root)) { CACHE = null; render(); }
      });
      U.onPrices(root, function () { CACHE = null; render(); });

      render();

      /* ==================================================================== */

      function renderGrp() {
        el.grpSeg.innerHTML = GRUPPEN.map(function (g) {
          return '<button class="chip' + (S.gruppe === g.v ? ' ok' : '') + '" data-g="' + g.v + '">' +
            F.esc(g.n) + '</button>';
        }).join('');
      }

      function syncRate() {
        var eintrag = AO.data.returnRates.filter(function (r) { return r.id === S.rrMode; })[0];
        var dyn = !!(eintrag && eintrag.dynamic);
        el.rrManualBox.hidden = !(dyn || S.rrMode === 'manual');
        el.rrLbl.textContent = dyn ? 'Produktionsbonus' : 'Rate';
        el.rrManual.value = String(dyn ? AO.settings.hideoutBonus : S.rrManual).replace('.', ',');
        el.rrHint.textContent = dyn
          ? 'Hideouts haben keinen festen Bonus – er hängt von Zonenqualität und Power-Cores ab. ' +
            'Aus dem Bonus B ergibt sich die Rückgabe als B ÷ (1+B).'
          : 'Zurückgegebene Materialien werden direkt weiterverarbeitet. Artefakte kommen nie zurück.';
      }

      function rate() {
        if (S.rrMode === 'manual') return AO.craft.returnRate('manual', S.rrManual);
        return AO.craft.returnRate(S.rrMode);
      }

      /* ------------------------------------------------------ Kandidaten */
      function enchStufen(it) {
        if (!AO.craft.enchantable(it)) return [0];
        if (S.ench === 'alle') return [0, 1, 2, 3, 4];
        return [+S.ench];
      }

      function kandidaten() {
        var raus = [];
        pool().forEach(function (it) {
          if (!it.r || !it.r.length) return;
          enchStufen(it).forEach(function (e) { raus.push({ it: it, e: e }); });
        });
        return raus;
      }

      function idsFor(k) {
        var ids = [AO.craft.productId(k.it, k.e)];
        k.it.r.forEach(function (r) { ids.push(AO.craft.matId(r[0], k.e, r[2])); });
        return ids;
      }

      /* --------------------------------------------------------- Rechnung */
      function calc(k) {
        var it = k.it, e = k.e;
        var prodId = AO.craft.productId(it, e);
        var buySide = AO.craft.buySide(AO.settings.buyMethod);
        var sellSide = AO.craft.sellSideAt(S.sellCity, AO.settings.sellMethod);

        /* Alter des aeltesten beteiligten Preises - ein Weg ist nur so gut
           wie sein schlechtester Datenpunkt. */
        var alter = 0;
        function merke(id, city, q, side) {
          if (AO.market.isOwn(id, city, q, side)) return;
          var d = AO.market.date(id, city, q, side);
          var h = d ? (Date.now() - d.getTime()) / 3600000 : Infinity;
          if (h > alter) alter = h;
        }
        it.r.forEach(function (r) {
          var id = AO.craft.matId(r[0], e, r[2]);
          merke(id, S.buyCity, 1, buySide);
        });
        merke(prodId, S.sellCity, QUAL, sellSide);

        var d = AO.craft.calc({
          recipe: it.r, ench: e, amountCrafted: it.a, crafts: 1,
          returnRate: rate(), buyCity: S.buyCity, sellCity: S.sellCity,
          quality: QUAL, premium: AO.settings.premium,
          buyMethod: AO.settings.buyMethod, sellMethod: AO.settings.sellMethod,
          stationFee: S.fee, focusPerCraft: (it.f && it.f[e]) || 0,
          useFocus: S.focus, productId: prodId
        });

        var listed = d.sellPrice;
        var erzielt = AO.market.avgPrice(prodId, S.sellCity, QUAL);
        var mw = AO.market.emv(prodId, QUAL);

        /* Der Verkaufspreis haengt an der gewaehlten Grundlage. Beim
           Gildenverkauf entfallen Steuer und Ordergebuehr komplett - ein
           Handel von Hand zu Hand kennt beides nicht. */
        var preis = listed, brutto, steuer, orderFee;
        if (S.guild && !VORAUSWAHL) {
          preis = mw ? mw.value * (1 - (S.guildPct || 0) / 100) : null;
        } else if (S.basis === 'erzielt' && erzielt) {
        /* In einer Stadt konkurriert man mit dem guenstigsten Angebot: wer
           darueber einstellt, verkauft nicht, sondern wartet. Der zuletzt
           erzielte Durchschnitt darf deshalb nie ueber dem aktuellen Angebot
           liegen - sonst rechnet man mit einem Preis, den heute niemand mehr
           zahlt. (Realer Fall: Adept's Mercenary Shoes .3 in Fort Sterling,
           erzielt 84.901 gegen ein aktuelles Angebot von 59.990.)
           Am Schwarzmarkt gilt das NICHT: dort ist "listed" die Kauforder des
           Spiels, kein konkurrierendes Angebot - und die liegt regelmaessig
           unter dem, was dort tatsaechlich gezahlt wird. */
          preis = (S.sellCity !== AO.data.blackMarket && listed && listed < erzielt)
            ? listed : erzielt;
        }
        var fehlt = d.missingPrice.slice();
        if (preis === null || preis === undefined) {
          fehlt.push(S.guild ? 'Marktwert' : 'Verkaufspreis');
          preis = 0;
        }
        brutto = d.out * preis;
        if (S.guild && !VORAUSWAHL) {
          steuer = 0; orderFee = 0;
        } else {
          steuer = brutto * (AO.settings.premium ? AO.data.consts.taxPremium : AO.data.consts.taxNormal);
          orderFee = brutto * AO.craft.sellOrderFeeAt(S.sellCity, AO.settings.sellMethod);
        }
        var netto = brutto - steuer - orderFee;
        var gewinn = netto - d.costTotal;

        return {
          prodId: prodId, out: d.out,
          matTotal: d.matTotal, feeTotal: d.feeTotal, orderBuy: d.orderBuy,
          costTotal: d.costTotal, kostenProStueck: d.out ? d.costTotal / d.out : NaN,
          preis: preis, listed: listed, erzielt: erzielt,
          marktwert: mw ? mw.value : null, marktwertMenge: mw ? mw.sold : 0,
          brutto: brutto, steuer: steuer, orderFee: orderFee, netto: netto,
          gewinn: gewinn, proStueck: d.out ? gewinn / d.out : NaN,
          marge: d.costTotal ? gewinn / d.costTotal * 100 : NaN,
          fokus: d.focusTotal, jeFokus: d.focusTotal ? gewinn / d.focusTotal : NaN,
          missing: fehlt, age: alter,
          itemValue: d.itemValue
        };
      }

      /* ------------------------------------------------------------ Suche */
      function runScan() {
        if (el.scan.disabled) return;
        var liste = kandidaten();
        var ids = {};
        liste.forEach(function (k) { idsFor(k).forEach(function (i) { ids[i] = 1; }); });
        var alleIds = Object.keys(ids);

        el.scan.classList.add('loading'); el.scan.disabled = true;
        el.bar.hidden = false; el.bar.firstChild.style.width = '0';
        el.info.innerHTML = '<span class="mut">Lade Preise für ' + F.q(alleIds.length) +
          ' Gegenstände und Materialien…</span>';

        AO.market.load(alleIds, [QUAL, 1], function (done, total) {
          el.bar.firstChild.style.width = Math.round(done / total * 100) + '%';
          el.info.innerHTML = '<span class="mut">Preise… Block ' + done + ' von ' + total + '</span>';
        })
        .then(function () {
          SCAN = liste; CACHE = null;

          /* Handelsdaten sind um ein Vielfaches umfangreicher als Preise -
             deshalb nur fuer die Wege holen, die ueberhaupt tragen. Im
             Gildenmodus haengt der Preis selbst an diesen Daten, darum
             rechnet die Vorauswahl dort mit dem vollen Marktpreis: mehr als
             das kann ein Gildenpreis nie bringen. */
          VORAUSWAHL = true; CACHE = null;
          var top = zeilen().filter(function (x) { return x.d.proStueck > 0; })
            .sort(function (a, b) { return b.d.proStueck - a.d.proStueck; })
            .slice(0, 400);
          VORAUSWAHL = false; CACHE = null;
          if (!top.length) return null;

          var hist = {};
          top.forEach(function (x) { hist[x.d.prodId] = 1; });
          el.info.innerHTML = '<span class="mut">Prüfe für ' + top.length +
            ' aussichtsreiche Gegenstände, ob sie sich überhaupt verkaufen lassen…</span>';
          return AO.market.loadHistory(Object.keys(hist), [QUAL], S.histDays,
            function (done, total) {
              el.bar.firstChild.style.width = Math.round(done / total * 100) + '%';
              el.info.innerHTML = '<span class="mut">Handelsdaten… Block ' + done +
                ' von ' + total + '</span>';
            }, { chunk: 40, concurrency: 4 });
        })
        .catch(function (e) { U.toast('Laden fehlgeschlagen: ' + e.message, 'err'); })
        .then(function () {
          el.scan.classList.remove('loading'); el.scan.disabled = false;
          el.bar.hidden = true; CACHE = null;
          render();
          var gut = zeilen().filter(function (x) { return x.d.proStueck > 0; }).length;
          U.toast(gut + ' Gegenstände mit Gewinn gefunden', gut ? 'ok' : 'info');
        });
      }

      function sig() {
        return [S.ench, S.buyCity, S.sellCity, QUAL, S.rrMode, S.rrManual, S.fee,
                S.focus ? 1 : 0, S.basis, S.maxUeber, S.maxAge, S.guild ? 1 : 0, S.guildPct,
                AO.settings.premium ? 1 : 0, AO.settings.buyMethod, AO.settings.sellMethod,
                AO.settings.hideoutBonus, AO.market.stamp(), AO.market.rev(),
                AO.market.hasHistory() ? 1 : 0, VORAUSWAHL ? 1 : 0].join('|');
      }

      function zeilen() {
        if (!SCAN) return [];
        var s = sig();
        if (CACHE && CACHE.sig === s) return CACHE.rows;
        var rows = [];
        SKIPPED = 0; VERALTET = 0; PHANTOM = 0;
        var grenzAlter = parseFloat(S.maxAge) > 0 ? parseFloat(S.maxAge) : Infinity;
        SCAN.forEach(function (k) {
          var d = calc(k);
          if (d.missing.length || !isFinite(d.marge)) { SKIPPED++; return; }
          if (d.age > grenzAlter) { VERALTET++; return; }
          if (!S.guild && S.basis === 'markt' && S.maxUeber > 0 && d.erzielt &&
              d.listed > d.erzielt * S.maxUeber) { PHANTOM++; return; }
          rows.push({ it: k.it, e: k.e, d: d,
                      sold: AO.market.soldPerDay(d.prodId, S.sellCity, QUAL) });
        });
        CACHE = { sig: s, rows: rows };
        return rows;
      }

      /* ----------------------------------------------------------- Anzeige */
      function render() {
        el.stamp.textContent = AO.market.has()
          ? 'Marktdaten: ' + F.time(AO.market.stamp()) + ' Uhr' : 'Noch keine Marktdaten geladen';

        var rr = rate();
        el.chips.innerHTML =
          '<span class="chip">Rückgabe <b>' + F.n1(rr * 100) + ' %</b></span>' +
          '<span class="chip">Gebühr <b>' + F.q(S.fee) + '</b>/100 NW</span>' +
          (S.focus ? '<span class="chip ok">Fokus</span>' : '') +
          (S.guild
            ? '<span class="chip ok">Gilde <b>−' + F.n1(S.guildPct) + ' %</b> · steuerfrei</span>'
            : '<span class="chip">Steuer <b>' + (AO.settings.premium ? '4 %' : '8 %') + '</b>' +
              (AO.craft.sellOrderFeeAt(S.sellCity, AO.settings.sellMethod) > 0
                ? ' + Order 2,5 %' : ' (Sofortverkauf)') + '</span>') +
          '<span class="chip">Material aus <b>' + F.esc(S.buyCity) + '</b></span>' +
          '<span class="chip">Verkauf in <b>' + F.esc(F.ort(S.sellCity)) + '</b></span>';

        if (!SCAN) {
          el.stats.innerHTML = '';
          el.info.innerHTML = '<span class="mut">Durchsucht <b>alle ' + F.q(pool().length) +
            ' herstellbaren Gegenstände</b> – Ausrüstung, raffinierte Rohstoffe, Nahrung, ' +
            'Tränke und Fischsaucen. Material wird in <b>' + F.esc(S.buyCity) +
            '</b> gekauft, verkauft wird in <b>' + F.esc(F.ort(S.sellCity)) + '</b>. ' +
            'Danach wird geprüft, was sich davon überhaupt verkaufen lässt.</span>';
          el.rows.innerHTML = '<tr><td colspan="14" class="t-empty">Noch nicht gesucht.</td></tr>';
          return;
        }

        var alle = zeilen();
        var mindest = S.minSold || 0;
        var grenze = Math.max(0, S.minProfit || 0);
        var passt = alle.filter(function (x) {
          if (S.gruppe !== 'all' && x.it.g !== S.gruppe) return false;
          if (S.onlyProfit && !(x.d.proStueck > 0)) return false;
          if (grenze > 0 && x.d.proStueck < grenze) return false;
          if (mindest > 0 && AO.market.hasHistory() && x.sold < mindest) return false;
          return true;
        });
        var nurStufe = S.tier !== '0' ? +S.tier : 0;
        var list = passt.filter(function (x) { return !nurStufe || x.it.t === nurStufe; })
          .sort(function (a, b) {
            if (S.sort === 'margin') return b.d.marge - a.d.marge;
            if (S.sort === 'focus') {
              var af = isFinite(a.d.jeFokus) ? a.d.jeFokus : -Infinity;
              var bf = isFinite(b.d.jeFokus) ? b.d.jeFokus : -Infinity;
              return bf - af;
            }
            return b.d.proStueck - a.d.proStueck;
          });

        var lohnt = alle.filter(function (x) { return x.d.proStueck > 0; }).length;
        var beste = list[0];
        el.stats.innerHTML =
          U.stat('Geprüft', F.q(alle.length), 'mit vollständigen Preisen') +
          U.stat('Mit Gewinn', F.q(lohnt), 'vor den Filtern', lohnt ? 'pos' : 'faint') +
          U.stat('Bester Gewinn', beste ? F.sg(beste.d.proStueck) : '—', 'je Stück',
                 beste ? (beste.d.proStueck >= 0 ? 'pos' : 'neg') : 'faint') +
          U.stat('Beste Marge', beste ? F.pct(beste.d.marge) : '—', 'Gewinn ÷ Kosten',
                 beste ? (beste.d.marge >= 0 ? 'pos' : 'neg') : 'faint');

        var jeStufe = {};
        passt.forEach(function (x) { jeStufe[x.it.t] = (jeStufe[x.it.t] || 0) + 1; });
        var stufenTxt = Object.keys(jeStufe).sort().map(function (t) {
          return '<button class="chip' + (t === S.tier ? ' ok' : '') + '" data-tier="' + t + '">T' +
            t + ' <b>' + jeStufe[t] + '</b></button>';
        }).join(' ');

        el.info.innerHTML = '<span class="mut">' + F.q(alle.length) +
          ' vollständige Rechnungen, davon <b>' + lohnt + '</b> mit Gewinn' +
          (SKIPPED ? '<span> · ' + F.q(SKIPPED) + ' ohne vollständige Preise ausgelassen</span>' : '') +
          (VERALTET ? '<span> · ' + F.q(VERALTET) + ' mit zu alten Preisen ausgelassen</span>' : '') +
          (PHANTOM ? '<span> · ' + PHANTOM + ' mit Fantasieangeboten ausgelassen</span>' : '') +
          (S.basis === 'erzielt' ? '<span> · gerechnet mit zuletzt erzielten Preisen</span>' : '') +
          (S.guild ? ' · Verkauf <b>an die Gilde</b> zu −' + F.n1(S.guildPct) + ' % vom Marktwert' : '') +
          (mindest > 0 && AO.market.hasHistory()
            ? '<span> · nur mit mindestens ' + F.n1(mindest) + ' verkauften Stück je Tag</span>' : '') +
          (nurStufe ? '<span> · angezeigt nur</span> <b>T' + nurStufe + '</b>' : '') +
          (list.length > 100 ? '<span> · die besten 100 angezeigt</span>' : '') +
          (stufenTxt ? '<br><span>angezeigt je Stufe:</span> ' + stufenTxt : '') + '</span>';

        el.rows.innerHTML = list.length ? list.slice(0, 100).map(function (x) {
          var d = x.d, it = x.it;
          var ziel = it.g === 'refining' ? 'refining'
                   : (it.c === 'food' || it.c === 'fish') ? 'cooking'
                   : it.c === 'potion' ? 'potion' : 'crafting';
          return '<tr class="hover" data-goto="' + ziel + '" data-item="' + F.esc(it.id) +
            '" data-ench="' + x.e + '" style="cursor:pointer" ' +
            'title="Anklicken, um ' + F.esc(it.n) + ' im Einzelrechner nachzurechnen">' +
            '<td><div class="itemcell">' + F.img(d.prodId, 56, it.n) +
              '<div class="nm"><b>' + F.esc(it.n) + '</b><span>' + F.esc(it.id) + '</span></div></div></td>' +
            '<td class="mut" style="font-size:12px">' + F.tier(it.t, 0) + ' ' +
              F.esc(AO.data.categories.catDe[it.c] || it.c) + '</td>' +
            '<td class="' + (x.e ? 'warn' : 'mut') + '" style="font-size:12px">.' + x.e + '</td>' +
            '<td>' + F.s(d.matTotal) + '</td>' +
            '<td class="mut">' + F.s(d.feeTotal) + '</td>' +
            '<td>' + F.s(d.kostenProStueck) + '</td>' +
            '<td' + (!S.guild && S.basis === 'markt' && d.erzielt && d.listed > d.erzielt * 1.5
                      ? ' class="warn"' : '') +
              ' title="' + (S.guild ? 'Gildenpreis' : S.basis === 'erzielt'
                 ? 'zuletzt erzielt – aktuell: ' + F.s(d.listed) : 'aktueller Marktpreis') + '">' +
              (S.guild || S.basis === 'erzielt' ? '<b>' + F.s(d.preis) + '</b>' : F.s(d.preis)) + '</td>' +
            '<td class="mut">' + (d.erzielt ? F.s(d.erzielt) : '<span class="faint">—</span>') + '</td>' +
            '<td class="mut" title="' + (d.marktwert
                ? F.q(d.marktwertMenge) + ' Stück in drei Wochen über alle Städte'
                : 'Keine Handelsdaten') + '">' +
              (d.marktwert ? F.s(d.marktwert) : '<span class="faint">—</span>') + '</td>' +
            '<td class="' + (x.sold >= 1 ? 'mut' : 'warn') + '" style="font-size:12px">' +
              (AO.market.hasHistory() ? F.n1(x.sold) : '<span class="faint">—</span>') + '</td>' +
            '<td class="' + (d.age < 3 ? 'pos' : d.age < 24 ? 'mut' : 'warn') + '" style="font-size:12px">' +
              (isFinite(d.age)
                ? (d.age < 1 ? '<1 Std.' : d.age < 48 ? Math.round(d.age) + ' Std.'
                                                      : Math.round(d.age / 24) + ' Tage')
                : '<span class="faint">—</span>') + '</td>' +
            '<td class="' + (d.proStueck >= 0 ? 'pos' : 'neg') + '"><b>' + F.sg(d.proStueck) + '</b></td>' +
            '<td class="' + (d.marge >= 0 ? 'pos' : 'neg') + '">' + F.pct(d.marge) + '</td>' +
            '<td class="mut">' + (isFinite(d.jeFokus) ? F.sg(d.jeFokus) : '<span class="faint">—</span>') +
            '</td></tr>';
        }).join('') : '<tr><td colspan="14" class="t-empty">' +
          (nurStufe && passt.length
            ? 'Auf Stufe T' + nurStufe + ' erfüllt nichts die Filter – auf anderen Stufen schon (' +
              passt.length + ').'
            : S.onlyProfit && lohnt === 0
              ? 'Gerade lohnt sich nichts. Anderen Verkaufsort probieren – oder den Haken ' +
                '„nur mit Gewinn“ entfernen.'
              : 'Nichts gefunden, das die Filter erfüllt.') + '</td></tr>';
      }

      el.info.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-tier]'); if (!b) return;
        S.tier = S.tier === b.dataset.tier ? '0' : b.dataset.tier; S.$save();
        U.segSet(el.tierSeg.firstChild, S.tier);
        render();
      });
    }
  };
})();
