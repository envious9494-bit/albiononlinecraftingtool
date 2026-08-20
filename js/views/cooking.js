/* Koch-Rechner: Nahrung aus der Küche.
   Gerichte kennen keine Verzauberung und keine Qualitätsstufen. */
(function () {
  "use strict";
  AO.views.cooking = AO.craftView({
    id: 'cooking',
    title: 'Koch-Rechner',
    subtitle: 'Gerichte und Fischsoßen – Zutaten, Kosten und Gewinn',
    storeKey: 'cooking',
    itemLabel: 'Gericht',
    ench: false,
    quality: false,
    source: function () {
      /* Gerichte plus die Fischprodukte (Fischsossen, Seetang) - beides
         entsteht in der Kueche. */
      return AO.data.consumables.filter(function (c) { return c.c === 'food'; })
        .concat(AO.data.fish || []);
    }
  });
})();
