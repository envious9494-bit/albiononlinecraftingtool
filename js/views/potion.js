/* Trank-Rechner: Tränke aus dem Alchemielabor. */
(function () {
  "use strict";
  AO.views.potion = AO.craftView({
    id: 'potion',
    title: 'Trank-Rechner',
    subtitle: 'Tränke aus Kräutern und seltenen Zutaten – Materialien und Gewinn',
    storeKey: 'potion',
    itemLabel: 'Trank',
    ench: false,
    quality: false,
    source: function () {
      return AO.data.consumables.filter(function (c) { return c.c === 'potion'; });
    }
  });
})();
