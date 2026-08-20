/* Aufwertungs-Rechner: fertige Gegenstände mit Runen, Seelen und Relikten
   auf eine höhere Verzauberungsstufe bringen und mit Gewinn weiterverkaufen.

   Typischer Fall: Am Schwarzmarkt ist eine .2-Waffe gefragt. Du kaufst die
   .0-Fassung günstig, kaufst Runen und Seelen dazu, wertest auf, verkaufst.

   Aus den Spieldaten belegt:
     .0 -> .1  Runen      .1 -> .2  Seelen      .2 -> .3  Relikte
   Die Menge hängt am Gegenstand (Schwert 288, Bogen 384, Helm 96 …) und ist
   über alle Tiers und Stufen gleich. Aufwerten kostet kein Silber - es fallen
   nur Materialkosten sowie Markt-Steuer und -Gebühren an.
   Eine Stufe .4 lässt sich nicht aufwerten; dafür gibt es kein Rezept.
   Werkzeuge und T2/T3-Ausrüstung haben gar keine Verzauberung und fehlen
   deshalb bewusst in der Auswahl. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  var MAT = ['RUNE', 'SOUL', 'RELIC'];
  var MAT_DE = { RUNE: 'Runen', SOUL: 'Seelen', RELIC: 'Relikte' };

  var S = AO.store.bind('upgrade', {
    cat: 'sword', tier: 4, item: 'T4_MAIN_SWORD',
    from: 0, to: 2, quality: 1, count: 1,
    buyCity: 'Caerleon', sellCity: 'Black Market', matCity: 'Caerleon',
    sort: 'profit', scope: 'all', minProfit: 0, onlyProfit: true,
    minSold: 1, histDays: 21, allQual: true, maxAge: '24',
    basis: 'markt', maxUeber: 2, scanTier: '0', paths: [],
    guild: false, guildPct: 15
  });

  /* Alle sechs Aufwertungswege. Leere Auswahl heisst "alle" - so bleibt die
     bisherige Suche unveraendert, solange nichts angeklickt wird. */
  var PATHS = [];
  for (var pf = 0; pf <= 2; pf++) {
    for (var pt = pf + 1; pt <= 3; pt++) PATHS.push({ from: pf, to: pt });
  }
  PATHS.forEach(function (p) { p.k = p.from + '-' + p.to; p.n = '.' + p.from + ' → .' + p.to; });

  /* Stufenfilter der Trefferliste. Er greift NACH der Suche: gesucht wird
     weiterhin alles, angezeigt wird die gewaehlte Stufe. So bleibt der
     Gesamtueberblick erhalten und das Umschalten kostet keine neue Suche. */
  var TIERS = [{ v: '0', n: 'Alle Stufen' }].concat(
    [4, 5, 6, 7, 8].map(function (t) { return { v: String(t), n: 'T' + t }; }));

  /* Wie alt darf der juengste Scan eines Preises hoechstens sein? */
  var AGES = [
    { v: '0',  n: 'Alter egal' },
    { v: '48', n: 'max. 2 Tage' },
    { v: '24', n: 'max. 24 Std.' },
    { v: '8',  n: 'max. 8 Std.' },
    { v: '3',  n: 'max. 3 Std.' }
  ];

  /* SCAN haelt nur die gefundenen Wege (Gegenstand + von/nach). Gerechnet
     wird erst beim Anzeigen - so schlagen Aenderungen an Stadt, Qualitaet,
     Kaufart oder eigenen Preisen sofort durch, ohne neu zu laden.
     CACHE verhindert, dass tausende Wege bei jedem Rendern neu durchgerechnet
     werden, solange sich an den Annahmen nichts geaendert hat. */
  var SCAN = null, SKIPPED = 0, VERALTET = 0, PHANTOM = 0, CACHE = null;

  /* Waehrend der Vorauswahl rechnet calc() bewusst OHNE Gildenpreis.
     Grund: der Gildenpreis haengt am Marktwert, der Marktwert kommt aus den
     Handelsdaten - und die werden erst fuer die aussichtsreichen Wege
     geladen. Wer in der Vorauswahl schon den Marktwert verlangt, findet
     nichts, laedt nichts und bleibt bei null Treffern stehen.
     Deshalb wird vorab mit dem Marktpreis OHNE Abgaben gerechnet: eine
     Obergrenze fuer jeden denkbaren Direktverkauf. Wer die nicht schafft,
     schafft auch den Gildenpreis nicht. */
  var VORAUSWAHL = false;

  function pool() {
    return AO.data.items.filter(function (i) { return AO.data.upgrade[i.id]; });
  }
  function find(id) {
    var l = pool();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }
  function upData(id) { return AO.data.upgrade[id] || null; }

  AO.views.upgrade = {
    id: 'upgrade',
    title: 'Aufwertungs-Rechner',
    subtitle: 'Waffen und Rüstung mit Runen, Seelen und Relikten hochstufen',

    html: function () {
      return '' +
      '<div class="split">' +
        '<div class="card">' +
          '<div class="fieldset"><h4>Gegenstand</h4>' +
            '<div class="field stack"><label>Kategorie</label><select data-x="cat"></select></div>' +
            '<div class="field stack"><label>Stufe</label><div data-x="tierSeg"></div></div>' +
            '<div class="field stack"><label>Gegenstand</label>' +
              '<div class="picker"><input data-x="search" placeholder="suchen oder anklicken…" autocomplete="off" spellcheck="false">' +
                '<div class="picker-list" data-x="list" hidden></div></div>' +
              '<div class="hint" data-x="chosen"></div>' +
            '</div>' +
            '<div class="field stack"><label>Von Stufe</label><div data-x="fromSeg"></div></div>' +
            '<div class="field stack"><label>Auf Stufe</label><div data-x="toSeg"></div></div>' +
            '<div class="field stack"><label>Qualität</label><select data-x="quality"></select>' +
              '<div class="hint">Die Qualität bleibt beim Aufwerten erhalten – gekauft und verkauft ' +
              'wird dieselbe Stufe.</div></div>' +
            '<div class="field"><span class="lbl w">Anzahl</span><input class="num" data-x="count" inputmode="numeric">' +
              '<span class="mut">Stück</span></div>' +
          '</div>' +
          '<div class="fieldset"><h4>Wo gehandelt wird</h4>' +
            '<div class="field"><span class="lbl w">Gegenstand</span><select data-x="buyCity"></select></div>' +
            '<div class="field"><span class="lbl w">Material</span><select data-x="matCity"></select></div>' +
            '<div class="field"><span class="lbl w">Verkauf</span><select data-x="sellCity"></select></div>' +
            '<div class="field stack"><label>Einkauf über</label><div data-x="buySeg"></div></div>' +
            '<div class="field stack"><label>Verkauf über</label><div data-x="sellSeg"></div></div>' +
            '<label class="field check"><input type="checkbox" data-x="premium"> Premium</label>' +
          '</div>' +
          '<div class="fieldset"><h4>Gildenverkauf</h4>' +
            '<label class="field check" title="Direkter Handel mit einem Gildenmitglied: ' +
              'keine Verkaufssteuer, keine Ordergebühr. Der Preis ergibt sich aus dem ' +
              'Marktwert abzüglich des Rabatts.">' +
              '<input type="checkbox" data-x="guild"> An Gilde verkaufen (direkt)</label>' +
            '<div class="field"><span class="lbl w">Rabatt</span>' +
              '<input class="num" data-x="guildPct" inputmode="decimal"><span class="mut">%</span></div>' +
            '<div class="hint" data-x="guildHint"></div>' +
          '</div>' +
        '</div>' +

        '<div>' +
          '<div class="view-toolbar">' +
            '<button class="btn primary" data-x="load"><span class="spin">⟳</span> Marktpreise laden</button>' +
            '<span class="mut" data-x="stamp"></span>' +
          '</div>' +
          '<div class="chips" data-x="chips" style="margin-bottom:var(--s4)"></div>' +
          '<div class="notice warn" data-x="bmNote" style="margin-bottom:var(--s4)" hidden></div>' +
          '<div data-x="notice"></div>' +
          '<div class="grid cols-4" data-x="stats" style="margin-bottom:var(--s4)"></div>' +

          /* ---------- Flip-Übersicht ---------- */
          '<div class="card" data-fold="flip" style="margin-bottom:var(--s4)">' +
            '<div class="card-head"><h3>Welcher Flip lohnt sich gerade?</h3>' +
              '<div class="right">' +
                '<div data-x="scopeSeg"></div>' +
                '<div data-x="sortSeg"></div>' +
                '<button class="btn sm primary" data-x="scan"><span class="spin">⟳</span> Suchen</button>' +
              '</div></div>' +
            '<div class="filterbar">' +
              '<div data-x="pathSeg" class="chips" ' +
                'title="Welche Aufwertungswege in der Liste stehen. Mehrfachauswahl; ' +
                'nichts ausgewählt bedeutet alle. Gesucht wird immer alles."></div>' +
              '<div data-x="scanTierSeg" title="Zeigt nur eine Stufe an. Gesucht wird trotzdem ' +
                'weiterhin alles - der Filter blendet nur um, ohne neue Suche."></div>' +
              '<label class="field check" style="margin:0"><input type="checkbox" data-x="onlyProfit"> ' +
                'nur Wege mit Gewinn</label>' +
              '<button class="btn sm ghost" data-x="more">Mehr Filter</button>' +
              '<div class="bar" data-x="bar" style="flex:1;min-width:120px" hidden><i style="width:0"></i></div>' +
            '</div>' +
            '<div class="filterbar sub" data-x="moreBox" hidden>' +
              '<label class="field check" style="margin:0" ' +
                'title="Beim Aufwerten bleibt die Qualität erhalten. Eine Waffe in Gut ist ein ' +
                'ganz anderer Handel als dieselbe in Normal - mit eigenen Preisen auf beiden Seiten.">' +
                '<input type="checkbox" data-x="allQual"> alle Qualitäten</label>' +
              '<label class="mut" style="display:flex;align-items:center;gap:var(--s2)">ab Gewinn ' +
                '<input class="num" data-x="minProfit" inputmode="numeric" style="width:110px"> Silber</label>' +
              '<label class="mut" style="display:flex;align-items:center;gap:var(--s2)" ' +
                'title="Wie viele Stück davon in den letzten drei Wochen tatsächlich den Besitzer ' +
                'gewechselt haben - beim Einkauf wie beim Verkauf. 0 schaltet die Prüfung ab.">' +
                'mind. <input class="num" data-x="minSold" inputmode="decimal" style="width:70px"> ' +
                'verkauft/Tag</label>' +
              '<div data-x="basisSeg" title="Womit gerechnet wird: mit dem aktuell eingestellten ' +
                'Marktpreis oder mit dem Preis, zu dem der Gegenstand zuletzt tatsächlich ' +
                'gehandelt wurde."></div>' +
              '<label class="mut" style="display:flex;align-items:center;gap:var(--s2)" ' +
                'title="Ein einzelnes Fantasieangebot weit über dem erzielten Preis ist keine Chance. ' +
                '0 schaltet die Prüfung ab.">höchstens ' +
                '<input class="num" data-x="maxUeber" inputmode="decimal" style="width:60px">× über erzielt</label>' +

              '<div data-x="ageSeg" title="Ein Preis ist nur so gut wie sein letzter Scan. ' +
                'Wege, bei denen auch nur ein beteiligter Preis aelter ist, erscheinen nicht."></div>' +
            '</div>' +
            '<div class="card-body tight" data-x="scanInfo"></div>' +
            '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
              '<table class="data"><thead><tr>' +
                '<th>Gegenstand</th><th>Kategorie</th><th title="Bleibt beim Aufwerten erhalten">Qualität</th>' +
                '<th>Weg</th><th>Einkauf</th><th>Material</th>' +
                '<th>Kosten / Stück</th>' +
                '<th title="Aktuelles Angebot bzw. aktuelle Kauforder – beim Gildenverkauf ' +
                'der Gildenpreis, also Marktwert abzüglich Rabatt.">Verkauf</th>' +
                '<th title="Mengengewichteter Durchschnitt der Preise, zu denen der Gegenstand in den ' +
                'letzten drei Wochen tatsächlich gehandelt wurde. Weicht der Verkaufspreis stark ' +
                'davon ab, ist er meist ein Fantasieangebot.">zuletzt erzielt</th>' +
                '<th title="Was für diesen Gegenstand in den letzten drei Wochen über ALLE ' +
                'Städte hinweg tatsächlich gezahlt wurde, gewichtet nach Menge - der Gegenwert ' +
                'des Gegenstands unabhängig vom Verkaufsort. Der Schwarzmarkt bleibt draußen: ' +
                'dort kauft das Spiel, nicht ein Spieler.">Marktwert</th>' +
                '<th title="Verkaufte Stück je Tag - links am Einkaufsort, rechts am Verkaufsort. ' +
                'Aus den echten Handelsdaten der letzten drei Wochen.">Umsatz/Tag</th>' +
                '<th title="Alter des aeltesten beteiligten Preises. Je frischer, desto ' +
                'verlaesslicher die Rechnung.">Daten</th>' +
                '<th>Gewinn / Stück</th><th>Marge</th>' +
              '</tr></thead><tbody data-x="scanRows"></tbody></table></div>' +
          '</div>' +

          '<div class="card" style="margin-bottom:var(--s4)">' +
            '<div class="card-head"><h3>Der Weg</h3>' +
              '<div class="right"><span class="mut" data-x="wegNote"></span></div></div>' +
            '<div class="tablewrap" style="border:none;border-radius:0 0 var(--r-lg) var(--r-lg)">' +
              '<table class="data"><thead><tr>' +
                '<th>Schritt</th><th>Material</th>' +
                '<th title="Menge je Gegenstand">je Stück</th><th>gesamt</th>' +
                '<th>Preis</th><th>Kosten</th>' +
              '</tr></thead><tbody data-x="rows"></tbody>' +
              '<tfoot><tr><td colspan="5">Materialkosten</td><td data-x="matTotal">—</td></tr></tfoot>' +
            '</table></div>' +
          '</div>' +

          '<div class="grid cols-2">' +
            '<div class="card"><div class="card-head"><h3>Kosten</h3></div>' +
              '<div class="card-body" data-x="costBox"></div></div>' +
            '<div class="card"><div class="card-head"><h3>Erlös &amp; Gewinn</h3></div>' +
              '<div class="card-body" data-x="sellBox"></div></div>' +
          '</div>' +

          '<div class="card" style="margin-top:var(--s4)">' +
            '<div class="card-head"><h3>Alle Zielstufen im Vergleich</h3>' +
              '<div class="right"><span class="mut">für den gewählten Gegenstand</span></div></div>' +
            '<div class="tablewrap" style="border:none">' +
              '<table class="data"><thead><tr><th>Ziel</th><th>Einkauf</th><th>Material / Stück</th>' +
              '<th>Kosten / Stück</th><th>Verkauf / Stück</th><th>Gewinn / Stück</th><th>Marge</th>' +
              '</tr></thead><tbody data-x="cmpRows"></tbody></table></div>' +
          '</div>' +

          '<p class="view-footnote">Aufwerten kostet kein Silber und keine Nutzungsgebühr – nur die ' +
          'Materialien. Steuer und Ordergebühren fallen wie üblich beim Kaufen und Verkaufen an. ' +
          'Werkzeuge sowie T2- und T3-Ausrüstung lassen sich im Spiel gar nicht verzaubern und stehen ' +
          'deshalb nicht zur Auswahl.</p>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      /* Am Schwarzmarkt kann man nichts kaufen - er steht nur beim Verkauf
         zur Wahl. */
      U.fill(el.buyCity, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.buyCity);
      if (!AO.craft.canBuyAt(S.buyCity)) { S.buyCity = 'Caerleon'; el.buyCity.value = S.buyCity; S.$save(); }
      U.fill(el.matCity, AO.data.cities.map(function (c) { return { v: c, n: c }; }), S.matCity);
      U.fill(el.sellCity, AO.data.sellLocations, S.sellCity);
      U.fill(el.quality, AO.data.qualities.map(function (q) { return { v: q.q, n: q.label }; }), S.quality);
      el.count.value = S.count;
      el.premium.checked = AO.settings.premium;
      el.guild.checked = S.guild;
      el.guildPct.value = String(S.guildPct).replace('.', ',');
      el.buySeg.innerHTML = U.seg([
        { v: 'instant', n: 'Sofortkauf' },
        { v: 'order', n: 'Kauforder +2,5 %',
          title: 'Gilt nur für Runen, Seelen und Relikte. Der Gegenstand selbst wird ' +
                 'immer sofort gekauft - eine Kauforder auf eine bestimmte Waffe in einer ' +
                 'bestimmten Qualität wird so gut wie nie bedient.' }
      ], AO.settings.buyMethod);
      el.sellSeg.innerHTML = U.seg([{ v: 'order', n: 'Verkaufsorder +2,5 %' }, { v: 'instant', n: 'Sofortverkauf' }], AO.settings.sellMethod);
      el.sortSeg.innerHTML = U.seg([{ v: 'profit', n: 'nach Gewinn' }, { v: 'margin', n: 'nach Marge' }], S.sort);
      el.scopeSeg.innerHTML = U.seg([
        { v: 'all', n: 'Alles', title: 'Jeden aufwertbaren Gegenstand in jeder Stufe' },
        { v: 'cat', n: 'Nur diese Kategorie' }
      ], S.scope);
      el.onlyProfit.checked = S.onlyProfit;
      el.minProfit.value = S.minProfit;
      el.minSold.value = String(S.minSold).replace('.', ',');
      el.allQual.checked = S.allQual;
      el.ageSeg.innerHTML = U.seg(AGES, S.maxAge);
      el.scanTierSeg.innerHTML = U.seg(TIERS, S.scanTier);
      renderPathSeg();
      el.basisSeg.innerHTML = U.seg([
        { v: 'markt', n: 'Marktpreis' }, { v: 'erzielt', n: 'zuletzt erzielt' }
      ], S.basis);
      el.maxUeber.value = String(S.maxUeber).replace('.', ',');

      syncCats(); syncTierSeg(); syncItem(); syncSegs();

      el.cat.addEventListener('change', function () {
        S.cat = el.cat.value; S.$save();
        syncTierSeg(); pickFirst(); SCAN = null; render();
      });
      el.tierSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.tier = +b.dataset.v; S.$save();
        U.segSet(el.tierSeg.firstChild, b.dataset.v);
        pickFirst(); SCAN = null; render();
      });
      el.search.addEventListener('input', U.debounce(showList, 120));
      el.search.addEventListener('focus', showList);
      document.addEventListener('click', function (e) {
        if (!el.search.parentElement.contains(e.target)) el.list.hidden = true;
      });
      el.list.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-id]'); if (!b) return;
        S.item = b.dataset.id;
        var it = find(S.item);
        if (it) { S.cat = it.c; S.tier = it.t; el.cat.value = S.cat; syncTierSeg(); }
        S.$save();
        el.search.value = ''; el.list.hidden = true;
        render();
      });
      el.fromSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.from = +b.dataset.v;
        if (S.to <= S.from) S.to = Math.min(S.from + 1, 3);
        S.$save(); syncSegs(); render();
      });
      el.toSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b || b.disabled) return;
        S.to = +b.dataset.v; S.$save(); syncSegs(); render();
      });
      ['buyCity', 'matCity', 'sellCity'].forEach(function (k) {
        el[k].addEventListener('change', function () { S[k] = el[k].value; S.$save(); render(); });
      });
      el.quality.addEventListener('change', function () { S.quality = +el.quality.value; S.$save(); render(); });
      el.count.addEventListener('input', function () {
        var v = F.parse(el.count.value); S.count = v === null ? 0 : v; S.$save(); renderNumbers();
      });
      el.premium.addEventListener('change', function () {
        AO.settings.premium = el.premium.checked; AO.settings.$save(); render();
      });
      el.buySeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        AO.settings.buyMethod = b.dataset.v; AO.settings.$save();
        U.segSet(el.buySeg.firstChild, b.dataset.v); render();
      });
      el.sellSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        AO.settings.sellMethod = b.dataset.v; AO.settings.$save();
        U.segSet(el.sellSeg.firstChild, b.dataset.v); render();
      });
      el.sortSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.sort = b.dataset.v; S.$save(); U.segSet(el.sortSeg.firstChild, b.dataset.v); renderScan();
      });
      el.scopeSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.scope = b.dataset.v; S.$save(); U.segSet(el.scopeSeg.firstChild, b.dataset.v);
        SCAN = null; renderScan();
      });
      el.onlyProfit.addEventListener('change', function () {
        S.onlyProfit = el.onlyProfit.checked; S.$save(); renderScan();
      });
      el.allQual.addEventListener('change', function () {
        S.allQual = el.allQual.checked; S.$save();
        SCAN = null; CACHE = null; renderScan();
      });
      el.basisSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.basis = b.dataset.v; S.$save();
        U.segSet(el.basisSeg.firstChild, b.dataset.v);
        CACHE = null; render();
      });
      el.maxUeber.addEventListener('input', U.debounce(function () {
        var v = parseFloat(String(el.maxUeber.value).replace(',', '.'));
        S.maxUeber = isFinite(v) && v >= 0 ? v : 0; S.$save(); CACHE = null; renderScan();
      }, 200));
      /* Die Zahlen in der Infozeile sind zugleich Schalter - kuerzester Weg
         von "wo lohnt es sich" zu "zeig es mir". */
      el.scanInfo.addEventListener('click', function (e) {
        if (e.target.closest('[data-tier-basis]')) {
          S.basis = 'erzielt'; S.$save();
          U.segSet(el.basisSeg.firstChild, 'erzielt');
          CACHE = null; render(); return;
        }
        var b = e.target.closest('button[data-tier]'); if (!b) return;
        S.scanTier = S.scanTier === b.dataset.tier ? '0' : b.dataset.tier; S.$save();
        U.segSet(el.scanTierSeg.firstChild, S.scanTier);
        renderScan();
      });
      el.pathSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-p]'); if (!b) return;
        var k = b.dataset.p;
        if (k === 'all') S.paths = [];
        else if (S.paths.indexOf(k) >= 0) S.paths = S.paths.filter(function (x) { return x !== k; });
        else S.paths = S.paths.concat([k]);
        S.$save(); renderPathSeg(); renderScan();
      });
      el.scanTierSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.scanTier = b.dataset.v; S.$save();
        U.segSet(el.scanTierSeg.firstChild, b.dataset.v);
        renderScan();
      });
      el.ageSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        S.maxAge = b.dataset.v; S.$save();
        U.segSet(el.ageSeg.firstChild, b.dataset.v);
        CACHE = null; renderScan();
      });
      el.minProfit.addEventListener('input', U.debounce(function () {
        var v = F.parse(el.minProfit.value); S.minProfit = v === null ? 0 : v; S.$save(); renderScan();
      }, 200));
      el.minSold.addEventListener('input', U.debounce(function () {
        var v = parseFloat(String(el.minSold.value).replace(',', '.'));
        S.minSold = isFinite(v) && v >= 0 ? v : 0; S.$save(); renderScan();
      }, 200));
      el.guild.addEventListener('change', function () {
        S.guild = el.guild.checked; S.$save(); CACHE = null; render();
      });
      el.guildPct.addEventListener('input', U.debounce(function () {
        var v = parseFloat(String(el.guildPct.value).replace(',', '.'));
        S.guildPct = isFinite(v) ? Math.min(Math.max(v, 0), 100) : 0;
        S.$save(); CACHE = null;
        U.keepFocus(root, function () { renderNumbers(); renderScan(); });
      }, 200));
      el.load.addEventListener('click', loadPrices);
      el.scan.addEventListener('click', runScan);
      /* Die feineren Filter bleiben eingeklappt, bis jemand sie holt. */
      (function () {
        var offen = AO.store.get('upgrade.more', false);
        function sync() {
          el.moreBox.hidden = !offen;
          el.more.textContent = offen ? 'Weniger Filter' : 'Mehr Filter';
          el.more.classList.toggle('on', offen);
        }
        sync();
        el.more.addEventListener('click', function () {
          offen = !offen; AO.store.set('upgrade.more', offen); sync();
        });
      })();

      root.addEventListener('input', function (e) {
        var i = e.target.closest('.pinput'); if (!i) return;
        AO.market.setOwn(i.dataset.id, i.dataset.city, +(i.dataset.q || 1), i.dataset.side, F.parse(i.value));
        i.classList.toggle('own', AO.market.isOwn(i.dataset.id, i.dataset.city, +(i.dataset.q || 1), i.dataset.side));
        /* Kosten- und Erloeskasten werden neu gebaut - dabei darf das gerade
           bearbeitete Feld nicht unter den Fingern verschwinden. */
        U.keepFocus(root, renderNumbers);
        /* Ein eingetragener Relikt- oder Seelenpreis aendert nicht nur die
           Detailrechnung, sondern jeden Weg in der Flip-Liste darunter.
           Beide Aufbauten lassen die Eingabefelder unberuehrt. */
        flipNach();
      });
      var flipNach = U.debounce(function () {
        if (!document.contains(root) || root.hidden) return;
        CACHE = null; renderScan();
      }, 250);
      U.onPrices(root, function () { CACHE = null; renderNumbers(); renderScan(); });
      root.addEventListener('click', function (e) {
        var b = e.target.closest('.reset');
        if (b) {
          AO.market.setOwn(b.dataset.id, b.dataset.city, +(b.dataset.q || 1), b.dataset.side, null);
          render(); return;
        }
        if (e.target.closest('[data-x="toErzielt"]')) {
          S.basis = 'erzielt'; S.$save();
          U.segSet(el.basisSeg.firstChild, 'erzielt');
          CACHE = null; render(); return;
        }
        if (e.target.closest('[data-x="toBM"]')) {
          AO.settings.sellMethod = 'instant'; AO.settings.$save();
          U.segSet(el.sellSeg.firstChild, 'instant'); render(); return;
        }
        var row = e.target.closest('[data-flip]');
        /* Wer gerade einen Namen markiert hat, wollte nicht die Zeile
           anklicken - Markierung schlaegt Klick. */
        if (row && !U.hasSelection()) {
          var p = row.dataset.flip.split('|');
          S.item = p[0]; S.from = +p[1]; S.to = +p[2];
          if (p[3]) { S.quality = +p[3]; el.quality.value = S.quality; }
          var it = find(S.item);
          if (it) { S.cat = it.c; S.tier = it.t; el.cat.value = S.cat; syncTierSeg(); }
          S.$save(); syncSegs(); render();
          U.scrollIntoViewIfNeeded(root.querySelector('[data-x="rows"]'));
        }
      });
      document.addEventListener('ao:server', function () {
        if (document.contains(root)) { SCAN = null; CACHE = null; render(); }
      });
      /* Premium, Kauf- und Verkaufsart stehen global - werden sie anderswo
         geaendert, muessen Haken, Schalter und Zahlen hier nachziehen. */
      document.addEventListener('ao:settings', function () {
        if (!document.contains(root)) return;
        el.premium.checked = AO.settings.premium;
        U.segSet(el.buySeg.firstChild, AO.settings.buyMethod);
        U.segSet(el.sellSeg.firstChild, AO.settings.sellMethod);
        CACHE = null;
        render();
      });

      render();

      /* ================================================================== */
      /* Der Gegenstand selbst wird IMMER sofort gekauft. Eine Kauforder auf
         eine bestimmte Waffe in einer bestimmten Qualitaet wird so gut wie nie
         bedient - man wartet Tage und bekommt nichts. Die Einstellung
         "Kauforder" gilt deshalb nur fuer Runen, Seelen und Relikte: Massenware,
         die staendig durchlaeuft und auf die man tatsaechlich bieten kann. */
      function itemSide() { return 'sell'; }
      function matSide()  { return AO.craft.buySide(AO.settings.buyMethod); }
      function matOrder() { return AO.settings.buyMethod === 'order'; }
      function sellSide() { return AO.craft.sellSideAt(S.sellCity, AO.settings.sellMethod); }
      function baseId(item, lvl) { return lvl > 0 ? item.id + '@' + lvl : item.id; }

      function cats() {
        var seen = {};
        pool().forEach(function (i) { seen[i.c] = 1; });
        return Object.keys(seen).sort(function (a, b) {
          return (AO.data.categories.catDe[a] || a).localeCompare(AO.data.categories.catDe[b] || b, 'de');
        });
      }
      function syncCats() {
        var list = cats();
        if (!S.cat || list.indexOf(S.cat) < 0) S.cat = list[0];
        U.fill(el.cat, list.map(function (c) {
          return { v: c, n: (AO.data.categories.catDe[c] || c) };
        }), S.cat);
      }
      function syncTierSeg() {
        var t = {};
        pool().forEach(function (i) { if (i.c === S.cat) t[i.t] = 1; });
        var tiers = Object.keys(t).map(Number).sort(function (a, b) { return a - b; });
        if (tiers.length && tiers.indexOf(S.tier) < 0) S.tier = tiers[0];
        el.tierSeg.innerHTML = U.seg(tiers.map(function (x) {
          return { v: String(x), n: 'T' + x };
        }), String(S.tier));
      }
      function inCat() {
        return pool().filter(function (i) { return i.c === S.cat && i.t === S.tier; });
      }
      function pickFirst() {
        var l = inCat();
        if (l.length && !l.some(function (i) { return i.id === S.item; })) S.item = l[0].id;
        S.$save();
      }
      function syncItem() {
        if (!find(S.item)) pickFirst();
        var it = find(S.item);
        if (it) { S.cat = it.c; S.tier = it.t; }
      }

      function syncSegs() {
        el.fromSeg.innerHTML = U.seg([0, 1, 2].map(function (v) {
          return { v: String(v), n: v ? '.' + v : 'Normal' };
        }), String(S.from));
        el.toSeg.innerHTML = U.seg([1, 2, 3].map(function (v) {
          return { v: String(v), n: '.' + v };
        }), String(S.to));
        U.qa('button', el.toSeg).forEach(function (b) {
          if (+b.dataset.v <= S.from) { b.disabled = true; b.title = 'Muss über der Ausgangsstufe liegen'; }
        });
      }

      function showList() {
        var term = el.search.value.trim().toLowerCase();
        var hits = (term
          ? pool().filter(function (i) {
              return i.n.toLowerCase().indexOf(term) >= 0 || i.id.toLowerCase().indexOf(term) >= 0;
            })
          : inCat()).slice(0, 80);
        el.list.innerHTML = hits.length ? hits.map(function (i) {
          return '<button data-id="' + F.esc(i.id) + '">' + F.img(i.id, 56, i.n) +
            '<span class="nm">' + F.esc(i.n) + '</span>' +
            '<span class="meta">T' + i.t + ' · ' + F.esc(AO.data.categories.catDe[i.c] || i.c) + '</span></button>';
        }).join('') : '<div class="t-empty">Nichts gefunden</div>';
        el.list.hidden = false;
      }

      function steps(item, from, target) {
        var u = upData(item.id);
        if (!u) return [];
        var out = [];
        for (var lvl = from + 1; lvl <= target; lvl++) {
          if (lvl < 1 || lvl > 3) continue;
          out.push({ level: lvl, matId: 'T' + u[3] + '_' + MAT[lvl - 1],
                     kind: MAT[lvl - 1], count: u[lvl - 1] });
        }
        return out;
      }

      /* Kalkulation für beliebigen Gegenstand und Weg */
      function calc(it, from, target, n, q) {
        n = (n === undefined) ? (S.count || 0) : n;
        /* Beim Aufwerten bleibt die Qualitaet erhalten - dieselbe Stufe wird
           gekauft und verkauft. */
        q = q || S.quality;
        var missing = [];
        /* Alter des aeltesten beteiligten Preises - ein Weg ist nur so
           verlaesslich wie sein schlechtester Datenpunkt. Selbst eingetragene
           Preise gelten als frisch. */
        var alter = 0;
        function merkeAlter(id2, city2, q2, side2) {
          if (AO.market.isOwn(id2, city2, q2, side2)) return;
          var d2 = AO.market.date(id2, city2, q2, side2);
          var h = d2 ? (Date.now() - d2.getTime()) / 3600000 : Infinity;
          if (h > alter) alter = h;
        }
        var basePrice = AO.market.get(baseId(it, from), S.buyCity, q, itemSide());
        merkeAlter(baseId(it, from), S.buyCity, q, itemSide());
        if (basePrice === null || basePrice === undefined) missing.push('Einkauf .' + from);
        var baseCost = n * (basePrice || 0);

        var matRows = [], matTotal = 0;
        steps(it, from, target).forEach(function (s) {
          var p = AO.market.get(s.matId, S.matCity, 1, matSide());
          merkeAlter(s.matId, S.matCity, 1, matSide());
          if (p === null || p === undefined) missing.push(AO.craft.matName(s.matId));
          var total = s.count * n;
          var cost = total * (p || 0);
          matTotal += cost;
          matRows.push({ level: s.level, id: s.matId, kind: s.kind, per: s.count,
                         total: total, price: p, cost: cost });
        });

        /* Die Einstellgebuehr faellt nur dort an, wo ueberhaupt eine Order
           gestellt wird - also auf das Material, nicht auf den Gegenstand. */
        var orderBuy = matOrder() ? matTotal * AO.data.consts.orderFee : 0;
        var costTotal = baseCost + matTotal + orderBuy;

        var sellId = baseId(it, target);
        var listed = AO.market.get(sellId, S.sellCity, q, sellSide());
        var erzielt = AO.market.avgPrice(sellId, S.sellCity, q);
        /* Wahlweise mit dem tatsaechlich erzielten Preis rechnen. Er ist die
           ehrlichere Grundlage: ein Angebot sagt nur, was jemand verlangt. */
        /* Marktwert des Gegenstands, den man VERKAUFT: was ueber alle Staedte
           hinweg tatsaechlich dafuer gezahlt wurde. Er sagt, ob der Preis am
           gewaehlten Verkaufsort ueber- oder unterdurchschnittlich ist. */
        var mw = AO.market.emv(sellId, q);
        /* In einer Stadt konkurriert man mit dem guenstigsten Angebot: wer
           darueber einstellt, verkauft nicht, sondern wartet. Der zuletzt
           erzielte Durchschnitt darf deshalb nie ueber dem aktuellen Angebot
           liegen - sonst rechnet man mit einem Preis, den heute niemand mehr
           zahlt. Am Schwarzmarkt gilt das NICHT: dort ist "listed" die
           Kauforder des Spiels, kein konkurrierendes Angebot. */
        var marktPreis;
        if (S.basis === 'erzielt' && erzielt) {
          marktPreis = (S.sellCity !== AO.data.blackMarket && listed && listed < erzielt)
            ? listed : erzielt;
        } else {
          marktPreis = listed;
        }
        merkeAlter(sellId, S.sellCity, q, sellSide());

        /* Was der Marktweg netto bringt - er bleibt der Massstab, auch wenn
           an die Gilde verkauft wird. */
        var marktBrutto = n * (marktPreis || 0);
        var marktNetto = marktBrutto * AO.craft.sellMultiplierAt(
          S.sellCity, AO.settings.premium, AO.settings.sellMethod);

        var sellPrice, gross, tax, orderSell;
        if (S.guild && VORAUSWAHL) {
          /* Obergrenze: voller Marktpreis, keine Abgaben. */
          sellPrice = marktPreis;
          if (sellPrice === null || sellPrice === undefined) missing.push('Verkauf .' + target);
          gross = n * (sellPrice || 0);
          tax = 0; orderSell = 0;
        } else if (S.guild) {
          /* Direkter Handel zwischen Spielern: keine Verkaufssteuer, keine
             Ordergebuehr. Der Preis haengt allein am Marktwert. */
          sellPrice = mw ? mw.value * (1 - (S.guildPct || 0) / 100) : null;
          if (sellPrice === null) missing.push('Marktwert .' + target);
          gross = n * (sellPrice || 0);
          tax = 0; orderSell = 0;
        } else {
          sellPrice = marktPreis;
          if (sellPrice === null || sellPrice === undefined) missing.push('Verkauf .' + target);
          gross = n * (sellPrice || 0);
          tax = gross * (AO.settings.premium ? AO.data.consts.taxPremium : AO.data.consts.taxNormal);
          orderSell = gross * AO.craft.sellOrderFeeAt(S.sellCity, AO.settings.sellMethod);
        }
        var net = gross - tax - orderSell;
        var profit = net - costTotal;

        return { n: n, basePrice: basePrice, baseCost: baseCost, matRows: matRows,
                 matTotal: matTotal, orderBuy: orderBuy, costTotal: costTotal,
                 sellPrice: sellPrice, gross: gross, tax: tax, orderSell: orderSell,
                 net: net, profit: profit, perItem: n ? profit / n : NaN,
                 margin: costTotal ? profit / costTotal * 100 : NaN, missing: missing, q: q,
                 age: alter, listed: listed, erzielt: erzielt,
                 marktwert: mw ? mw.value : null, marktwertMenge: mw ? mw.sold : 0,
                 marktwertEigen: !!(mw && mw.own),
                 marktPreis: marktPreis, marktNetto: marktNetto };
      }

      /* ---------------------------------------------------- Preise laden */
      function idsFor(list) {
        var ids = [];
        list.forEach(function (it) {
          for (var l = 0; l <= 3; l++) ids.push(baseId(it, l));
          var u = upData(it.id);
          if (u) for (var k = 0; k < 3; k++) ids.push('T' + u[3] + '_' + MAT[k]);
        });
        return ids;
      }

      function loadPrices() {
        var it = find(S.item); if (!it) return;
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(idsFor([it]), [1, 2, 3, 4, 5])
          .then(function () { U.toast('Marktpreise aktualisiert', 'ok'); })
          .catch(function (e) { U.toast('Laden fehlgeschlagen: ' + e.message, 'err'); })
          .then(function () { el.load.classList.remove('loading'); el.load.disabled = false; render(); });
      }

      /* ---------------------------------------------------- Flip-Suche */
      function runScan() {
        var list = (S.scope === 'all') ? pool() : inCat();
        if (!list.length) return;
        el.scan.classList.add('loading'); el.scan.disabled = true;
        el.bar.hidden = false;
        var bar = el.bar.firstElementChild;
        bar.style.width = '0';
        el.scanInfo.innerHTML = '<span class="mut">Lade Preise für ' + list.length + ' Gegenstände…</span>';
        /* Runen, Seelen und Relikte gibt es nur in Normalqualitaet: neben der
           gewaehlten Qualitaet immer auch q=1 laden, sonst findet calc() fuer
           das Material nie einen Preis. */
        /* Materialpreise gibt es nur in Normalqualitaet - die muss immer mit.
           Bei "alle Qualitaeten" holen wir gleich das ganze Feld. */
        var qList = S.allQual ? [1, 2, 3, 4, 5] : (S.quality === 1 ? [1] : [S.quality]);
        var qs = S.allQual ? [1, 2, 3, 4, 5] : (S.quality === 1 ? [1] : [S.quality, 1]);
        AO.market.load(idsFor(list), qs, function (done, total) {
          bar.style.width = Math.round(done / total * 100) + '%';
          el.scanInfo.innerHTML = '<span class="mut">Lade Preise… Block ' + done + ' von ' + total + '</span>';
        })
          .then(function () {
            /* Erst rechnen, dann nachsehen, was sich handeln laesst.
               Handelsdaten sind um ein Vielfaches umfangreicher als Preise
               (mit allen Qualitaeten ueber 100 MB fuer den ganzen Bestand),
               deshalb holen wir sie NUR fuer die Wege, die ueberhaupt Gewinn
               versprechen - das sind ein paar hundert statt fuenftausend. */
            SCAN = [];
            list.forEach(function (it) {
              for (var from = 0; from <= 2; from++) {
                for (var to = from + 1; to <= 3; to++) {
                  for (var qi = 0; qi < qList.length; qi++) {
                    SCAN.push({ it: it, from: from, to: to, q: qList[qi] });
                  }
                }
              }
            });
            CACHE = null;

            VORAUSWAHL = true; CACHE = null;
            var kandidaten = scanRows()
              .filter(function (x) { return x.d.perItem > 0; })
              .sort(function (a, b) { return b.d.perItem - a.d.perItem; })
              .slice(0, 400);
            VORAUSWAHL = false; CACHE = null;
            if (!kandidaten.length) return null;

            var brauchen = {};
            kandidaten.forEach(function (x) {
              brauchen[baseId(x.it, x.from)] = 1;
              brauchen[baseId(x.it, x.to)] = 1;
            });
            var histIds = Object.keys(brauchen);
            el.scanInfo.innerHTML = '<span class="mut">Prüfe für ' + kandidaten.length +
              ' aussichtsreiche Wege, ob sie sich überhaupt handeln lassen…</span>';
            return AO.market.loadHistory(histIds, qs, S.histDays, function (done, total) {
              bar.style.width = Math.round(done / total * 100) + '%';
              el.scanInfo.innerHTML = '<span class="mut">Handelsdaten… Block ' + done +
                ' von ' + total + '</span>';
            }, { chunk: 40, concurrency: 4 });
          })
          .catch(function (e) { U.toast('Handelsdaten unvollständig: ' + e.message, 'err'); })
          .then(function () {
            el.scan.classList.remove('loading'); el.scan.disabled = false;
            el.bar.hidden = true;
            CACHE = null;
            renderScan();
            var gut = scanRows().filter(function (x) { return x.d.perItem > 0; }).length;
            U.toast(gut + ' Wege mit Gewinn gefunden', gut ? 'ok' : 'info');
          });
      }

      /* Alles, was das Ergebnis beeinflusst - aendert sich davon etwas, wird
         neu gerechnet (aber nicht neu geladen). */
      function qName(q) {
        var e = AO.data.qualities.filter(function (x) { return x.q === q; })[0];
        return e ? e.label : ('Q' + q);
      }

      function scanSig() {
        return [S.quality, S.buyCity, S.matCity, S.sellCity, AO.settings.buyMethod,
                AO.settings.sellMethod, AO.settings.premium ? 1 : 0,
                AO.market.stamp(), AO.market.rev(),
                AO.market.hasHistory() ? 1 : 0, S.allQual ? 1 : 0, S.maxAge,
                S.basis, S.maxUeber, S.guild ? 1 : 0, S.guildPct].join('|');
      }

      function scanRows() {
        if (!SCAN) return [];
        var sig = scanSig();
        if (CACHE && CACHE.sig === sig) return CACHE.rows;
        var rows = [];
        SKIPPED = 0; VERALTET = 0; PHANTOM = 0;
        var grenzAlter = parseFloat(S.maxAge) > 0 ? parseFloat(S.maxAge) : Infinity;
        SCAN.forEach(function (x) {
          var q = x.q || S.quality;
          var d = calc(x.it, x.from, x.to, 1, q);
          if (d.missing.length || !isFinite(d.margin)) { SKIPPED++; return; }
          if (d.age > grenzAlter) { VERALTET++; return; }
          /* Angebote weit ueber dem tatsaechlich erzielten Preis aussortieren -
             sie kommen nie zustande. Nur pruefbar, wo Handelsdaten vorliegen. */
          if (!S.guild && S.basis === 'markt' && S.maxUeber > 0 && d.erzielt &&
              d.listed > d.erzielt * S.maxUeber) { PHANTOM++; return; }
          /* Handelbarkeit an BEIDEN Enden, jeweils in genau dieser Qualitaet:
             die Ausgangsstufe muss zu kaufen sein, die Zielstufe muss jemand
             abnehmen. */
          var kauf = AO.market.soldPerDay(baseId(x.it, x.from), S.buyCity, q);
          var verk = AO.market.soldPerDay(baseId(x.it, x.to), S.sellCity, q);
          rows.push({ it: x.it, from: x.from, to: x.to, q: q, d: d,
                      soldBuy: kauf, soldSell: verk, sold: Math.min(kauf, verk) });
        });
        CACHE = { sig: sig, rows: rows };
        return rows;
      }

      function renderPathSeg() {
        var alle = !S.paths.length;
        el.pathSeg.innerHTML =
          '<button class="chip' + (alle ? ' ok' : '') + '" data-p="all" ' +
            'title="Alle sechs Wege anzeigen">Alle Wege</button>' +
          PATHS.map(function (p) {
            var an = S.paths.indexOf(p.k) >= 0;
            return '<button class="chip' + (an ? ' ok' : '') + '" data-p="' + p.k + '" ' +
              'title="' + p.n + ' ' + (an ? 'ausblenden' : 'einblenden') + '">' + p.n + '</button>';
          }).join('');
      }

      function renderScan() {
        if (!SCAN) {
          el.scanInfo.innerHTML = '<span class="mut">' + (S.scope === 'all'
            ? 'Durchsucht <b>alle ' + pool().length + ' aufwertbaren Gegenstände</b> in jeder Stufe und ' +
              'jedem Weg (.0→.1 bis .2→.3). Rund 25 Preisabfragen, dauert ein paar Sekunden.'
            : 'Durchsucht <b>' + F.esc(AO.data.categories.catDe[S.cat] || S.cat) + ' · T' + S.tier +
              '</b> in jedem Weg.') +
            ' Danach wird geprüft, was sich davon überhaupt handeln lässt: ' +
            'ein Angebot, das seit Wochen niemand kauft, taucht nicht auf. ' +
            'Zu alte Preise fliegen ebenfalls raus - ein Scan von vorgestern sagt nichts \u00fcber heute. ' +
            'Verkaufsort, Steuern und Kaufart kommen aus den Einstellungen links.</span>';
          el.scanRows.innerHTML = '<tr><td colspan="14" class="t-empty">Noch nicht gesucht.</td></tr>';
          return;
        }
        var alle = scanRows();
        var grenze = Math.max(0, S.minProfit || 0);
        var mindest = S.minSold || 0;
        var nurStufe = S.scanTier !== '0' ? +S.scanTier : 0;
        /* Erst alle uebrigen Filter, dann die Stufe. Nur so zaehlt die
           Aufschluesselung darunter das, was beim Umschalten wirklich
           erscheint - sonst verspraeche sie Treffer, die der Mindestgewinn
           laengst aussortiert hat. */
        var nurWege = S.paths.length ? S.paths : null;
        var passt = alle.filter(function (x) {
          if (nurWege && nurWege.indexOf(x.from + '-' + x.to) < 0) return false;
          if (S.onlyProfit && !(x.d.perItem > 0)) return false;
          if (grenze > 0 && x.d.perItem < grenze) return false;
          /* Nur pruefen, wenn Handelsdaten vorliegen - sonst wuerde der Filter
             alles wegwerfen, statt ehrlich "unbekannt" zu sagen. */
          if (mindest > 0 && AO.market.hasHistory() && x.sold < mindest) return false;
          return true;
        });
        var list = passt.filter(function (x) {
          return !nurStufe || x.it.t === nurStufe;
        }).sort(function (a, b) {
          return S.sort === 'margin' ? b.d.margin - a.d.margin : b.d.perItem - a.d.perItem;
        });
        var lohnt = alle.filter(function (x) { return x.d.perItem > 0; }).length;
        var zuNiedrig = passt.filter(function (x) {
          return x.d.erzielt && x.d.listed && x.d.listed < x.d.erzielt * 0.9;
        }).length;
        /* Aufschluesselung nach Stufe ueber genau die Zeilen, die die Filter
           passiert haben - sie zeigt auf einen Blick, wo das Umschalten
           ueberhaupt etwas bringt. */
        var jeStufe = {};
        passt.forEach(function (x) { jeStufe[x.it.t] = (jeStufe[x.it.t] || 0) + 1; });
        var stufenTxt = Object.keys(jeStufe).sort().map(function (t) {
          return '<button class="chip' + (t === S.scanTier ? ' ok' : '') + '" data-tier="' + t +
            '" title="Nur Stufe T' + t + ' anzeigen">T' + t + ' <b>' + jeStufe[t] + '</b></button>';
        }).join(' · ');
        el.scanInfo.innerHTML = '<span class="mut">' + alle.length + ' vollständige Wege geprüft, davon <b>' +
          lohnt + '</b> mit Gewinn' + (SKIPPED ? '<span> · ' + SKIPPED + ' ohne vollständige Preise ausgelassen</span>' : '') +
          (VERALTET ? '<span> · ' + VERALTET + ' mit zu alten Preisen ausgelassen</span>' : '') +
          (PHANTOM ? '<span> · ' + PHANTOM + ' mit Fantasieangeboten ausgelassen</span>' : '') +
          (S.basis === 'erzielt' ? '<span> · gerechnet mit zuletzt erzielten Preisen</span>' : '') +
          (S.guild
            ? ' · Verkauf <b>an die Gilde</b> zu −' + F.n1(S.guildPct) + ' % vom Marktwert' +
              ' <span class="faint">(geprüft werden die Wege, die schon zum vollen Marktpreis ' +
              'tragen – mehr kann ein Gildenpreis nicht bringen)</span>'
            : ' · Verkauf in <b>' + F.esc(F.ort(S.sellCity)) + '</b>') +
          (mindest > 0 && AO.market.hasHistory()
            ? '<span> · nur mit mindestens ' + F.n1(mindest) + ' verkauften Stück je Tag</span>' : '') +
          (nurStufe ? '<span> · angezeigt nur</span> <b>T' + nurStufe + '</b>' : '') +
          (nurWege ? ' · nur ' + nurWege.map(function (k) {
            return '.' + k.split('-').join(' → .'); }).join(', ') : '') +
          (list.length > 100 ? '<span> · die besten 100 angezeigt</span>' : '') +
          /* Wer am Schwarzmarkt verkauft und mit der Momentaufnahme rechnet,
             unterschaetzt fast jeden Weg - das gehoert dorthin, wo es
             auffaellt. */
          (S.sellCity === AO.data.blackMarket && S.basis === 'markt' && zuNiedrig
            ? '<br><span class="warn">Bei ' + zuNiedrig + ' von ' + passt.length +
              ' Wegen liegt die aktuelle Schwarzmarkt-Kauforder unter dem dort real erzielten ' +
              'Preis – der Schwarzmarkt erneuert seine Orders laufend, die Momentaufnahme ist ' +
              'meist die schlechteste davon.</span> ' +
              '<button class="btn sm" data-tier-basis="erzielt">Mit „zuletzt erzielt“ rechnen</button>'
            : '') +
          (stufenTxt ? '<br><span>angezeigt je Stufe:</span> ' + stufenTxt
                     : '<br><span class="faint">keine Stufe erfüllt die Filter</span>') + '</span>';

        el.scanRows.innerHTML = list.length ? list.slice(0, 100).map(function (x) {
          var d = x.d;
          return '<tr class="hover" data-flip="' + F.esc(x.it.id) + '|' + x.from + '|' + x.to +
            '|' + x.q + '" style="cursor:pointer" title="Anklicken, um diesen Weg oben zu übernehmen">' +
            '<td><div class="itemcell">' + F.img(baseId(x.it, x.to), 56, x.it.n) +
              '<div class="nm"><b>' + F.esc(x.it.n) + '</b><span>' + F.esc(x.it.id) + '</span></div></div></td>' +
            '<td class="mut" style="font-size:12px">' + F.tier(x.it.t, 0) + ' ' +
              F.esc(AO.data.categories.catDe[x.it.c] || x.it.c) + '</td>' +
            '<td class="' + (x.q > 1 ? 'warn' : 'mut') + '" style="font-size:12px">' +
              F.esc(qName(x.q)) + '</td>' +
            '<td><b>.' + x.from + ' → .' + x.to + '</b></td>' +
            '<td>' + F.s(d.basePrice) + '</td>' +
            '<td>' + F.s(d.matTotal) + '</td>' +
            '<td>' + F.s(d.costTotal) + '</td>' +
            /* Es muss das in der Spalte stehen, womit auch gerechnet wird -
               sonst passt der Gewinn sichtbar nicht zum Verkaufspreis.
               Je nach Einstellung ist das der aktuelle Marktpreis, der
               zuletzt erzielte oder der Gildenpreis. */
            (function () {
              var abw = !S.guild && S.basis === 'markt' && d.erzielt && d.listed > d.erzielt * 1.5;
              var titel = S.guild
                ? 'Gildenpreis – Marktangebot wäre ' + F.s(d.listed)
                : S.basis === 'erzielt'
                  ? 'zuletzt erzielter Preis – aktuelles Angebot bzw. Kauforder: ' + F.s(d.listed)
                  : 'aktuelles Angebot bzw. Kauforder';
              return '<td' + (abw ? ' class="warn"' : '') + ' title="' + titel + '">' +
                (S.guild || S.basis === 'erzielt' ? '<b>' + F.s(d.sellPrice) + '</b>' : F.s(d.sellPrice)) +
                '</td>';
            })() +
            '<td class="mut">' + (d.erzielt ? F.s(d.erzielt) : '<span class="faint">—</span>') + '</td>' +
            '<td class="' + (d.marktwert && d.listed > d.marktwert * 1.5 ? 'warn' : 'mut') + '"' +
              ' title="' + (d.marktwert
                ? F.q(d.marktwertMenge) + ' Stück in drei Wochen über alle Städte'
                : 'Keine Handelsdaten') + '">' +
              (d.marktwert ? F.s(d.marktwert) : '<span class="faint">—</span>') + '</td>' +
            '<td class="' + (x.sold >= 1 ? 'mut' : 'warn') + '" style="font-size:12px" ' +
              'title="Einkauf ' + F.n1(x.soldBuy) + '/Tag, Verkauf ' + F.n1(x.soldSell) + '/Tag">' +
              (AO.market.hasHistory()
                ? F.n1(x.soldBuy) + ' / ' + F.n1(x.soldSell)
                : '<span class="faint">—</span>') + '</td>' +
            '<td class="' + (d.age < 3 ? 'pos' : d.age < 24 ? 'mut' : 'warn') + '" style="font-size:12px">' +
              (isFinite(d.age)
                ? (d.age < 1 ? '<1 Std.' : d.age < 48 ? Math.round(d.age) + ' Std.'
                                                      : Math.round(d.age / 24) + ' Tage')
                : '<span class="faint">\u2014</span>') + '</td>' +
            '<td class="' + (d.perItem >= 0 ? 'pos' : 'neg') + '"><b>' + F.sg(d.perItem) + '</b></td>' +
            '<td class="' + (d.margin >= 0 ? 'pos' : 'neg') + '">' + F.pct(d.margin) + '</td></tr>';
        }).join('') : '<tr><td colspan="14" class="t-empty">' +
          (nurStufe && passt.length
            ? 'Auf Stufe <b>T' + nurStufe + '</b> erfüllt nichts die Filter – auf anderen Stufen ' +
              'schon (' + passt.length + ' Wege). Stufenschalter auf „Alle Stufen“ stellen.'
            : S.onlyProfit && lohnt === 0
              ? 'Gerade lohnt sich kein einziger Weg. Anderen Verkaufsort probieren – oder den Haken ' +
                '„nur Wege mit Gewinn“ entfernen, um auch die Verlustbringer zu sehen.'
              : 'Nichts gefunden, das die Filter erfüllt.') + '</td></tr>';
      }

      /* ---------------------------------------------------- Darstellung */
      /* --- Momentaufnahme gegen Wirklichkeit ------------------------------
         Der Schwarzmarkt fuehrt keine stehenden Preise, sondern Kauforders,
         die das Spiel laufend erneuert. Was die API als hoechste Kauforder
         meldet, ist deshalb ein Schnappschuss - und der liegt fast immer
         unter dem, was dort tatsaechlich gezahlt wurde.
         Nachgemessen an 241 Gegenstaenden mit Handelsdaten am Schwarzmarkt:
         die aktuelle Kauforder betraegt im Median das 0,66-fache des real
         erzielten Preises, in 88 % der Faelle liegt sie darunter, in 34 %
         sogar unter der Haelfte. Wer also nur die Momentaufnahme rechnet,
         haelt lohnende Wege faelschlich fuer schlecht. */
      function bmMomentaufnahme(id, q) {
        var order = AO.market.get(id, AO.data.blackMarket, q, 'buy');
        var real = AO.market.avgPrice(id, AO.data.blackMarket, q);
        if (!order || !real) return '';
        var anteil = order / real;
        var txt = ' <b>Aktuell steht dort eine Kauforder über ' + F.s(order) +
          '</b>, real erzielt wurden hier zuletzt <b>' + F.s(real) + '</b> – die Momentaufnahme ' +
          'liegt also ' + F.n1(Math.abs(1 - anteil) * 100) + ' % ' +
          (anteil < 1 ? 'darunter' : 'darüber') + '.';
        if (S.basis === 'markt' && anteil < 0.9) {
          txt += ' <button class="btn sm" data-x="toErzielt">Mit „zuletzt erzielt“ rechnen</button>';
        }
        return txt;
      }

      function priceCell(id, city, q, side) {
        var own = AO.market.isOwn(id, city, q, side);
        var v = AO.market.get(id, city, q, side);
        var mk = AO.market.raw(id, city, q, side);
        return '<span class="pwrap">' + U.dot(AO.market.date(id, city, q, side), F.ort(city)) +
          '<input class="pinput' + (own ? ' own' : '') + '" data-id="' + F.esc(id) +
          '" data-city="' + F.esc(city) + '" data-q="' + q + '" data-side="' + side +
          '" inputmode="numeric" spellcheck="false" value="' + (v == null ? '' : F.s(v)) + '" placeholder="—"' +
          ' title="' + (mk != null ? 'Marktpreis: ' + F.s(mk) : 'Keine Marktdaten – Preis eintragen') + '">' +
          (own ? '<button class="reset" data-id="' + F.esc(id) + '" data-city="' + F.esc(city) +
                 '" data-q="' + q + '" data-side="' + side + '" title="Auf Marktpreis zurücksetzen">↺</button>' : '') +
          '</span>';
      }

      function render() {
        syncItem();
        var it = find(S.item);
        el.stamp.textContent = AO.market.has()
          ? 'Marktdaten: ' + F.time(AO.market.stamp()) + ' Uhr' : 'Noch keine Marktdaten geladen';

        if (!it) {
          el.chosen.innerHTML = '<span class="warn">Kein Gegenstand gewählt</span>';
          el.rows.innerHTML = '<tr><td colspan="6" class="t-empty">Bitte einen Gegenstand wählen.</td></tr>';
          el.stats.innerHTML = ''; el.costBox.innerHTML = ''; el.sellBox.innerHTML = '';
          el.cmpRows.innerHTML = ''; renderScan();
          return;
        }
        el.chosen.innerHTML = F.img(baseId(it, S.from), 40, it.n) + ' <b>' + F.esc(it.n) + '</b> · T' + it.t +
          ' · ' + F.esc(AO.data.categories.catDe[it.c] || it.c);

        var st = steps(it, S.from, S.to);
        el.wegNote.textContent = st.length
          ? '.' + S.from + ' → .' + S.to + ' · ' + st.length + (st.length === 1 ? ' Schritt' : ' Schritte')
          : 'kein Schritt';

        el.rows.innerHTML = st.length ? st.map(function (s) {
          return '<tr class="hover"><td><b>.' + (s.level - 1) + ' → .' + s.level + '</b></td>' +
            '<td><div class="itemcell">' + F.img(s.matId, 56, AO.craft.matName(s.matId)) +
              '<div class="nm"><b>' + F.esc(AO.craft.matName(s.matId)) + '</b>' +
              '<span>' + F.esc(MAT_DE[s.kind]) + '</span></div></div></td>' +
            '<td>' + F.q(s.count) + '</td>' +
            '<td data-f="tot' + s.level + '">—</td>' +
            '<td>' + priceCell(s.matId, S.matCity, 1, matSide()) + '</td>' +
            '<td data-f="cost' + s.level + '">—</td></tr>';
        }).join('') : '<tr><td colspan="6" class="t-empty">Ausgangs- und Zielstufe sind gleich.</td></tr>';

        renderNumbers();
        renderScan();
      }

      function renderNumbers() {
        var it = find(S.item); if (!it) return;
        var d = calc(it, S.from, S.to);
        /* Werte je Stueck aus einer Einzelrechnung - so stehen sie auch bei
           Anzahl 0 da, statt als NaN zu verschwinden. Alles ist linear in n. */
        var one = calc(it, S.from, S.to, 1);

        d.matRows.forEach(function (r) {
          var t = el.rows.querySelector('[data-f="tot' + r.level + '"]');
          var c = el.rows.querySelector('[data-f="cost' + r.level + '"]');
          if (t) t.textContent = F.q(r.total);
          if (c) c.textContent = F.s(r.cost);
        });
        el.matTotal.textContent = F.s(d.matTotal);

        var bm = S.sellCity === AO.data.blackMarket && !S.guild;
        el.bmNote.hidden = !bm;
        if (bm) {
          var vgl = AO.market.get(baseId(it, S.to), 'Caerleon', S.quality, sellSide());
          var bmAlter = AO.market.date(baseId(it, S.to), S.sellCity, S.quality, sellSide());
          var bmA = bmAlter ? F.age(bmAlter) : null;
          el.bmNote.innerHTML = '<b>Schwarzmarkt</b> – er führt nur <b>Kauforders</b>; gerechnet wird ' +
            'deshalb immer mit dem Preis, zu dem er gerade <b>ankauft</b>' +
            (AO.settings.sellMethod === 'order'
              ? ' (die Einstellung „Verkaufsorder“ wird hier bewusst übergangen)' : '') + '. ' +
            (bmA ? 'Dieser Stand ist <b>' + bmA.txt + '</b> gescannt. ' : '') +
            'Eine Kauforder hat eine begrenzte Stückzahl – wer sie leerkauft, drückt den Preis ' +
            'auf die nächste, meist deutlich niedrigere Order.' +
            (vgl ? ' Zum Vergleich: Caerleon-Markt ' + F.s(vgl) + '.' : '') +
            bmMomentaufnahme(baseId(it, S.to), S.quality);
        }

        var ok = !d.missing.length;
        el.notice.innerHTML = ok ? ''
          : '<div class="notice warn" style="margin-bottom:var(--s4)">Es fehlen Preise: <b>' +
            d.missing.map(F.esc).join(', ') + '</b>. Bitte laden oder von Hand eintragen – ' +
            'ohne sie ist der Gewinn nicht belastbar.</div>';

        el.stats.innerHTML =
          U.stat('Kosten / Stück', F.s(one.costTotal), 'Gegenstand + Material') +
          U.stat('Verkauf / Stück', F.s(d.sellPrice),
                 S.guild ? 'Gilde, −' + F.n1(S.guildPct) + ' % vom Marktwert' : F.ort(S.sellCity)) +
          U.stat('Gewinn / Stück', ok ? F.sg(one.perItem) : '—', 'nach Steuer',
                 ok ? (one.perItem >= 0 ? 'pos' : 'neg') : 'faint') +
          U.stat('Marge', ok ? F.pct(one.margin) : '—', 'Gewinn ÷ Kosten',
                 ok ? (one.margin >= 0 ? 'pos' : 'neg') : 'faint');

        var qLabel = (AO.data.qualities.filter(function (q) { return q.q === S.quality; })[0] || {}).label;
        el.chips.innerHTML =
          '<span class="chip">Aufwerten: <b>kostenlos</b> (nur Material)</span>' +
          (S.guild
            ? '<span class="chip ok" title="Direkter Handel: weder Verkaufssteuer noch Ordergebühr.">' +
                'Gilde <b>−' + F.n1(S.guildPct) + ' %</b> · steuerfrei</span>'
            : '<span class="chip">Steuer <b>' + (AO.settings.premium ? '4 %' : '8 %') + '</b>' +
              (AO.craft.sellOrderFeeAt(S.sellCity, AO.settings.sellMethod) > 0
                ? ' + Order 2,5 %' : ' (Sofortverkauf)') + '</span>') +
          '<span class="chip" title="Der Gegenstand wird immer sofort gekauft.">Material-Einkauf <b>' +
            (matOrder() ? 'Order +2,5 %' : 'Sofort') + '</b></span>' +
          '<span class="chip">Qualität <b>' + F.esc(qLabel || String(S.quality)) + '</b></span>';

        var kaufOrder = AO.settings.buyMethod === 'order';
        el.costBox.innerHTML =
          '<div class="dl" style="align-items:center"><span>Einkauf .' + S.from + ' je Stück in ' +
            F.esc(F.ort(S.buyCity)) + ' <span class="faint">(Sofortkauf)</span></span><span>' +
            priceCell(baseId(it, S.from), S.buyCity, S.quality, itemSide()) + '</span></div>' +
          line(F.q(d.n) + '× Gegenstand', F.s(d.baseCost)) +
          line('Aufwertungsmaterial', F.s(d.matTotal)) +
          line(kaufOrder ? 'Kauforder-Gebühr (2,5 % auf Material)'
                         : 'Kauforder-Gebühr – entfällt bei Sofortkauf',
               kaufOrder ? F.s(d.orderBuy) : '0', !kaufOrder) +
          line('<b>Gesamtkosten</b>', '<b>' + F.s(d.costTotal) + '</b>', false, true);

        var verkOrder = AO.settings.sellMethod === 'order';
        if (S.guild) {
          var mwG = AO.market.emv(baseId(it, S.to), S.quality);
          /* Ab welchem Rabatt kippt es? Zwei Grenzen: gegenueber dem
             Marktweg und gegenueber den eigenen Kosten. */
          var basisWert = mwG ? mwG.value * d.n : 0;
          var dGleich = basisWert ? (1 - d.marktNetto / basisWert) * 100 : NaN;
          var dNull   = basisWert ? (1 - d.costTotal / basisWert) * 100 : NaN;
          var unterKosten = d.net < d.costTotal;

          el.sellBox.innerHTML =
            '<div class="dl" style="align-items:center"><span>Marktwert .' + S.to +
              ' je St\u00fcck <span class="mut">(\u00fcberschreibbar)</span></span><span>' +
              priceCell(baseId(it, S.to), AO.market.emvKey, S.quality, 'sell') + '</span></div>' +
            (mwG && !mwG.own
              ? line('<span class="mut">Grundlage: ' + F.q(mwG.sold) + ' St\u00fcck in drei Wochen \u00fcber ' +
                     mwG.cities + ' St\u00e4dte</span>', '', true)
              : mwG && mwG.own
                ? line('<span class="mut">von Hand eingetragen</span>', '', true)
                : line('<span class="warn">Keine Handelsdaten \u2013 Marktwert eintragen</span>', '', true)) +
            line('Rabatt f\u00fcr die Gilde', '\u2212' + F.n1(S.guildPct) + ' %') +
            line('<b>Gildenpreis je St\u00fcck</b>', '<b>' + F.s(d.sellPrice) + '</b>', false, true) +
            line(F.q(d.n) + '\u00d7 Verkauf', F.s(d.gross)) +
            line('Verkaufssteuer \u2013 entf\u00e4llt beim direkten Handel', '0', true) +
            line('Ordergeb\u00fchr \u2013 entf\u00e4llt beim direkten Handel', '0', true) +
            line('<b>Netto-Erl\u00f6s</b>', '<b>' + F.s(d.net) + '</b>', false, true) +
            '<div class="dl"><span class="mut">Zum Vergleich: netto \u00fcber ' +
              F.esc(F.ort(S.sellCity)) + '</span><span class="mut">' + F.s(d.marktNetto) + '</span></div>' +
            /* Negative Schwellen sind keine Rabatte mehr. Ein "Gleichstand
               bei -120 %" ist unlesbar - gemeint ist: der Marktweg bringt
               mehr, ganz gleich wie klein der Rabatt ausfaellt. */
            (isFinite(dGleich)
              ? (dGleich >= 0
                  ? '<div class="dl"><span class="mut">Gleichstand mit dem Marktweg bei</span><span class="' +
                    (S.guildPct <= dGleich ? 'pos' : 'warn') + '">\u2212' + F.n1(dGleich) + ' %</span></div>'
                  : '<div class="dl"><span class="mut">Gleichstand mit dem Marktweg</span>' +
                    '<span class="warn">nie \u2013 der Markt zahlt ' + F.n1(-dGleich) +
                    ' % mehr als der volle Marktwert</span></div>')
              : '') +
            (isFinite(dNull)
              ? (dNull >= 0
                  ? '<div class="dl"><span class="mut">Bei diesem Rabatt bist du bei null</span><span class="' +
                    (S.guildPct < dNull ? 'mut' : 'neg') + '">\u2212' + F.n1(dNull) + ' %</span></div>'
                  : '<div class="dl"><span class="mut">Kostendeckung</span><span class="neg">nicht m\u00f6glich \u2013 ' +
                    'der Marktwert liegt ' + F.n1(-dNull) + ' % unter deinen Kosten</span></div>')
              : '') +
            '<div class="stat" style="margin-top:var(--s3);background:none;border:none;padding:0">' +
              '<div class="v ' + (!d.missing.length ? (d.profit >= 0 ? 'pos' : 'neg') : 'faint') + '">' +
                (!d.missing.length ? F.sg(d.profit) : '\u2014') + ' Silber</div>' +
              '<div class="s">f\u00fcr ' + F.q(d.n) + ' St\u00fcck \u00b7 ' +
                (!d.missing.length ? F.sg(one.perItem) : '\u2014') + ' je St\u00fcck</div></div>' +
            (unterKosten
              ? '<div class="notice err" style="margin-top:var(--s3)">' +
                (dNull >= 0
                  ? 'Dieser Rabatt liegt <b>unter deinen Einstandskosten</b>. ' +
                    'Ab \u2212' + F.n1(dNull) + ' % machst du Verlust \u2013 h\u00f6chstens ' +
                    F.s(d.costTotal / (d.n || 1)) + ' je St\u00fcck darfst du unterschreiten.'
                  : 'Hier deckt <b>schon der volle Marktwert deine Kosten nicht</b> (' +
                    F.s(basisWert / (d.n || 1)) + ' gegen ' + F.s(d.costTotal / (d.n || 1)) +
                    ' je St\u00fcck). Dieser Gegenstand taugt nicht f\u00fcr den Gildenverkauf.') +
                '</div>'
              : '');

          el.guildHint.innerHTML = mwG
            ? 'Gildenpreis: <b>' + F.s(d.sellPrice) + '</b> je St\u00fcck'
            : '<span class="warn">Ohne Marktwert kein Gildenpreis.</span>';
          return;
        }
        el.guildHint.textContent = '';
        el.sellBox.innerHTML =
          '<div class="dl" style="align-items:center"><span>Verkauf .' + S.to + ' je Stück in ' +
            F.esc(F.ort(S.sellCity)) + '</span><span>' +
            priceCell(baseId(it, S.to), S.sellCity, S.quality, sellSide()) + '</span></div>' +
          (function () {
            /* Gegenwert des Gegenstands ueber alle Staedte - er sagt, ob der
               Preis am gewaehlten Verkaufsort ueberhaupt einer ist, den
               jemand zahlt. */
            var mw = AO.market.marketValue(baseId(it, S.to), S.quality);
            if (!mw) return line('<span class="mut">Marktwert – keine Handelsdaten</span>',
                                 '<span class="faint">—</span>', true);
            var hoch = d.sellPrice && d.sellPrice > mw.value * 1.5;
            return line('Marktwert <span class="mut">(Ø real gezahlt über alle Städte, ' +
                        F.q(mw.sold) + ' Stück / 3 Wochen)</span>',
                        (hoch ? '<span class="warn">' : '') + F.s(mw.value) + (hoch ? '</span>' : ''));
          })() +
          line(F.q(d.n) + '× Verkauf', F.s(d.gross)) +
          line('Verkaufssteuer (' + (AO.settings.premium ? '4' : '8') + ' %)', '−' + F.s(d.tax)) +
          /* Die Beschriftung haengt am Handelsort, nicht am Betrag: bei einem
             Preis von 0 waere die Gebühr sonst "entfallen", obwohl sie
             sehr wohl anfaellt. */
          (function () {
            var faellt = AO.craft.sellOrderFeeAt(S.sellCity, AO.settings.sellMethod) > 0;
            return line(faellt
                ? 'Verkaufsorder-Gebühr (2,5 %)'
                : (S.sellCity === AO.data.blackMarket
                    ? 'Verkaufsorder-Gebühr – entfällt, der Schwarzmarkt kauft über eigene Orders'
                    : 'Verkaufsorder-Gebühr – entfällt bei Sofortverkauf'),
              faellt ? '−' + F.s(d.orderSell) : '0', !faellt);
          })() +
          line('<b>Netto-Erlös</b>', '<b>' + F.s(d.net) + '</b>', false, true) +
          '<div class="stat" style="margin-top:var(--s3);background:none;border:none;padding:0">' +
            '<div class="v ' + (ok ? (d.profit >= 0 ? 'pos' : 'neg') : 'faint') + '">' +
              (ok ? F.sg(d.profit) : '—') + ' Silber</div>' +
            '<div class="s">für ' + F.q(d.n) + ' Stück · ' + (ok ? F.sg(one.perItem) : '—') + ' je Stück</div></div>';

        var rows = [];
        for (var t = S.from + 1; t <= 3; t++) {
          var dd = calc(it, S.from, t);
          var good = !dd.missing.length;
          var cur = t === S.to;
          rows.push('<tr class="hover"' + (cur ? ' style="background:var(--goldDim)"' : '') + '>' +
            '<td><div class="itemcell">' + F.img(baseId(it, t), 56, it.n) +
              '<div class="nm"><b>' + F.tier(it.t, t) + '</b></div></div></td>' +
            '<td>' + F.s(dd.basePrice) + '</td>' +
            '<td>' + F.s(dd.n ? dd.matTotal / dd.n : NaN) + '</td>' +
            '<td>' + F.s(dd.n ? dd.costTotal / dd.n : NaN) + '</td>' +
            '<td>' + F.s(dd.sellPrice) + '</td>' +
            '<td class="' + (good ? (dd.perItem >= 0 ? 'pos' : 'neg') : 'faint') + '"><b>' +
              (good ? F.sg(dd.perItem) : '—') + '</b></td>' +
            '<td class="' + (good ? (dd.margin >= 0 ? 'pos' : 'neg') : 'faint') + '">' +
              (good ? F.pct(dd.margin) : '—') + '</td></tr>');
        }
        el.cmpRows.innerHTML = rows.join('') ||
          '<tr><td colspan="7" class="t-empty">Von .3 aus gibt es keine höhere Stufe.</td></tr>';
      }

      function line(l, v, dim, total) {
        return '<div class="dl' + (total ? ' total' : '') + '"' + (dim ? ' style="opacity:.55"' : '') + '>' +
          '<span>' + l + '</span><span>' + v + '</span></div>';
      }
    }
  };
})();
