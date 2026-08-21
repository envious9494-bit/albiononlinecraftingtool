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
    /* Speisen lassen sich verzaubern: Grundrezept plus Fischsauce,
       Stufen .1 bis .3. Die beiden T1-Gerichte (Gegrillter Fisch,
       Seegras-Salat) haben kein Verzauberungsrezept - dort blendet
       sich die Leiste von selbst aus. */
    ench: true,
    quality: false,
    source: function () {
      /* Gerichte plus die Fischprodukte (Fischsossen, Seetang) - beides
         entsteht in der Kueche. */
      return AO.data.consumables.filter(function (c) { return c.c === 'food'; })
        .concat(AO.data.fish || []);
    }
  });
})();
