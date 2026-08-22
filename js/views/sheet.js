/* Freier Rechner - das Blatt.

   Alle anderen Rechner nehmen dir die Rezepte ab. Dieser hier nimmt dir
   gar nichts ab: du sagst, was du einkaufst, was dabei herauskommt, und
   welche Abgaben du ansetzt. Gedacht fuer alles, was in kein Rezept
   passt - ein Handel ohne Herstellung, ein Hideout mit eigener Gebuehr,
   eine Abmachung mit der Gilde, ein Rezept, das das Spiel gerade
   geaendert hat.

   Bequem bleibt es trotzdem: jede Zeile kann einen echten Gegenstand
   aus dem Bestand tragen, dann kommen Name, Bild und Marktpreis von
   selbst. Wer lieber tippt, tippt.

   Alles Eingetragene liegt im Browserspeicher und uebersteht den
   Neustart.
*/
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  /* Eine leere Zeile. `id` bleibt leer, solange nichts gewaehlt ist. */
  function zeile(art) {
    return { id: '', name: '', menge: art === 'aus' ? 1 : 10, preis: null };
  }

  var S = AO.store.bind('sheet', {
    modus: 'craft',              /* craft | handel */
    stueck: 100,                 /* Crafts bzw. Handelsmenge */
    ein: [zeile('ein')],
    aus: [zeile('aus')],
    ruecklauf: 15.2,
    gebuehr: 0,                  /* Silber je Craft, frei eingetragen */
    steuer: 4,
    kauforder: false,
    verkaufsorder: true,
    ordergebuehr: 2.5,
    gilde: false,
    stadt: 'Caerleon'
  });

  function zahl(v, vorgabe) {
    var x = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(x) ? x : (vorgabe === undefined ? null : vorgabe);
  }

  /* --- Rechnung ---------------------------------------------------------
     Bewusst hier und nicht in AO.craft.calc: dort steckt die Logik der
     Rezepte (Rueckgabe je Zutat, Artefakte, Item-Wert). Hier gibt es kein
     Rezept, sondern nur Zeilen - und der Anwender bestimmt jede Zahl. */
  function rechne() {
    var n = Math.max(0, zahl(S.stueck, 0));
    var craft = S.modus === 'craft';
    var r = craft ? Math.min(Math.max(zahl(S.ruecklauf, 0) / 100, 0), 0.95) : 0;

    var einkauf = 0, fehlt = [];
    var einZeilen = S.ein.map(function (z) {
      var p = zahl(z.preis, null);
      var roh = Math.max(0, zahl(z.menge, 0)) * n;
      /* Die Rueckgabe wirkt nur auf Material, das man herstellt. Wer
         "kein Rücklauf" ankreuzt, zahlt die volle Menge - so wie bei
         Artefakten im Spiel. */
      var echt = z.keinRuecklauf ? roh : roh * (1 - r);
      if (p == null) fehlt.push(z.name || z.id || 'Zeile ohne Namen');
      var kosten = echt * (p || 0);
      einkauf += kosten;
      return { z: z, roh: roh, echt: echt, preis: p, kosten: kosten };
    });

    var orderKauf = S.kauforder ? einkauf * (zahl(S.ordergebuehr, 0) / 100) : 0;
    var gebuehr = craft ? Math.max(0, zahl(S.gebuehr, 0)) * n : 0;
    var kosten = einkauf + orderKauf + gebuehr;

    var umsatz = 0;
    var ausZeilen = S.aus.map(function (z) {
      var p = zahl(z.preis, null);
      var menge = Math.max(0, zahl(z.menge, 0)) * n;
      if (p == null) fehlt.push(z.name || z.id || 'Zeile ohne Namen');
      var wert = menge * (p || 0);
      umsatz += wert;
      return { z: z, menge: menge, preis: p, wert: wert };
    });

    /* Gildenverkauf: Hand zu Hand, also weder Steuer noch Ordergebuehr. */
    var steuer = S.gilde ? 0 : umsatz * (zahl(S.steuer, 0) / 100);
    var orderVerkauf = (S.gilde || !S.verkaufsorder)
      ? 0 : umsatz * (zahl(S.ordergebuehr, 0) / 100);
    var netto = umsatz - steuer - orderVerkauf;
    var gewinn = netto - kosten;

    var stueckAus = ausZeilen.reduce(function (a, x) { return a + x.menge; }, 0);
    /* Welchen Preis muesste das Erzeugnis bringen, damit nichts uebrig
       bleibt und nichts fehlt? */
    var abzug = 1 - (S.gilde ? 0 : (zahl(S.steuer, 0) / 100)) -
                ((S.gilde || !S.verkaufsorder) ? 0 : zahl(S.ordergebuehr, 0) / 100);
    var breakEven = (stueckAus > 0 && abzug > 0) ? kosten / abzug / stueckAus : NaN;

    return {
      einZeilen: einZeilen, ausZeilen: ausZeilen,
      einkauf: einkauf, orderKauf: orderKauf, gebuehr: gebuehr, kosten: kosten,
      umsatz: umsatz, steuer: steuer, orderVerkauf: orderVerkauf,
      netto: netto, gewinn: gewinn,
      stueckAus: stueckAus,
      jeStueck: stueckAus ? gewinn / stueckAus : NaN,
      marge: kosten ? gewinn / kosten * 100 : NaN,
      breakEven: breakEven,
      fehlt: fehlt
    };
  }

  /* --- Ansicht ---------------------------------------------------------- */
  AO.views.sheet = {
    id: 'sheet',
    title: 'Freier Rechner',
    subtitle: 'Eigene Positionen, eigene Abgaben – für alles, was in kein Rezept passt',

    html: function () {
      return '' +
      '<div class="view-head">' +
        '<h2>Freier Rechner</h2>' +
        '<p>Du trägst ein, was du kaufst und was dabei herauskommt. ' +
        'Steuer, Gebühren, Rückgabe und Gildenverkauf bestimmst du selbst.</p>' +
      '</div>' +

      '<div class="split">' +
        '<div class="side">' +
          '<div class="fieldset">' +
            '<h4>Art der Rechnung</h4>' +
            '<div class="field stack"><div data-x="modusSeg"></div>' +
              '<div class="hint" data-x="modusHint"></div></div>' +
            '<div class="field"><span class="lbl w" data-x="stueckLbl">Crafts</span>' +
              '<input class="num" data-x="stueck" inputmode="numeric"></div>' +
          '</div>' +

          '<div class="fieldset" data-x="craftBox">' +
            '<h4>Herstellung</h4>' +
            '<div class="field"><span class="lbl w">Rückgabe</span>' +
              '<input class="num" data-x="ruecklauf" inputmode="decimal"><span class="mut">%</span></div>' +
            '<div class="field stack"><div data-x="rrSeg"></div>' +
              '<div class="hint">Die bekannten Werte zum Übernehmen – oder trag deinen eigenen ein.</div></div>' +
            '<div class="field"><span class="lbl w">Gebühr</span>' +
              '<input class="num" data-x="gebuehr" inputmode="decimal">' +
              '<span class="mut">Silber je Craft</span></div>' +
            '<div class="hint">Die Nutzungsgebühr der Station, wie sie dort steht. ' +
              'Im eigenen Hideout oft 0.</div>' +
          '</div>' +

          '<div class="fieldset">' +
            '<h4>Abgaben</h4>' +
            '<div class="field"><span class="lbl w">Steuer</span>' +
              '<input class="num" data-x="steuer" inputmode="decimal"><span class="mut">%</span></div>' +
            '<div class="field"><span class="lbl w">Ordergebühr</span>' +
              '<input class="num" data-x="ordergebuehr" inputmode="decimal"><span class="mut">%</span></div>' +
            '<label class="field check"><input type="checkbox" data-x="kauforder"> ' +
              'Einkauf über Kauforder <span class="mut">(Gebühr fällt an)</span></label>' +
            '<label class="field check"><input type="checkbox" data-x="verkaufsorder"> ' +
              'Verkauf über Verkaufsorder</label>' +
            '<label class="field check"><input type="checkbox" data-x="gilde"> ' +
              'An Gilde verkaufen <span class="mut">(direkt)</span></label>' +
            '<div class="hint" data-x="gildeHint" hidden></div>' +
          '</div>' +

          '<div class="fieldset">' +
            '<h4>Marktpreise</h4>' +
            '<div class="field"><span class="lbl w">Stadt</span><select data-x="stadt"></select></div>' +
            '<button class="btn primary" data-x="load"><span class="spin">⟳</span> ' +
              'Preise für alle Zeilen holen</button>' +
            '<div class="hint">Holt für jede Zeile, die einen Gegenstand trägt, den ' +
              'aktuellen Preis. Von Hand eingetragene Zahlen bleiben stehen.</div>' +
          '</div>' +
        '</div>' +

        '<div class="main">' +
          '<div class="card">' +
            '<div class="card-head"><h3>Das kaufst du ein</h3>' +
              '<div class="right"><button class="btn sm" data-x="addEin">+ Zeile</button></div></div>' +
            '<div class="tablewrap" style="border:none">' +
              '<table class="data"><thead><tr>' +
                '<th style="min-width:170px">Gegenstand</th>' +
                '<th title="Menge je Craft bzw. je Einheit">Menge</th>' +
                '<th>Preis je Stück</th>' +
                '<th title="Was nach Abzug der Rückgabe wirklich zu kaufen ist">einzukaufen</th>' +
                '<th title="Kommt beim Herstellen nichts davon zurück? Dann anklicken.">Rückgabe</th>' +
                '<th>Kosten</th><th></th>' +
              '</tr></thead><tbody data-x="einRows"></tbody></table></div>' +
          '</div>' +

          '<div class="card" style="margin-top:var(--s4)">' +
            '<div class="card-head"><h3>Das kommt dabei heraus</h3>' +
              '<div class="right"><button class="btn sm" data-x="addAus">+ Zeile</button></div></div>' +
            '<div class="tablewrap" style="border:none">' +
              '<table class="data"><thead><tr>' +
                '<th style="min-width:170px">Gegenstand</th>' +
                '<th>Menge</th><th>Preis je Stück</th>' +
                '<th>Stück gesamt</th><th>Umsatz</th><th></th>' +
              '</tr></thead><tbody data-x="ausRows"></tbody></table></div>' +
          '</div>' +

          '<div class="grid two" style="margin-top:var(--s4)">' +
            '<div class="card"><div class="card-head"><h3>Kosten</h3></div>' +
              '<div class="card-body" data-x="kostenBox"></div></div>' +
            '<div class="card"><div class="card-head"><h3>Erlös &amp; Gewinn</h3></div>' +
              '<div class="card-body" data-x="erloesBox"></div></div>' +
          '</div>' +

          '<p class="view-footnote">Hier rechnet nichts von selbst mit einem Rezept. ' +
          'Jede Zahl steht so, wie du sie einträgst – auch eine, die es im Spiel ' +
          'nicht gibt. Das ist der Zweck: der Rechner soll dir nicht widersprechen, ' +
          'sondern rechnen.</p>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });

      el.modusSeg.innerHTML = U.seg([
        { v: 'craft', n: 'Herstellen' }, { v: 'handel', n: 'Nur handeln' }
      ], S.modus);
      el.rrSeg.innerHTML = U.seg(AO.data.returnRates.filter(function (r) { return !r.dynamic; })
        .map(function (r) { return { v: String(r.rate), n: F.n1(r.rate) + ' %' }; }), '');
      U.fill(el.stadt, AO.data.cities.map(function (c) { return { v: c, n: F.ort(c) }; }), S.stadt);

      ['stueck', 'ruecklauf', 'gebuehr', 'steuer', 'ordergebuehr'].forEach(function (k) {
        el[k].value = String(S[k]).replace('.', ',');
        el[k].addEventListener('input', U.debounce(function () {
          S[k] = zahl(el[k].value, 0); S.$save(); render();
        }, 200));
      });
      ['kauforder', 'verkaufsorder', 'gilde'].forEach(function (k) {
        el[k].checked = !!S[k];
        el[k].addEventListener('change', function () {
          S[k] = el[k].checked; S.$save(); render();
        });
      });

      el.modusSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.modus = b.dataset.v; S.$save();
        U.segSet(el.modusSeg.firstChild, b.dataset.v); render();
      });
      el.rrSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.ruecklauf = zahl(b.dataset.v, 0); S.$save();
        el.ruecklauf.value = String(S.ruecklauf).replace('.', ',');
        render();
      });
      el.stadt.addEventListener('change', function () { S.stadt = el.stadt.value; S.$save(); });

      el.addEin.addEventListener('click', function () { S.ein.push(zeile('ein')); S.$save(); render(); });
      el.addAus.addEventListener('click', function () { S.aus.push(zeile('aus')); S.$save(); render(); });

      /* Zeilen bedienen - ein Zuhoerer fuer beide Tabellen. */
      root.addEventListener('input', function (e) {
        var t = e.target;
        var seite = t.dataset && t.dataset.seite, i = t.dataset && +t.dataset.i;
        if (!seite || !isFinite(i)) return;
        var z = S[seite][i]; if (!z) return;
        if (t.dataset.feld === 'menge') z.menge = zahl(t.value, 0);
        if (t.dataset.feld === 'preis') z.preis = t.value.trim() === '' ? null : zahl(t.value, 0);
        if (t.dataset.feld === 'name') { z.name = t.value; z.id = ''; }
        S.$save(); rechnenUndZeigen();
      });

      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tun]'); if (!b) return;
        var seite = b.dataset.seite, i = +b.dataset.i;
        if (b.dataset.tun === 'weg') {
          S[seite].splice(i, 1);
          if (!S[seite].length) S[seite].push(zeile(seite === 'aus' ? 'aus' : 'ein'));
          S.$save(); render();
        }
        if (b.dataset.tun === 'ruecklauf') {
          var z = S[seite][i];
          z.keinRuecklauf = !z.keinRuecklauf; S.$save(); render();
        }
      });

      /* Gegenstand waehlen: eine schlichte Liste ueber alle Bestaende. */
      root.addEventListener('change', function (e) {
        var t = e.target;
        if (!t.dataset || t.dataset.feld !== 'wahl') return;
        var z = S[t.dataset.seite][+t.dataset.i]; if (!z) return;
        z.id = t.value;
        var it = alleGegenstaende().filter(function (x) { return x.id === t.value; })[0];
        z.name = it ? it.n : '';
        S.$save(); render();
      });

      el.load.addEventListener('click', preiseHolen);
      document.addEventListener('ao:server', function () { if (document.contains(root)) render(); });
      U.onPrices(root, render);

      render();

      /* ---------------------------------------------------------------- */
      var KATALOG = null;
      function alleGegenstaende() {
        if (KATALOG) return KATALOG;
        KATALOG = [];
        ['items', 'consumables', 'refining', 'fish'].forEach(function (k) {
          (AO.data[k] || []).forEach(function (o) { KATALOG.push({ id: o.id, n: o.n }); });
        });
        var m = AO.data.materials || {};
        Object.keys(m).forEach(function (k) { KATALOG.push({ id: k, n: m[k].n }); });
        KATALOG.sort(function (a, b) { return (a.n || '').localeCompare(b.n || '', 'de'); });
        return KATALOG;
      }

      function preiseHolen() {
        var ids = {};
        ['ein', 'aus'].forEach(function (seite) {
          S[seite].forEach(function (z) { if (z.id) ids[z.id] = 1; });
        });
        var liste = Object.keys(ids);
        if (!liste.length) { U.toast('Keine Zeile trägt einen Gegenstand', 'err'); return; }
        el.load.classList.add('loading'); el.load.disabled = true;
        AO.market.load(liste, [1])
          .then(function () {
            var seite = AO.craft.buySide(S.kauforder ? 'order' : 'instant');
            var n = 0;
            S.ein.forEach(function (z) {
              if (!z.id) return;
              var p = AO.market.get(z.id, S.stadt, 1, seite);
              if (p != null) { z.preis = p; n++; }
            });
            S.aus.forEach(function (z) {
              if (!z.id) return;
              var p = AO.market.get(z.id, S.stadt, 1, S.verkaufsorder ? 'sell' : 'buy');
              if (p != null) { z.preis = p; n++; }
            });
            S.$save();
            U.toast(n ? n + ' Preise übernommen' : 'Für diese Stadt liegt kein Preis vor',
                    n ? 'ok' : 'err');
          })
          .catch(function (err) { U.toast('Laden fehlgeschlagen: ' + err.message, 'err'); })
          .then(function () {
            el.load.classList.remove('loading'); el.load.disabled = false; render();
          });
      }

      function wahlFeld(seite, i, z) {
        var opt = ['<option value="">– eigener Text –</option>'];
        alleGegenstaende().forEach(function (x) {
          opt.push('<option value="' + F.esc(x.id) + '"' + (x.id === z.id ? ' selected' : '') +
                   '>' + F.esc(x.n || x.id) + '</option>');
        });
        return '<select class="mini" style="max-width:170px" data-feld="wahl" data-seite="' +
          seite + '" data-i="' + i + '">' +
          opt.join('') + '</select>';
      }

      function zeilenHtml(seite, liste, d) {
        return liste.map(function (x, i) {
          var z = x.z;
          var kopf = '<div class="itemcell">' +
            (z.id ? F.img(z.id, 40, z.name || z.id) : '') +
            '<div class="nm">' +
              '<input class="txt" style="max-width:170px" data-feld="name" data-seite="' + seite + '" data-i="' + i +
                '" value="' + F.esc(z.name || '') + '" placeholder="Name eintragen">' +
              wahlFeld(seite, i, z) +
            '</div></div>';
          var mitte = '<td><input class="num" style="max-width:80px" data-feld="menge" data-seite="' + seite +
              '" data-i="' + i + '" value="' + F.esc(String(z.menge).replace('.', ',')) + '"></td>' +
            '<td><input class="num" style="max-width:110px" data-feld="preis" data-seite="' + seite + '" data-i="' + i +
              '" value="' + (z.preis == null ? '' : F.esc(String(z.preis).replace('.', ','))) +
              '" placeholder="—"></td>';
          if (seite === 'ein') {
            return '<tr><td>' + kopf + '</td>' + mitte +
              '<td>' + F.s(x.echt) + '</td>' +
              '<td><button class="chip sm" data-tun="ruecklauf" data-seite="ein" data-i="' + i +
                '" title="Kommt beim Herstellen nichts davon zurück? Dann anklicken.">' +
                (z.keinRuecklauf ? 'nein' : 'ja') + '</button></td>' +
              '<td>' + F.s(x.kosten) + '</td>' +
              '<td><button class="chip sm" data-tun="weg" data-seite="ein" data-i="' + i + '">✕</button></td></tr>';
          }
          return '<tr><td>' + kopf + '</td>' + mitte +
            '<td>' + F.s(x.menge) + '</td><td>' + F.s(x.wert) + '</td>' +
            '<td><button class="chip sm" data-tun="weg" data-seite="aus" data-i="' + i + '">✕</button></td></tr>';
        }).join('');
      }

      function line(l, v, dim, total) {
        return '<div class="dl' + (total ? ' total' : '') + '"' + (dim ? ' style="opacity:.55"' : '') +
          '><span>' + l + '</span><span>' + v + '</span></div>';
      }

      function rechnenUndZeigen() {
        var d = rechne();
        el.einRows.innerHTML = zeilenHtml('ein', d.einZeilen, d);
        el.ausRows.innerHTML = zeilenHtml('aus', d.ausZeilen, d);

        var craft = S.modus === 'craft';
        el.kostenBox.innerHTML =
          line('Einkauf', F.s(d.einkauf)) +
          line('Kauforder-Gebühr', F.s(d.orderKauf), !S.kauforder) +
          (craft ? line('Nutzungsgebühr', F.s(d.gebuehr)) : '') +
          line('Gesamtkosten', F.s(d.kosten), false, true);

        el.erloesBox.innerHTML =
          line('Umsatz', F.s(d.umsatz)) +
          line('Steuer', '−' + F.s(d.steuer), S.gilde) +
          line('Verkaufsorder-Gebühr', '−' + F.s(d.orderVerkauf), S.gilde || !S.verkaufsorder) +
          line('Netto-Erlös', F.s(d.netto), false, true) +
          '<div class="big ' + (d.gewinn >= 0 ? 'pos' : 'neg') + '" style="margin-top:var(--s3)">' +
            F.sg(d.gewinn) + ' Silber</div>' +
          '<div class="mut">' +
            (isFinite(d.jeStueck) ? F.sg(d.jeStueck) + ' je Stück · ' : '') +
            (isFinite(d.marge) ? F.pct(d.marge) + ' Marge' : '') + '</div>' +
          (isFinite(d.breakEven)
            ? '<div class="mut" style="margin-top:var(--s2)">Ab ' + F.s(d.breakEven) +
              ' je Stück bist du bei null.</div>' : '') +
          (d.fehlt.length
            ? '<div class="chip warn" style="margin-top:var(--s3)">' + d.fehlt.length +
              ' Zeile(n) ohne Preis – der Gewinn ist so nicht belastbar</div>' : '');
      }

      function render() {
        el.craftBox.hidden = S.modus !== 'craft';
        el.stueckLbl.textContent = S.modus === 'craft' ? 'Crafts' : 'Einheiten';
        el.modusHint.textContent = S.modus === 'craft'
          ? 'Mit Rückgaberate und Nutzungsgebühr – wie an einer Station.'
          : 'Reiner Handel: kaufen und verkaufen, ohne Rückgabe und ohne Stationsgebühr.';
        el.gildeHint.hidden = !S.gilde;
        if (S.gilde) {
          el.gildeHint.textContent = 'Direkter Handel: Steuer und Ordergebühr entfallen. ' +
            'Der Preis ist der, den du unten einträgst.';
        }
        rechnenUndZeigen();
      }
    }
  };
})();
