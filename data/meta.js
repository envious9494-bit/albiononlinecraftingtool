/* Stammdaten des Toolkits: Server, Staedte, Boni, Konstanten.
   Bewusst von Hand gepflegt - alles hier ist im Spiel nachpruefbar. */
window.AO = window.AO || {}; AO.data = AO.data || {};

AO.data.servers = {
  europe: { name: 'Europa',  host: 'https://europe.albion-online-data.com' },
  west:   { name: 'Amerika', host: 'https://west.albion-online-data.com' },
  east:   { name: 'Asien',   host: 'https://east.albion-online-data.com' }
};

AO.data.cities = [
  'Bridgewatch', 'Brecilien', 'Caerleon', 'Fort Sterling', 'Lymhurst', 'Martlock', 'Thetford'
];

/* Der Schwarzmarkt liegt in Caerleon, ist in der API aber eine eigene Location
   mit voellig anderen Preisen. Er handelt NUR Ausruestung - keine Rohstoffe
   und keine raffinierten Ressourcen. */
AO.data.blackMarket = 'Black Market';

/* Orte, fuer die Preise abgerufen werden */
AO.data.marketLocations = AO.data.cities.concat([AO.data.blackMarket]);

/* Verkaufsorte inkl. Schwarzmarkt (fuer Auswahlfelder) */
AO.data.sellLocations = AO.data.cities.map(function (c) {
  return { v: c, n: c };
}).concat([{ v: AO.data.blackMarket, n: 'Schwarzmarkt (Caerleon)' }]);

/* Refining-Boni: im Spiel eindeutig einer Stadt zugeordnet. */
AO.data.refineBonus = {
  PLANKS:     'Fort Sterling',
  METALBAR:   'Thetford',
  CLOTH:      'Lymhurst',
  LEATHER:    'Martlock',
  STONEBLOCK: 'Bridgewatch'
};

/* Rueckgaberaten laut Spiel. Fuer das Item-Crafting gilt dieselbe Mechanik;
   welche Stadt welche Item-Kategorie beguenstigt, steht NICHT im offiziellen
   Datendump - deshalb waehlt man die Rate im Crafting-Rechner direkt aus. */
AO.data.returnRates = [
  { id: 'none',      label: 'Kein Bonus',            rate: 15.2 },
  { id: 'focus',     label: 'Fokus',                 rate: 43.5 },
  { id: 'city',      label: 'Stadtbonus',            rate: 36.7 },
  { id: 'cityfocus', label: 'Stadtbonus + Fokus',    rate: 53.9 },
  /* Hideout: kein fester Wert - haengt von Zonenqualitaet und Power-Cores ab.
     Der Produktionsbonus wird eingetragen, die Rate daraus berechnet. */
  { id: 'hideout',      label: 'Hideout',          dynamic: true },
  { id: 'hideoutfocus', label: 'Hideout + Fokus',  dynamic: true }
];

AO.data.qualities = [
  { q: 1, label: 'Normal' },
  { q: 2, label: 'Gut' },
  { q: 3, label: 'Hervorragend' },
  { q: 4, label: 'Exzellent' },
  { q: 5, label: 'Meisterhaft' }
];

AO.data.consts = {
  /* Nutzungsgebuehr = Item-Wert x 0,1125 x Stationsgebuehr / 100.
     Verifiziert an den Spieldaten (T4-Barren: Item-Wert 16 -> 14,4 Silber bei 800). */
  nutritionFactor: 0.1125,
  taxPremium: 0.04,
  taxNormal:  0.08,
  orderFee:   0.025,
  render:     'https://render.albiononline.com/v1/item/'
};

/* Nur diese Materialien existieren verzaubert (.1 bis .4). */
AO.data.enchantable = ['PLANKS', 'METALBAR', 'CLOTH', 'LEATHER', 'WOOD', 'ORE', 'FIBER', 'HIDE'];
