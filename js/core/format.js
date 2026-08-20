/* Zahlen-, Datums- und Textformatierung - deutschsprachig, einheitlich. */
(function () {
  "use strict";
  window.AO = window.AO || {};

  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var nf2 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 });

  AO.fmt = {
    /* Silberbetrag, gerundet */
    s: function (x) { return isFinite(x) ? nf0.format(Math.round(x)) : '—'; },

    /* Silberbetrag mit Vorzeichen */
    sg: function (x) {
      if (!isFinite(x)) return '—';
      return (x < 0 ? '−' : '+') + nf0.format(Math.round(Math.abs(x)));
    },

    /* Kompakt: 1,2 Mio / 34,5 Tsd */
    sk: function (x) {
      if (!isFinite(x)) return '—';
      var a = Math.abs(x), sign = x < 0 ? '−' : '';
      if (a >= 1e9) return sign + nf2.format(a / 1e9) + ' Mrd';
      if (a >= 1e6) return sign + nf2.format(a / 1e6) + ' Mio';
      if (a >= 1e4) return sign + nf1.format(a / 1e3) + ' Tsd';
      return sign + nf0.format(Math.round(a));
    },

    /* Menge: zeigt eine Nachkommastelle nur wenn noetig, damit
       "Menge x Preis = Betrag" in Tabellen sichtbar aufgeht. */
    q: function (x) {
      if (!isFinite(x)) return '—';
      var r = Math.round(x * 10) / 10;
      return Number.isInteger(r) ? nf0.format(r) : nf2.format(r);
    },

    n1: function (x) { return isFinite(x) ? nf1.format(x) : '—'; },
    n2: function (x) { return isFinite(x) ? nf2.format(x) : '—'; },
    pct: function (x) { return isFinite(x) ? nf1.format(x) + ' %' : '—'; },

    /* "1.234,5" oder "1234.5" -> Zahl */
    parse: function (s) {
      if (s === null || s === undefined) return null;
      s = String(s).trim().replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
      if (s === '') return null;
      var v = parseFloat(s);
      return isFinite(v) && v >= 0 ? v : null;
    },

    date: function (s) {
      if (!s) return null;
      var d = new Date(/Z$/i.test(s) ? s : s + 'Z');
      return isFinite(d) && d.getUTCFullYear() > 2000 ? d : null;
    },

    /* Alter der Marktdaten -> Text + Ampelklasse */
    age: function (d) {
      if (!d) return null;
      var m = (Date.now() - d.getTime()) / 60000, t;
      if (m < 1) t = 'gerade eben';
      else if (m < 60) t = 'vor ' + Math.round(m) + ' min';
      else if (m < 2880) t = 'vor ' + Math.round(m / 60) + ' Std.';
      else t = 'vor ' + Math.round(m / 1440) + ' Tagen';
      return { txt: t, cls: m < 180 ? 'fresh' : m < 1440 ? 'mid' : 'old' };
    },

    time: function (ts) {
      return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    },

    esc: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },

    /* Anzeigename eines Handelsortes */
    ort: function (city) {
      return city === AO.data.blackMarket ? 'Schwarzmarkt' : city;
    },

    /* Tier-Marke, z.B. T4.2 */
    /* Tier-Marke, z.B. T4.2 - die Verzauberungsstufe traegt die Farbe, die
       das Spiel dafuer benutzt (offizielles Wiki: .1 gruen, .2 tuerkis,
       .3 violett, .4 gold). */
    tier: function (t, e) {
      return '<span class="tier t' + t + '">T' + t +
        (e ? '<small class="e' + e + '">.' + e + '</small>' : '') + '</span>';
    },

    /* Item-Bild vom offiziellen Render-Service */
    img: function (id, size, alt) {
      size = size || 64;
      return '<img src="' + AO.data.consts.render + id + '.png?size=' + size +
        '" width="' + Math.round(size / 2) + '" height="' + Math.round(size / 2) +
        '" alt="' + AO.fmt.esc(alt || id) + '" loading="lazy" ' +
        'onerror="this.outerHTML=\'<span class=iph>?</span>\'">';
    }
  };
})();
