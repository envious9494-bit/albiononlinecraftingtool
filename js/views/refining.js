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

  /* Kategorie- und Sammelnamen der fünf Rohstoffarten. Das ist unsere
     eigene Ordnung, nicht die des Spiels - deshalb stehen sie hier
     dreisprachig, genau wie die übrigen Kategorien in data/categories.js.
     (Die Item-Namen selbst kommen weiterhin aus der Lokalisierung.) */
  var CAT = {
    WOOD:  { de: 'Holz',   en: 'Wood',   es: 'Madera' },
    ORE:   { de: 'Erz',    en: 'Ore',    es: 'Mineral' },
    FIBER: { de: 'Fasern', en: 'Fibre',  es: 'Fibra' },
    HIDE:  { de: 'Felle',  en: 'Hide',   es: 'Piel' },
    ROCK:  { de: 'Stein',  en: 'Stone',  es: 'Piedra' }
  };

  /* Sammelnamen der Familien (statt des T4-Namens „Stahlbarren") */
  var FAMILY = {
    PLANKS:     { de: 'Bretter',      en: 'Planks',     es: 'Tablones' },
    METALBAR:   { de: 'Metallbarren', en: 'Metal bars', es: 'Lingotes' },
    CLOTH:      { de: 'Stoff',        en: 'Cloth',      es: 'Tela' },
    LEATHER:    { de: 'Leder',        en: 'Leather',    es: 'Cuero' },
    STONEBLOCK: { de: 'Steinblöcke',  en: 'Stone blocks', es: 'Bloques de piedra' }
  };

  function inSprache(tabelle, key) {
    var e = tabelle[key];
    if (!e) return null;
    return e[AO.i18n.lang()] || e.de;
  }

  /* Die Ansichten lesen catDe; i18n tauscht das Feld beim Umschalten aus.
     Deshalb in alle drei Tabellen schreiben und catDe passend belegen. */
  Object.keys(CAT).forEach(function (k) {
    var c = AO.data.categories;
    c.catDe[k] = inSprache(CAT, k);
    if (c.catEn) c.catEn[k] = CAT[k].en;
    if (c.catEs) c.catEs[k] = CAT[k].es;
    if (c._catDe) c._catDe[k] = CAT[k].de;
  });

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
    /* Refining geht auf Masse - da lohnt der direkte Verkauf an die
       Gilde, weil dabei weder Steuer noch Ordergebuehr anfallen. */
    guild: true,
    blackMarket: false,   /* der Schwarzmarkt handelt keine Ressourcen */
    selfCraft: true,
    overview: true,

    source: function () { return AO.data.refining; },
    byId: byId,
    familyName: function (key) { return inSprache(FAMILY, key); },

    /* Refining-Boni sind im Spiel eindeutig einer Stadt zugeordnet. */
    bonusCityOf: function (item) { return AO.data.refineBonus[kindOf(item.id)]; }
  });
})();
