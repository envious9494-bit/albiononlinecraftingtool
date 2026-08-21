/* Marktpreise vom Albion Online Data Project.
   Wird von allen Rechnern ausser dem Refining-Rechner genutzt (der bringt
   seine eigene, bereits geprueste Fassung mit).

   Grundsatz: es wird NUR auf ausdrueckliche Anforderung geladen. Eigene,
   von Hand eingetragene Preise haben immer Vorrang und ueberleben jeden
   Aktualisierungslauf. */
(function () {
  "use strict";
  window.AO = window.AO || {};

  var CACHE = {};       // server -> { at, prices: { 'id|city|q': {...} } }
  var HIST  = {};       // server -> { 'id|city|q': { sold: Stueck, days: n, last: Date } }
  var OWN   = AO.store.get('ownPrices', {}) || {};   // 'server|id|city|q|side' -> Zahl
  var LOADED = {};
  var WARNED = false;
  var REV = 0, BUMP = null;

  /* Jede Preisaenderung zaehlt hoch und meldet sich einmal gebuendelt beim
     Rest der Oberflaeche. Der Zaehler dient zugleich als Signatur fuer
     zwischengespeicherte Rechnungen: die blosse ANZAHL eigener Preise
     aendert sich nicht, wenn ein bestehender Wert korrigiert wird - der
     Zaehler schon. */
  function bump() {
    REV++;
    clearTimeout(BUMP);
    BUMP = setTimeout(function () {
      document.dispatchEvent(new CustomEvent('ao:prices'));
    }, 120);
  }

  /* --- Markt-Kennung ---------------------------------------------------
     Verzauberte Rohstoffe heissen im Spielbestand "T5_WOOD_LEVEL1", am Markt
     aber "T5_WOOD_LEVEL1@1". Ohne den Zusatz liefert die API zu dieser ID
     ueberhaupt keine Preise - nachgeprueft an Holz, Erz, Faser, Stoff,
     Barren und Leder: die Form ohne @ hat in keiner Stadt ein Angebot, die
     mit @ in allen.
     Die Umschreibung sitzt bewusst hier unten in der Marktschicht: so
     benutzen alle Rechner weiterhin die Kennung aus den Spieldaten, und nur
     der Marktzugriff spricht die Sprache des Marktes. Sie ist idempotent -
     eine bereits vollstaendige Kennung bleibt unveraendert. */
  function marktId(id) {
    var m = /_LEVEL([1-4])$/.exec(id);
    if (!m) return id;
    /* Nicht jede Kennung mit "_LEVELn" ist am Markt verzaubert: raffinierte
       Rohstoffe heissen dort "T4_METALBAR_LEVEL1@1", Fischsauce und Arkanes
       Extrakt dagegen schlicht "T1_FISHSAUCE_LEVEL1". Beides nachgemessen -
       die jeweils andere Form hat in keiner Stadt ein Angebot. Betroffene
       Materialien tragen deshalb das Merkmal "pm" (plain market id). */
    var mat = (AO.data.materials || {})[id];
    if (mat && mat.pm) return id;
    return id + '@' + m[1];
  }

  function key(id, city, q) { return marktId(id) + '|' + city + '|' + (q || 1); }
  /* Eigene Preise haengen am Server - ein fuer Europa eingetragener Preis
     darf in Asien nicht den echten Marktpreis verdecken. */
  function ownKey(id, city, q, side) {
    return AO.settings.server + '|' + key(id, city, q) + '|' + side;
  }

  /* Eigene Preise, die noch unter der unvollstaendigen Kennung liegen,
     einmalig umschreiben - sonst waeren sie nach der Umstellung verloren. */
  (function migrateLevel() {
    var out = {}, changed = false;
    Object.keys(OWN).forEach(function (k) {
      var t = k.split('|');
      var i = t.length === 5 ? 1 : 0;          /* mit oder ohne Server-Praefix */
      var neu = marktId(t[i]);
      if (neu !== t[i]) { t[i] = neu; changed = true; }
      out[t.join('|')] = OWN[k];
    });
    if (changed) { OWN = out; AO.store.set('ownPrices', OWN); }
  })();

  /* Altbestand ohne Server-Praefix einmalig dem aktuellen Server zuordnen. */
  (function migrate() {
    var out = {}, changed = false;
    Object.keys(OWN).forEach(function (k) {
      if (k.split('|').length === 4) { out[AO.settings.server + '|' + k] = OWN[k]; changed = true; }
      else out[k] = OWN[k];
    });
    if (changed) { OWN = out; AO.store.set('ownPrices', OWN); }
  })();

  function ensure(server) {
    if (CACHE[server]) return CACHE[server];
    if (!LOADED[server]) {
      LOADED[server] = true;
      var saved = AO.store.get('market.' + server, null);
      if (saved && saved.prices) {
        Object.keys(saved.prices).forEach(function (k) {
          var d = saved.prices[k];
          if (d.sellD) d.sellD = new Date(d.sellD);
          if (d.buyD) d.buyD = new Date(d.buyD);
        });
        CACHE[server] = saved;
        return saved;
      }
    }
    CACHE[server] = CACHE[server] || { at: 0, prices: {} };
    return CACHE[server];
  }

  function chunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }

  function fetchTimeout(url, ms) {
    var c = new AbortController();
    var to = setTimeout(function () { c.abort(); }, ms);
    return fetch(url, { signal: c.signal }).finally(function () { clearTimeout(to); });
  }

  AO.market = {
    /* --- Lesen ----------------------------------------------------------- */
    raw: function (id, city, q, side) {
      var d = ensure(AO.settings.server).prices[key(id, city, q)];
      if (!d) return null;
      return side === 'sell' ? d.sell : d.buy;
    },
    date: function (id, city, q, side) {
      var d = ensure(AO.settings.server).prices[key(id, city, q)];
      if (!d) return null;
      return side === 'sell' ? d.sellD : d.buyD;
    },
    /* eigener Preis schlaegt Marktpreis */
    get: function (id, city, q, side) {
      var k = ownKey(id, city, q, side);
      if (k in OWN) return OWN[k];
      return AO.market.raw(id, city, q, side);
    },
    isOwn: function (id, city, q, side) { return ownKey(id, city, q, side) in OWN; },
    setOwn: function (id, city, q, side, value) {
      var k = ownKey(id, city, q, side);
      if (value === null || value === AO.market.raw(id, city, q, side)) delete OWN[k];
      else OWN[k] = value;
      save('ownPrices', OWN);
      bump();
    },
    clearOwn: function (ids) {
      if (!ids) OWN = {};
      else ids.forEach(function (id) {
        Object.keys(OWN).forEach(function (k) {
          if (k.indexOf('|' + id + '|') >= 0) delete OWN[k];
        });
      });
      save('ownPrices', OWN);
      bump();
    },
    ownCount: function () { return Object.keys(OWN).length; },
    /* Zaehlt JEDE Preisaenderung, auch das Korrigieren eines bestehenden
       Wertes - anders als ownCount(). */
    rev: function () { return REV; },
    touch: bump,

    /* Guenstigste bzw. beste Stadt fuer ein Item.
       Nutzt get() statt der rohen Marktdaten, damit selbst eingetragene Preise
       mitzaehlen - sonst vergleicht die Oberfläche zwei verschiedene
       Preisquellen miteinander. */
    best: function (id, q, side, dir, locations) {
      var best = null;
      (locations || AO.data.marketLocations).forEach(function (c) {
        var v = AO.market.get(id, c, q, side);
        if (v === null || v === undefined) return;
        if (!best || (dir === 'min' ? v < best.v : v > best.v)) best = { city: c, v: v };
      });
      return best;
    },

    /* --- Handelsvolumen ---------------------------------------------------
       Der Preis sagt nur, was jemand VERLANGT. Ob ein Gegenstand ueberhaupt
       den Besitzer wechselt, steht im History-Endpunkt: item_count ist die
       Zahl tatsaechlich verkaufter Stueck je Tag. Ein Angebot, das seit
       Wochen niemand kauft, ist keine Gelegenheit. */
    sold: function (id, city, q) {
      var h = HIST[AO.settings.server];
      return (h && h[key(id, city, q)]) || null;
    },
    soldPerDay: function (id, city, q) {
      var e = AO.market.sold(id, city, q);
      return (e && e.days) ? e.sold / e.days : 0;
    },
    /* Mengengewichteter Durchschnitt der tatsaechlich erzielten Preise. */
    avgPrice: function (id, city, q) {
      var e = AO.market.sold(id, city, q);
      return (e && e.avg) ? e.avg : null;
    },
    /* --- Marktwert -------------------------------------------------------
       Das Spiel zeigt im Markt einen "Estimated Market Value". Diese Zahl
       rechnet der Spielserver selbst und veroeffentlicht sie nicht - der
       Data-Project-Endpunkt kennt nur sell_price_min/buy_price_max und die
       Handelshistorie. Nachgebaut wird sie deshalb aus derselben Grundlage,
       auf der auch das Spiel sie bildet: aus tatsaechlichen Abschluessen.
       Gewichtet nach Menge, ueber alle STAEDTE zusammen - ein Marktwert gilt
       fuer den Gegenstand, nicht fuer einen Stand in Martlock.
       Der Schwarzmarkt bleibt bewusst draussen: dort kauft kein Spieler,
       sondern das Spiel selbst, und zu ganz eigenen Preisen. Beim Speer T4
       stammten 7.191 von 9.327 gehandelten Stueck von dort und hoben den
       Wert von 4.855 auf 7.614 - eine Zahl, zu der man den Gegenstand
       nirgends kaufen kann. */
    /* Ablage fuer den von Hand eingetragenen Marktwert. Sie nutzt denselben
       Mechanismus wie eigene Preise - deshalb ein eigener Pseudo-Ort, der mit
       keiner echten Stadt kollidieren kann. */
    /* Fuer Ansichten, die selbst eine Markt-Kennung brauchen (Bilder,
       Verlinkungen). */
    marketId: marktId,

    emvKey: 'Marktwert',

    /* Marktwert, wie er fuer Preisabsprachen gilt: von Hand eingetragen,
       sonst aus echten Abschluessen gerechnet. Getippt schlaegt gerechnet -
       was der Nutzer im Spiel abliest, ist die massgebliche Zahl. */
    emv: function (id, q) {
      if (AO.market.isOwn(id, AO.market.emvKey, q, 'sell')) {
        var v = AO.market.get(id, AO.market.emvKey, q, 'sell');
        if (v != null) return { value: v, sold: null, cities: 0, own: true };
      }
      return AO.market.marketValue(id, q);
    },

    marketValue: function (id, q) {
      var h = HIST[AO.settings.server]; if (!h) return null;
      var menge = 0, umsatz = 0, staedte = 0, juengste = null;
      AO.data.cities.forEach(function (city) {
        var e = h[key(id, city, q)];
        if (!e || !e.sold) return;
        menge += e.sold; umsatz += e.umsatz; staedte++;
        if (!juengste || (e.last && e.last > juengste)) juengste = e.last;
      });
      if (!menge) return null;
      return { value: umsatz / menge, sold: menge, cities: staedte, last: juengste };
    },

    /* Preis des letzten Tages, an dem ueberhaupt gehandelt wurde. */
    lastPrice: function (id, city, q) {
      var e = AO.market.sold(id, city, q);
      return (e && e.lastPrice) ? e.lastPrice : null;
    },
    hasHistory: function () {
      var h = HIST[AO.settings.server];
      return !!h && Object.keys(h).length > 0;
    },

    /* Verkaufszahlen der letzten `days` Tage holen (Tagesscheiben). */
    loadHistory: function (ids, qualities, days, onProgress, opts) {
      opts = opts || {};
      var server = AO.settings.server;
      var host = AO.data.servers[server].host;
      var qs = (qualities && qualities.length ? qualities : [1]).join(',');
      var uniq = Object.keys(ids.reduce(function (a, i) { a[marktId(i)] = 1; return a; }, {}));
      var parts = chunk(uniq, opts.chunk || 150);
      var done = 0, failed = 0, lastErr = null;
      var seit = Date.now() - (days || 21) * 86400000;
      if (onProgress) onProgress(0, parts.length);

      var abgedeckt = {};
      function fetchPart(part) {
        var url = host + '/api/v2/stats/history/' + part.join(',') +
          '?locations=' + AO.data.marketLocations.map(encodeURIComponent).join(',') +
          '&qualities=' + qs + '&time-scale=24';
        return fetchTimeout(url, 40000).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (rows) {
          done++; if (onProgress) onProgress(done, parts.length);
          /* Nur was wirklich beantwortet wurde, gilt als abgedeckt - ein
             fehlgeschlagener Block darf seinen Altbestand behalten. */
          part.forEach(function (id) { abgedeckt[id] = 1; });
          return rows;
        }).catch(function (err) {
          done++; if (onProgress) onProgress(done, parts.length);
          failed++; lastErr = err;
          return null;
        });
      }

      var limit = Math.max(1, opts.concurrency || 5);
      var next = 0, results = new Array(parts.length);
      function worker() {
        if (next >= parts.length) return Promise.resolve();
        var i = next++;
        return fetchPart(parts[i]).then(function (rows) { results[i] = rows; return worker(); });
      }
      var runners = [];
      for (var w = 0; w < Math.min(limit, parts.length); w++) runners.push(worker());

      return Promise.all(runners).then(function () {
        /* Frisch aufsummieren und danach ERSETZEN, nicht in den Altbestand
           addieren - sonst verdoppeln sich die Verkaufszahlen bei jedem
           weiteren Suchlauf. */
        var spanne = days || 21;
        var frisch = {};
        results.forEach(function (rows) {
          if (!rows) return;
          rows.forEach(function (r) {
            var k = key(r.item_id, r.location, r.quality);
            var e = frisch[k] || (frisch[k] = {
              sold: 0, days: spanne, last: null,
              umsatz: 0, avg: null, lastPrice: null
            });
            (r.data || []).forEach(function (p) {
              var t = AO.fmt.date(p.timestamp);
              if (!t || t.getTime() < seit) return;
              var n = p.item_count || 0;
              e.sold += n;
              /* Umsatz mitzaehlen, um daraus den mengengewichteten
                 Durchschnittspreis zu bilden - das ist der Preis, zu dem
                 tatsaechlich Ware den Besitzer gewechselt hat. */
              e.umsatz += n * (p.avg_price || 0);
              if (!e.last || t > e.last) { e.last = t; e.lastPrice = p.avg_price || null; }
            });
            if (e.sold > 0) e.avg = e.umsatz / e.sold;
          });
        });
        var store = HIST[server] || (HIST[server] = {});
        /* Eine Antwort deckt IMMER alle abgefragten Staedte ab. Wo jetzt
           nichts mehr gehandelt wird, darf also auch nichts mehr stehen -
           sonst schleppt der Bestand Abschluesse mit, die aus dem
           Zeitfenster laengst herausgelaufen sind, und verfaelscht jeden
           Durchschnitt. Deshalb erst raeumen, dann eintragen. */
        var qSet = {};
        (qualities && qualities.length ? qualities : [1]).forEach(function (x) { qSet[x] = 1; });
        Object.keys(store).forEach(function (k) {
          var t = k.split('|');
          if (abgedeckt[t[0]] && qSet[t[t.length - 1]]) delete store[k];
        });
        Object.keys(frisch).forEach(function (k) { store[k] = frisch[k]; });
        if (parts.length && failed === parts.length) throw (lastErr || new Error('Keine Antwort'));
        return store;
      });
    },

    stamp: function () { return ensure(AO.settings.server).at || 0; },
    has: function () { return Object.keys(ensure(AO.settings.server).prices).length > 0; },

    /* --- Laden ----------------------------------------------------------- */
    /* ids: Liste von Item-IDs, qualities: z.B. [1] oder [1,2,3,4,5] */
    load: function (ids, qualities, onProgress, opts) {
      opts = opts || {};
      var server = AO.settings.server;
      var host = AO.data.servers[server].host;
      var qs = (qualities && qualities.length ? qualities : [1]).join(',');
      var uniq = Object.keys(ids.reduce(function (a, i) { a[marktId(i)] = 1; return a; }, {}));
      /* 250 IDs passen in eine Anfrage (URL bleibt unter 5000 Zeichen) -
         gegengeprueft an der API. 200 laesst Luft. */
      var parts = chunk(uniq, opts.chunk || 200);
      var done = 0, failed = 0, lastErr = null;
      if (onProgress) onProgress(0, parts.length);

      function fetchPart(part) {
        var url = host + '/api/v2/stats/prices/' + part.join(',') +
          '?locations=' + AO.data.marketLocations.map(encodeURIComponent).join(',') +
          '&qualities=' + qs;
        return fetchTimeout(url, 30000).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.json();
        }).then(function (rows) {
          done++; if (onProgress) onProgress(done, parts.length);
          return rows;
        }).catch(function (err) {
          /* Ein gescheiterter Block darf nicht alle erfolgreichen verwerfen. */
          done++; if (onProgress) onProgress(done, parts.length);
          failed++; lastErr = err;
          return null;
        });
      }

      /* Gedrosselt abarbeiten statt alles auf einmal loszuschicken - bei
         grossen Suchlaeufen waeren das sonst dutzende gleichzeitige Anfragen
         an einen fremden, kostenlosen Dienst. */
      var limit = Math.max(1, opts.concurrency || 6);
      var next = 0, results = new Array(parts.length);
      function worker() {
        if (next >= parts.length) return Promise.resolve();
        var i = next++;
        return fetchPart(parts[i]).then(function (rows) {
          results[i] = rows;
          return worker();
        });
      }
      var runners = [];
      for (var w = 0; w < Math.min(limit, parts.length); w++) runners.push(worker());

      return Promise.all(runners).then(function () { return results; }).then(function (all) {
        var store = ensure(server);
        all.forEach(function (rows) {
          if (!rows) return;
          rows.forEach(function (r) {
            var k = key(r.item_id, r.city, r.quality);
            var o = store.prices[k] || (store.prices[k] = { sell: null, sellD: null, buy: null, buyD: null });
            if (r.sell_price_min > 0) { o.sell = r.sell_price_min; o.sellD = AO.fmt.date(r.sell_price_min_date); }
            if (r.buy_price_max  > 0) { o.buy  = r.buy_price_max;  o.buyD  = AO.fmt.date(r.buy_price_max_date); }
          });
        });
        store.at = Date.now();
        persist(server, store);
        /* Auch frisch geladene Preise sind eine Preisaenderung - verborgene
           Ansichten muessen davon erfahren. */
        bump();
        /* Ohne Bloecke gibt es nichts zu laden - das ist kein Fehlschlag. */
        if (parts.length && failed === parts.length) throw (lastErr || new Error('Keine Antwort'));
        if (failed) AO.ui.toast(failed + ' von ' + parts.length + ' Blöcken fehlgeschlagen', 'err');
        return store;
      });
    }
  };

  /* Speichern mit Rueckmeldung: laeuft der Browserspeicher ueber, arbeitet das
     Toolkit im Arbeitsspeicher weiter - der Nutzer erfaehrt es aber, statt beim
     naechsten Start stillschweigend einen alten Stand vorzufinden. */
  function save(key, value) {
    var ok = AO.store.set(key, value);
    if (!ok && !WARNED) {
      WARNED = true;
      if (AO.ui && AO.ui.toast) {
        AO.ui.toast('Browserspeicher voll – Preise gelten nur noch bis zum Neuladen. ' +
                    'Unter Einstellungen aufräumen.', 'err');
      }
    }
    return ok;
  }

  function persist(server, store) {
    /* Beim Kuerzen die AELTESTEN Daten verwerfen, nicht die zuerst geladenen:
       die Schluesselreihenfolge ist Einfuege-, nicht Aktualisierungsreihenfolge. */
    /* Ein Vollscan erzeugt bis zu 40.000 Preisschluessel. Bei 4000 waeren
       90 % nach dem Neuladen weg, waehrend der Zeitstempel Vollstaendigkeit
       vorgaukelt. Wir sichern deutlich mehr und halbieren nur, wenn der
       Browserspeicher tatsaechlich streikt. */
    var keys = Object.keys(store.prices);
    var slim = store.prices;
    if (keys.length > 40000) {
      var stamp = function (k) {
        var d = store.prices[k];
        var a = d.sellD ? d.sellD.getTime() : 0;
        var b = d.buyD ? d.buyD.getTime() : 0;
        return Math.max(a, b);
      };
      keys.sort(function (a, b) { return stamp(b) - stamp(a); });
      slim = {};
      keys.slice(0, 40000).forEach(function (k) { slim[k] = store.prices[k]; });
    }
    /* Passt es nicht, schrittweise eindampfen statt still zu scheitern. */
    var ks = Object.keys(slim);
    for (var versuch = 0; versuch < 4; versuch++) {
      if (AO.store.set('market.' + server, { at: store.at, prices: slim })) return;
      ks = ks.slice(0, Math.floor(ks.length / 2));
      if (!ks.length) break;
      var kleiner = {};
      ks.forEach(function (k) { kleiner[k] = store.prices[k]; });
      slim = kleiner;
    }
    save('market.' + server, { at: store.at, prices: slim });
  }
})();
