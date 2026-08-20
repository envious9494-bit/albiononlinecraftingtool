/* Einstellungen: globale Vorgaben, Datenstand und Speicher aufräumen. */
(function () {
  "use strict";
  var F = AO.fmt, U = AO.ui, G = AO.settings;

  AO.views.settings = {
    id: 'settings',
    title: 'Einstellungen',
    subtitle: 'Vorgaben für alle Rechner, Datenstand und Speicher',

    html: function () {
      return '' +
      '<div class="grid cols-2">' +
        '<div class="card">' +
          '<div class="card-head"><h3>Vorgaben</h3><div class="right"><span class="mut">Ausgangswerte für noch nicht benutzte Rechner</span></div></div>' +
          '<div class="fieldset">' +
            '<div class="field"><span class="lbl w">Server</span><select data-x="server"></select></div>' +
            '<div class="field"><span class="lbl w">Stadt</span><select data-x="city"></select></div>' +
            '<div class="field"><span class="lbl w">Gebühr</span><input class="num" data-x="fee" inputmode="numeric">' +
              '<span class="mut">Silber /100 Nährwert</span></div>' +
            '<div class="hint">Stadt und Gebühr gelten als Ausgangswert. Jeder Rechner merkt sich ' +
              'seine eigene Einstellung, sobald du sie dort einmal änderst.</div>' +
            '<div class="field"><span class="lbl w">Hideout</span><input class="num" data-x="hideout" inputmode="decimal">' +
              '<span class="mut">% Produktionsbonus</span></div>' +
            '<div class="hint" data-x="hideoutHint"></div>' +
            '<label class="field check"><input type="checkbox" data-x="premium"> Premium <span class="mut">(4 % statt 8 % Steuer)</span></label>' +
            '<div class="field stack"><label>Einkauf über</label>' +
              U.seg([{ v: 'instant', n: 'Sofortkauf' }, { v: 'order', n: 'Kauforder +2,5 %' }], G.buyMethod) + '</div>' +
            '<div class="field stack"><label>Verkauf über</label>' +
              U.seg([{ v: 'order', n: 'Verkaufsorder +2,5 %' }, { v: 'instant', n: 'Sofortverkauf' }], G.sellMethod) + '</div>' +
            '<div class="field stack"><label>Sprache</label>' +
              U.seg(AO.i18n.sprachen.map(function (s) { return { v: s.v, n: s.n }; }),
                    AO.i18n.lang(), 'langSeg') +
              '<div class="hint">Oberfläche und Item-Namen. Die Item-Namen sind nicht übersetzt, ' +
              'sondern aus der Lokalisierung des Spiels selbst übernommen – im Werkzeug steht ' +
              'genau der Name, den du im Spiel siehst.</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="card">' +
          '<div class="card-head"><h3>Daten &amp; Speicher</h3></div>' +
          '<div class="card-body">' +
            '<div data-x="info"></div>' +
            '<div class="chips" style="margin:var(--s4) 0">' +
              '<button class="btn sm" data-x="clearOwn">Eigene Preise löschen</button>' +
              '<button class="btn sm" data-x="clearMarket">Marktdaten verwerfen</button>' +
              '<button class="btn sm danger" data-x="clearAll">Alles zurücksetzen</button>' +
            '</div>' +
            '<div class="hint">Alles liegt ausschließlich in deinem Browser. Es gibt keinen Server, ' +
              'kein Konto und keine Übertragung deiner Eingaben.</div>' +
            '<h4 style="margin-top:var(--s5)">Eigene, frische Preise</h4>' +
            '<p class="hint">Die Marktpreise kommen von Spielern, die den ' +
              '<a href="https://www.albion-online-data.com/client" target="_blank" rel="noopener">' +
              'Data-Project-Client</a> laufen lassen. Er liest beim Spielen mit, welche Marktfenster ' +
              'du öffnest, und meldet die Preise an die öffentliche Sammelstelle – von dort holt ' +
              'dieses Toolkit sie wieder ab.</p>' +
            '<p class="hint">Heißt praktisch: <b>lass den Client laufen und öffne im Spiel die ' +
              'Märkte, die dich interessieren.</b> Wenige Minuten später liefert „Marktpreise laden“ ' +
              'genau deine eigenen Scans – der Alterspunkt wird grün. Direkt aus dem Spiel lesen ' +
              'kann diese Seite nichts; sie läuft ohne Server und ohne Zugriff auf Albion.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-top:var(--s4)">' +
        '<div class="card-head"><h3>Woher die Zahlen kommen</h3></div>' +
        '<div class="card-body">' +
          '<div class="dl"><span>Rezepte, Item-Werte, Fokuskosten</span><span>offizielle Spieldaten (ao-bin-dumps)</span></div>' +
          '<div class="dl"><span>Marktpreise</span><span>Albion Online Data Project (crowdsourced)</span></div>' +
          '<div class="dl"><span>Item-Bilder</span><span>Albion Online Render Service</span></div>' +
          '<div class="dl"><span>Nutzungsgebühr</span><span>Item-Wert × 0,1125 × Gebühr ÷ 100</span></div>' +
          '<div class="dl"><span>Item-Wert Ressourcen</span><span>2<sup>Tier + Verzauberung</sup></span></div>' +
          '<div class="dl"><span>Item-Wert craftbarer Gegenstände</span><span>Summe der Zutatenwerte</span></div>' +
          '<div class="hint" style="margin-top:var(--s3)">Nicht in den Spieldaten enthalten und deshalb im ' +
            'Toolkit einstellbar statt geraten: die Zuordnung Stadt ↔ Item-Kategorie beim Crafting-Bonus ' +
            'sowie der Umrechnungsfaktor für Handwerks-Fame.</div>' +
        '</div>' +
      '</div>';
    },

    mount: function (root) {
      var el = {};
      U.qa('[data-x]', root).forEach(function (n) { el[n.dataset.x] = n; });
      var segs = U.qa('.seg', root);

      U.fill(el.server, Object.keys(AO.data.servers).map(function (k) {
        return { v: k, n: AO.data.servers[k].name };
      }), G.server);
      U.fill(el.city, AO.data.cities.map(function (c) { return { v: c, n: c }; }), G.city);
      el.fee.value = G.stationFee;
      el.premium.checked = G.premium;

      el.server.addEventListener('change', function () {
        G.server = el.server.value; G.$save();
        var top = document.getElementById('globalServer');
        if (top) { top.value = G.server; top.dispatchEvent(new Event('change', { bubbles: true })); }
        info();
      });
      el.city.addEventListener('change', function () {
        G.city = el.city.value; G.$save(); melde();
      });
      el.fee.addEventListener('input', function () {
        var v = F.parse(el.fee.value); G.stationFee = v === null ? 0 : v; G.$save();
      });

      /* Hideouts haben keinen festen Bonus - er haengt von Zonenqualitaet und
         Power-Cores ab. Deshalb eintragen statt raten. */
      el.hideout.value = String(G.hideoutBonus).replace('.', ',');
      el.hideout.addEventListener('input', function () {
        var v = parseFloat(String(el.hideout.value).replace(',', '.'));
        G.hideoutBonus = isFinite(v) ? v : 0; G.$save(); hideoutHint();
        document.dispatchEvent(new CustomEvent('ao:settings'));
      });
      /* Wird der Bonus in einem Rechner geaendert, hier nachziehen. */
      document.addEventListener('ao:settings', function () {
        if (document.activeElement !== el.hideout) {
          el.hideout.value = String(G.hideoutBonus).replace('.', ',');
        }
        hideoutHint();
      });
      hideoutHint();
      function hideoutHint() {
        var b = parseFloat(G.hideoutBonus) || 0;
        el.hideoutHint.innerHTML = 'Ergibt <b>' + F.pct(AO.craft.rrrFromBonus(b) * 100) +
          '</b> Rückgabe, mit Fokus <b>' +
          F.pct(AO.craft.rrrFromBonus(b + AO.craft.focusBonus) * 100) + '</b>. ' +
          'Den Wert zeigt die Station im Hideout an; er hängt von Zonenqualität und Power-Cores ab. ' +
          'Zum Vergleich: Bonus-Stadt entspricht 58 %.';
      }
      el.premium.addEventListener('change', function () {
        G.premium = el.premium.checked; G.$save(); melde();
      });
      /* Alle Rechner erfahren von der Aenderung - sonst zeigen sie beim
         naechsten Aufruf noch die alte Vorgabe an, rechnen aber neu. */
      function melde() { document.dispatchEvent(new CustomEvent('ao:settings')); }

      segs[0].addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        G.buyMethod = b.dataset.v; G.$save(); U.segSet(segs[0], b.dataset.v); melde();
      });
      segs[1].addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        G.sellMethod = b.dataset.v; G.$save(); U.segSet(segs[1], b.dataset.v); melde();
      });

      /* Sprache. Bereits erzeugte Ansichten halten die alten Namen sowohl im
         DOM als auch in ihren internen Listen. Statt beides einzeln
         nachzuziehen wird die Seite neu geladen - das ist verlässlich und
         hinterlässt keine verwaisten Ereignis-Empfänger. */
      var langSeg = document.getElementById('langSeg');
      langSeg.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.v === AO.i18n.lang()) return;
        AO.i18n.apply(b.dataset.v);
        U.segSet(langSeg, b.dataset.v);
        setTimeout(function () { location.reload(); }, 350);
      });

      el.clearOwn.addEventListener('click', function () {
        AO.market.clearOwn(); U.toast('Eigene Preise gelöscht', 'ok'); info();
      });
      el.clearMarket.addEventListener('click', function () {
        Object.keys(AO.data.servers).forEach(function (s) { AO.store.del('market.' + s); });
        U.toast('Marktdaten verworfen – Seite neu laden', 'ok'); info();
      });
      el.clearAll.addEventListener('click', function () {
        AO.store.clearAll();
        try { localStorage.removeItem('albionRefineCalc.v1'); } catch (e) {}
        U.toast('Alles zurückgesetzt – Seite wird neu geladen', 'ok');
        setTimeout(function () { location.reload(); }, 900);
      });

      info();
      document.addEventListener('ao:server', info);
      document.addEventListener('ao:prices', info);

      function info() {
        var bytes = 0;
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            bytes += (k + (localStorage.getItem(k) || '')).length * 2;
          }
        } catch (e) {}
        el.info.innerHTML =
          '<div class="dl"><span>Marktdaten ' + F.esc(AO.data.servers[G.server].name) + '</span><span>' +
            (AO.market.has() ? F.time(AO.market.stamp()) + ' Uhr' : 'nicht geladen') + '</span></div>' +
          '<div class="dl"><span>Eigene Preise</span><span>' + AO.market.ownCount() + '</span></div>' +
          '<div class="dl"><span>Rezepte im Toolkit</span><span>' +
            F.s(AO.data.items.length + AO.data.consumables.length) + '</span></div>' +
          '<div class="dl"><span>Belegter Browserspeicher</span><span>' + F.n1(bytes / 1024) + ' KB</span></div>';
      }
    }
  };
})();
