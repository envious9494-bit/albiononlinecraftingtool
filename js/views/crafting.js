/* Crafting-Rechner: Waffen, Rüstung, Zubehör, Werkzeug.
   Nutzt die gemeinsame Komponente aus _craftview.js. */
(function () {
  "use strict";
  AO.views.crafting = AO.craftView({
    id: 'crafting',
    title: 'Crafting-Rechner',
    subtitle: 'Waffen, Rüstung und Zubehör – Materialien, Kosten und Gewinn',
    storeKey: 'crafting',
    itemLabel: 'Gegenstand',
    ench: true,
    quality: true,
    blackMarket: true,
    source: function () { return AO.data.items; }
  });
})();
