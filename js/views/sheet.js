/* Freier Rechner - das Blatt.

   Alle anderen Rechner nehmen dir die Rezepte ab. Dieser hier nimmt dir
   gar nichts ab: du sagst, was du einkaufst, was dabei herauskommt, und
   welche Abgaben du ansetzt. Gedacht fuer alles, was in kein Rezept
   passt - ein Handel ohne Herstellung, ein Hideout mit eigener Gebuehr,
   eine Abmachung mit der Gilde, ein Rezept, das das Spiel gerade
   geaendert hat.

   Zwei Dinge sind hier wichtiger als anderswo:

   1. Waehrend getippt wird, werden die Zeilen NICHT neu gebaut. Sonst
      verschwindet das Feld unter den Fingern - nach einem Buchstaben ist
      Schluss. Neu gezeichnet wird nur, wenn sich die Zeilen wirklich
      aendern (hinzufuegen, entfernen, Gegenstand waehlen); beim Tippen
      werden ausschliesslich die errechneten Zellen nachgetragen.

   2. Der Gegenstand wird ueber eine Suche gewaehlt, nicht ueber eine
      Auswahlliste. Der Bestand hat rund 2.900 Eintraege; als <select> je
      Zeile waeren das bei vier Zeilen ueber elftausend Elemente - bei
      jedem Neuzeichnen.

   Alles Eingetragene liegt im Browserspeicher und uebersteht den
   Neustart.
*/
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui;

  function zeile(art) {
    return { id: '', name: '', menge: art === 'aus' ? 1 : 10, preis: null };
  }

  var S = AO.store.bind('sheet', {
    modus: 'craft',              /* craft | handel */
    stueck: 100,
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
        '<div class="card">' +
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

        '<div>' +
          /* Der Sucher liegt ueber den Tabellen und gehoert immer genau
             einer Zeile - deshalb einmal im Baum statt einmal je Zeile. */
          '<div class="card" data-x="pickBox" hidden style="margin-bottom:var(--s4)">' +
            '<div class="card-head"><h3 data-x="pickTitel">Gegenstand wählen</h3>' +
              '<div class="right"><button class="btn sm" data-x="pickZu">Schließen</button></div></div>' +
            '<div class="card-body tight">' +
              '<input data-x="pickSuche" placeholder="Name oder Kennung eintippen…" ' +
                'autocomplete="off" spellcheck="false" style="width:100%;max-width:420px">' +
              '<div class="picker-list" data-x="pickListe" style="position:static;' +
                'max-height:340px;margin-top:var(--s3)"></div>' +
            '</div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-head"><h3>Das kaufst du ein</h3>' +
              '<div class="right"><button class="btn sm" data-x="addEin">+ Zeile</button></div></div>' +
            '<div class="tablewrap" style="border:none">' +
              '<table class="data"><thead><tr>' +
                '<th style="min-width:216px">Gegenstand</th>' +
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
                '<th style="min-width:216px">Gegenstand</th>' +
                '<th>Menge</th><th>Preis je Stück</th>' +
                '<th>Stück gesamt</th><th>Umsatz</th><th></th>' +
              '</tr></thead><tbody data-x="ausRows"></tbody></table></div>' +
          '</div>' +

          '<div class="grid cols-2" style="margin-top:var(--s4)">' +
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

      /* --- Einstellungen links ---------------------------------------- */
      ['stueck', 'ruecklauf', 'gebuehr', 'steuer', 'ordergebuehr'].forEach(function (k) {
        el[k].value = String(S[k]).replace('.', ',');
        el[k].addEventListener('input', function () {
          S[k] = zahl(el[k].value, 0); S.$save(); aktualisiere();
        });
      });
      ['kauforder', 'verkaufsorder', 'gilde'].forEach(function (k) {
        el[k].checked = !!S[k];
        el[k].addEventListener('change', function () {
          S[k] = el[k].checked; S.$save(); syncSeite(); aktualisiere();
        });
      });

      el.modusSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.modus = b.dataset.v; S.$save();
        U.segSet(el.modusSeg.firstChild, b.dataset.v);
        syncSeite(); zeichneZeilen();
      });
      el.rrSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        S.ruecklauf = zahl(b.dataset.v, 0); S.$save();
        el.ruecklauf.value = String(S.ruecklauf).replace('.', ',');
        aktualisiere();
      });
      el.stadt.addEventListener('change', function () { S.stadt = el.stadt.value; S.$save(); });

      el.addEin.addEventListener('click', function () { S.ein.push(zeile('ein')); S.$save(); zeichneZeilen(); });
      el.addAus.addEventListener('click', function () { S.aus.push(zeile('aus')); S.$save(); zeichneZeilen(); });
      el.load.addEventListener('click', preiseHolen);

      /* --- Tippen in den Zeilen ----------------------------------------
         Hier wird bewusst NICHT neu gezeichnet: das Feld unter den
         Fingern bleibt stehen, nur die errechneten Zellen laufen mit. */
      root.addEventListener('input', function (e) {
        var t = e.target;
        if (!t.dataset || !t.dataset.seite || t.dataset.feld === undefined) return;
        var z = S[t.dataset.seite][+t.dataset.i]; if (!z) return;
        if (t.dataset.feld === 'menge') z.menge = zahl(t.value, 0);
        else if (t.dataset.feld === 'preis') z.preis = t.value.trim() === '' ? null : zahl(t.value, 0);
        else if (t.dataset.feld === 'name') { z.name = t.value; z.id = ''; }
        S.$save();
        aktualisiere();
      });

      root.addEventListener('click', function (e) {
        var b = e.target.closest('[data-tun]'); if (!b) return;
        var seite = b.dataset.seite, i = +b.dataset.i;
        if (b.dataset.tun === 'weg') {
          S[seite].splice(i, 1);
          if (!S[seite].length) S[seite].push(zeile(seite === 'aus' ? 'aus' : 'ein'));
          S.$save(); zeichneZeilen();
        } else if (b.dataset.tun === 'ruecklauf') {
          var z = S[seite][i]; z.keinRuecklauf = !z.keinRuecklauf; S.$save(); zeichneZeilen();
        } else if (b.dataset.tun === 'waehlen') {
          pickerAuf(seite, i);
        }
      });

      /* --- Sucher ------------------------------------------------------ */
      var PICK = null;                 /* { seite, i } */
      var KATALOG = null;

      function katalog() {
        if (KATALOG) return KATALOG;
        KATALOG = [];
        ['items', 'consumables', 'refining', 'fish'].forEach(function (k) {
          (AO.data[k] || []).forEach(function (o) { KATALOG.push({ id: o.id, n: o.n, t: o.t }); });
        });
        var m = AO.data.materials || {};
        Object.keys(m).forEach(function (k) { KATALOG.push({ id: k, n: m[k].n, t: m[k].t }); });
        return KATALOG;
      }

      function pickerAuf(seite, i) {
        PICK = { seite: seite, i: i };
        var z = S[seite][i];
        el.pickBox.hidden = false;
        el.pickTitel.textContent = 'Gegenstand wählen';
        el.pickSuche.value = z && z.name ? z.name : '';
        pickerListe();
        el.pickSuche.focus();
        el.pickSuche.select();
      }

      function pickerZu() { PICK = null; el.pickBox.hidden = true; }
      el.pickZu.addEventListener('click', pickerZu);

      el.pickSuche.addEventListener('input', U.debounce(pickerListe, 120));
      el.pickSuche.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') pickerZu();
      });

      function pickerListe() {
        var term = el.pickSuche.value.trim().toLowerCase();
        var treffer = katalog();
        if (term) {
          treffer = treffer.filter(function (x) {
            return (x.n || '').toLowerCase().indexOf(term) >= 0 ||
                   x.id.toLowerCase().indexOf(term) >= 0;
          });
        }
        var gesamt = treffer.length;
        treffer = treffer.slice(0, 40);
        el.pickListe.innerHTML = treffer.length
          ? treffer.map(function (x) {
              return '<button data-pick="' + F.esc(x.id) + '">' + F.img(x.id, 40, x.n) +
                '<span class="nm">' + F.esc(x.n || x.id) + '</span>' +
                '<span class="meta">' + F.esc(x.id) + '</span></button>';
            }).join('') +
            (gesamt > 40 ? '<div class="t-empty">… und ' + F.q(gesamt - 40) +
              ' weitere. Tipp mehr, dann wird die Liste kürzer.</div>' : '')
          : '<div class="t-empty">Nichts gefunden</div>';
      }

      el.pickListe.addEventListener('click', function (e) {
        var b = e.target.closest('[data-pick]'); if (!b || !PICK) return;
        var z = S[PICK.seite][PICK.i]; if (!z) return;
        z.id = b.dataset.pick;
        var x = katalog().filter(function (y) { return y.id === z.id; })[0];
        z.name = x ? (x.n || z.id) : z.id;
        S.$save();
        pickerZu();
        zeichneZeilen();
      });

      document.addEventListener('ao:server', function () { if (document.contains(root)) zeichneZeilen(); });
      U.onPrices(root, aktualisiere);

      syncSeite();
      zeichneZeilen();

      /* ---------------------------------------------------------------- */
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
            el.load.classList.remove('loading'); el.load.disabled = false;
            zeichneZeilen();
          });
      }

      function nameZelle(seite, i, z) {
        /* flex:none an Bild und Knopf - sonst quetscht die enge Spalte
           die Beschriftung des Knopfes zu "wäh" zusammen. */
        return '<div style="display:flex;align-items:center;gap:var(--s2)">' +
          (z.id ? '<span style="flex:none;display:flex">' +
                    F.img(z.id, 40, z.name || z.id) + '</span>' : '') +
          '<input style="min-width:0;width:100%;max-width:150px" data-feld="name" data-seite="' + seite +
            '" data-i="' + i + '" value="' + F.esc(z.name || '') + '" placeholder="Name eintragen">' +
          '<button class="btn sm ghost" style="flex:none;white-space:nowrap" data-tun="waehlen" ' +
            'data-seite="' + seite + '" data-i="' + i +
            '" title="Einen Gegenstand aus dem Bestand suchen">wählen</button>' +
          '</div>';
      }

      /* Baut die Zeilen neu. Nur aufrufen, wenn sich die Zeilen wirklich
         aendern - beim Tippen wuerde das Feld unter den Fingern
         verschwinden. */
      function zeichneZeilen() {
        var d = rechne();
        el.einRows.innerHTML = d.einZeilen.map(function (x, i) {
          var z = x.z;
          return '<tr>' +
            '<td>' + nameZelle('ein', i, z) + '</td>' +
            '<td><input class="num" style="max-width:74px" data-feld="menge" data-seite="ein" data-i="' + i +
              '" value="' + F.esc(String(z.menge).replace('.', ',')) + '"></td>' +
            '<td><input class="num" style="max-width:104px" data-feld="preis" data-seite="ein" data-i="' + i +
              '" value="' + (z.preis == null ? '' : F.esc(String(z.preis).replace('.', ','))) +
              '" placeholder="—"></td>' +
            '<td data-out="ein-echt-' + i + '">' + F.s(x.echt) + '</td>' +
            '<td><button class="chip" data-tun="ruecklauf" data-seite="ein" data-i="' + i +
              '" title="Kommt beim Herstellen nichts davon zurück? Dann anklicken.">' +
              (z.keinRuecklauf ? 'nein' : 'ja') + '</button></td>' +
            '<td data-out="ein-kosten-' + i + '">' + F.s(x.kosten) + '</td>' +
            '<td><button class="btn sm ghost" data-tun="weg" data-seite="ein" data-i="' + i + '">✕</button></td></tr>';
        }).join('');

        el.ausRows.innerHTML = d.ausZeilen.map(function (x, i) {
          var z = x.z;
          return '<tr>' +
            '<td>' + nameZelle('aus', i, z) + '</td>' +
            '<td><input class="num" style="max-width:74px" data-feld="menge" data-seite="aus" data-i="' + i +
              '" value="' + F.esc(String(z.menge).replace('.', ',')) + '"></td>' +
            '<td><input class="num" style="max-width:104px" data-feld="preis" data-seite="aus" data-i="' + i +
              '" value="' + (z.preis == null ? '' : F.esc(String(z.preis).replace('.', ','))) +
              '" placeholder="—"></td>' +
            '<td data-out="aus-menge-' + i + '">' + F.s(x.menge) + '</td>' +
            '<td data-out="aus-wert-' + i + '">' + F.s(x.wert) + '</td>' +
            '<td><button class="btn sm ghost" data-tun="weg" data-seite="aus" data-i="' + i + '">✕</button></td></tr>';
        }).join('');

        boxen(d);
      }

      /* Rechnet nach und traegt nur die errechneten Zellen nach. Ruehrt
         kein Eingabefeld an. */
      function aktualisiere() {
        var d = rechne();
        d.einZeilen.forEach(function (x, i) {
          var a = el.einRows.querySelector('[data-out="ein-echt-' + i + '"]');
          var b = el.einRows.querySelector('[data-out="ein-kosten-' + i + '"]');
          if (a) a.textContent = F.s(x.echt);
          if (b) b.textContent = F.s(x.kosten);
        });
        d.ausZeilen.forEach(function (x, i) {
          var a = el.ausRows.querySelector('[data-out="aus-menge-' + i + '"]');
          var b = el.ausRows.querySelector('[data-out="aus-wert-' + i + '"]');
          if (a) a.textContent = F.s(x.menge);
          if (b) b.textContent = F.s(x.wert);
        });
        boxen(d);
      }

      function line(l, v, dim, total) {
        return '<div class="dl' + (total ? ' total' : '') + '"' + (dim ? ' style="opacity:.55"' : '') +
          '><span>' + l + '</span><span>' + v + '</span></div>';
      }

      function boxen(d) {
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
          '<div class="stat" style="margin-top:var(--s3);background:none;border:none;padding:0">' +
            '<div class="v ' + (d.gewinn >= 0 ? 'pos' : 'neg') + '">' + F.sg(d.gewinn) + ' Silber</div>' +
            '<div class="s">' +
              (isFinite(d.jeStueck) ? F.sg(d.jeStueck) + ' je Stück' : '') +
              (isFinite(d.jeStueck) && isFinite(d.marge) ? ' · ' : '') +
              (isFinite(d.marge) ? F.pct(d.marge) + ' Marge' : '') + '</div></div>' +
          (isFinite(d.breakEven)
            ? '<div class="mut" style="margin-top:var(--s2)">Ab ' + F.s(d.breakEven) +
              ' je Stück bist du bei null.</div>' : '') +
          (d.fehlt.length
            ? '<div class="chip warn" style="margin-top:var(--s3)">' + d.fehlt.length +
              ' Zeile(n) ohne Preis – der Gewinn ist so nicht belastbar</div>' : '');
      }

      function syncSeite() {
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
      }
    }
  };
})();
