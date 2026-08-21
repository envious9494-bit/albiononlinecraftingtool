/* Trank-Rechner: Tränke aus dem Alchemielabor. */
(function () {
  "use strict";
  AO.views.potion = AO.craftView({
    id: 'potion',
    title: 'Trank-Rechner',
    subtitle: 'Tränke aus Kräutern und seltenen Zutaten – Materialien und Gewinn',
    storeKey: 'potion',
    itemLabel: 'Trank',
    /* Traenke lassen sich verzaubern: Grundrezept plus ein Arkanes
       Extrakt, Stufen .1 bis .3 (fuer .4 gibt es kein Rezept). */
    ench: true,
    quality: false,
    source: function () {
      return AO.data.consumables.filter(function (c) { return c.c === 'potion'; });
    }
  });
})();
