/* Refining-Rechner: Rohstoffe zu Brettern, Barren, Stoff, Leder, Steinblöcken.

   Nutzt dieselbe Komponente wie der Crafting-Rechner (_craftview.js), damit
   Aufbau und Bedienung identisch sind. Die Rezepte stammen aus den offiziellen
   Spieldaten (data/refining.js), die Rechenregeln sind unverändert:
     Item-Wert       2^(Tier + Verzauberung)
     Nutzungsgebühr  Item-Wert × 0,1125 × Stationsgebühr ÷ 100
     Rückgaberate    Verbrauch = Bedarf × (1 − Rate)
     Kauforder +2,5 %, Verkaufsorder +2,5 %, Steuer 4 % / 8 %
*/
(function () {
  "use strict";

  /* Kategorie-Bezeichnungen für die fünf Rohstoffarten ergänzen */
  var CAT = { WOOD: 'Holz', ORE: 'Erz', FIBER: 'Fasern', HIDE: 'Felle', ROCK: 'Stein' };
  Object.keys(CAT).forEach(function (k) { AO.data.categories.catDe[k] = CAT[k]; });

  /* Sammelnamen der Familien (statt des T4-Namens „Stahlbarren") */
  var FAMILY = {
    PLANKS: 'Bretter', METALBAR: 'Metallbarren', CLOTH: 'Stoff',
    LEATHER: 'Leder', STONEBLOCK: 'Steinblöcke'
  };

  /* Schneller Zugriff auf ein Refining-Rezept per Item-ID –
     nötig für „Vorstufe selbst herstellen". */
  var BY_ID = null;
  function byId(id) {
    if (!BY_ID) {
      BY_ID = {};
      AO.data.refining.forEach(function (r) { BY_ID[r.id] = r; });
    }
    /* verzauberte Vorstufen (T5_METALBAR_LEVEL2) auf das Grundrezept abbilden */
    return BY_ID[id] || BY_ID[id.replace(/_LEVEL\d$/, '')] || null;
  }

  function kindOf(id) { return id.replace(/^T\d_/, '').replace(/_LEVEL\d$/, ''); }

  AO.views.refining = AO.craftView({
    id: 'refining',
    title: 'Refining-Rechner',
    subtitle: 'Rohstoffe zu Brettern, Barren, Stoff, Leder und Steinblöcken – T2 bis T8',
    storeKey: 'refining2',
    itemLabel: 'Ressource',

    ench: true,
    quality: false,
    blackMarket: false,   /* der Schwarzmarkt handelt keine Ressourcen */
    selfCraft: true,
    overview: true,

    source: function () { return AO.data.refining; },
    byId: byId,
    familyName: function (key) { return FAMILY[key]; },

    /* Refining-Boni sind im Spiel eindeutig einer Stadt zugeordnet. */
    bonusCityOf: function (item) { return AO.data.refineBonus[kindOf(item.id)]; }
  });
})();
