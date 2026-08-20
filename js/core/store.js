/* Einstellungen dauerhaft im Browser speichern (localStorage).
   Jede View bekommt ihren eigenen Namensraum, damit sich nichts ueberschreibt. */
(function () {
  "use strict";
  window.AO = window.AO || {};

  var PREFIX = 'albionToolkit.';

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return (v === null || v === undefined) ? fallback : v;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  AO.store = {
    get: read,
    set: write,
    del: function (key) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} },

    /* Zustandsobjekt mit Vorgabewerten laden und automatisch sichern */
    bind: function (key, defaults) {
      var saved = read(key, {});
      /* Steht unter dem Schluessel etwas anderes als ein Objekt (alter Stand,
         von Hand bearbeitet), lieber die Vorgaben nehmen als beim Zugriff
         auszusteigen. */
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
      var state = {};
      Object.keys(defaults).forEach(function (k) {
        state[k] = (k in saved) ? saved[k] : defaults[k];
      });
      state.$save = function () { write(key, strip(state)); };
      state.$reset = function () {
        Object.keys(defaults).forEach(function (k) { state[k] = defaults[k]; });
        write(key, strip(state));
      };
      return state;
    },

    /* alle Toolkit-Schluessel auflisten bzw. leeren */
    keys: function () {
      var out = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length));
        }
      } catch (e) {}
      return out;
    },
    clearAll: function () {
      AO.store.keys().forEach(function (k) { AO.store.del(k); });
    }
  };

  function strip(state) {
    var o = {};
    Object.keys(state).forEach(function (k) {
      if (k.charAt(0) !== '$' && typeof state[k] !== 'function') o[k] = state[k];
    });
    return o;
  }

  /* Global geteilte Einstellungen (Server, Premium, Steuern, Gebuehren) */
  AO.settings = AO.store.bind('settings', {
    server:   'europe',
    city:     'Caerleon',
    premium:  true,
    buyMethod:  'instant',
    sellMethod: 'order',
    stationFee: 800,
    /* Produktionsbonus des eigenen Hideouts in Prozent, so wie die Station ihn
       anzeigt. Gilt fuer alle Rechner, damit man ihn nur einmal pflegt. */
    hideoutBonus: 26
  });
})();
