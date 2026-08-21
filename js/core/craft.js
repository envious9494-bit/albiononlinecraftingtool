/* Gemeinsame Crafting-Mathematik fuer Ausruestung, Nahrung und Traenke.

   Modell (identisch zum geprueften Refining-Rechner):
     Item-Wert       = Summe der Zutatenwerte            (aus den Spieldaten belegt)
     Nutzungsgebuehr = Item-Wert x 0,1125 x Gebuehr/100  je Craft
     Rueckgaberate r = zurueckerhaltene Materialien werden direkt
                       weiterverarbeitet -> Verbrauch = Bedarf x (1 - r)
     Kauforder       = +2,5 % auf den Materialeinkauf
     Verkauf         = Steuer (4 %/8 %) + ggf. 2,5 % Verkaufsorder-Gebuehr
*/
(function () {
  "use strict";
  window.AO = window.AO || {};

  var C = AO.data.consts;

  function mat(id) { return AO.data.materials[id] || null; }

  /* Materialkennung inkl. Verzauberungsstufe */
  function matId(baseId, ench, enchantable) {
    return (ench > 0 && enchantable) ? baseId + '_LEVEL' + ench : baseId;
  }

  AO.craft = {
    matId: matId,
    material: mat,

    /* Name eines Materials, faellt auf die ID zurueck */
    matName: function (id) {
      var m = mat(id);
      return m ? m.n : id;
    },

    /* Artefakte (samt Runen, Seelen, Relikten) bekommt man beim Craften NIE
       zurueck - die Rueckgaberate gilt nur fuer normale Ressourcen.
       Markierung "nr" stammt aus den Spieldaten (shopcategory="artefacts"). */
    noReturn: function (id) {
      var m = mat(id);
      return !!(m && m.nr);
    },

    /* Item-Wert eines Rezepts bei Verzauberungsstufe e.
       Führt das Spiel für das Erzeugnis selbst einen Item-Wert (alle
       Ressourcen tun das), gilt dieser - er ist die maßgebliche Zahl.
       Nur für Ausrüstung, Nahrung und Tränke wird über die Zutaten summiert.
       Grund: im Dump sind Rohstoffwerte gerundet (T5-Erz 5,34 statt 16/3),
       die Summe läge sonst bei 32,02 statt der amtlichen 32. */
    itemValue: function (recipe, ench, productId) {
      if (productId) {
        var own = mat(productId.replace(/@\d$/, ''));
        if (own && own.iv) return { value: own.iv, missing: [] };
      }
      var sum = 0, missing = [];
      recipe.forEach(function (r) {
        var id = matId(r[0], ench, r[2]);
        var m = mat(id) || mat(r[0]);
        if (!m || !m.iv) { missing.push(id); return; }
        sum += m.iv * r[1];
      });
      return { value: sum, missing: missing };
    },

    /* Nutzungsgebuehr je Craft */
    stationFee: function (itemValue, feePer100) {
      return itemValue * C.nutritionFactor * (feePer100 || 0) / 100;
    },

    /* --- Rueckgaberate ---------------------------------------------------
       Das Spiel zeigt an der Station einen "Produktionsbonus" B. Daraus
       ergibt sich die Rueckgaberate als  RRR = B / (1 + B).
       Gegengerechnet an allen vier bekannten Werten:
         B=58 %  -> 36,7 %   B=77 %  -> 43,5 %   B=117 % -> 53,9 %
       (Der Grundbonus betraegt genau genommen ~17,93 % und wird im Spiel als
        18 % angezeigt - daher dort 15,2 % statt rechnerisch 15,3 %.)
       Hideouts haben keinen festen Bonus: er haengt von Zonenqualitaet und
       Power-Cores ab, deshalb wird er eingegeben statt geraten. */
    rrrFromBonus: function (bonusPct) {
      var b = (parseFloat(bonusPct) || 0) / 100;
      if (b <= 0) return 0;
      /* Nach oben begrenzt wie die manuelle Eingabe: eine Rate nahe 100 %
         waere im Spiel unerreichbar und wuerde den Faktor 1/(1-r), mit dem
         Artefakte gegengerechnet werden, ins Absurde treiben. */
      return Math.min(b / (1 + b), 0.75);
    },
    /* Fokus erhoeht den Produktionsbonus um rund 59 Prozentpunkte. */
    focusBonus: 59,

    /* Zentrale Aufloesung aller Rueckgabe-Modi. */
    returnRate: function (mode, manualPct) {
      if (mode === 'manual') {
        var v = parseFloat(manualPct);
        return Math.min(Math.max(isFinite(v) ? v : 0, 0), 75) / 100;
      }
      if (mode === 'hideout' || mode === 'hideoutfocus') {
        var b = parseFloat(AO.settings.hideoutBonus);
        if (!isFinite(b)) b = 0;
        if (mode === 'hideoutfocus') b += AO.craft.focusBonus;
        return AO.craft.rrrFromBonus(b);
      }
      var p = AO.data.returnRates.filter(function (x) { return x.id === mode; })[0];
      return (p && typeof p.rate === 'number' ? p.rate : 15.2) / 100;
    },

    /* Steuer- und Gebuehrenfaktor beim Verkauf */
    sellMultiplier: function (premium, sellMethod) {
      var tax = premium ? C.taxPremium : C.taxNormal;
      return 1 - tax - (sellMethod === 'order' ? C.orderFee : 0);
    },

    buySide:  function (m) { return m === 'instant' ? 'sell' : 'buy'; },
    sellSide: function (m) { return m === 'order' ? 'sell' : 'buy'; },

    /* Der Schwarzmarkt fuehrt ausschliesslich KAUFORDERS - man verkauft in
       sie hinein und kann dort nichts erwerben. Was die API dort als
       "Angebot" fuehrt, sind Verkaufsorders anderer Spieler, also
       Konkurrenz, nicht der eigene Erloes. Deshalb gilt dort immer die
       Kauforder, unabhaengig von der eingestellten Verkaufsart. */
    sellSideAt: function (city, m) {
      if (city === AO.data.blackMarket) return 'buy';
      return AO.craft.sellSide(m);
    },
    canBuyAt: function (city) { return city !== AO.data.blackMarket; },

    /* Die Einstellgebuehr von 2,5 % faellt an, wenn man eine EIGENE Order
       aufgibt - nicht, wenn man eine bestehende bedient. Am Schwarzmarkt
       wird immer in eine vorhandene Kauforder hinein verkauft, dort gibt es
       also nichts einzustellen. Ohne diese Unterscheidung zog der Rechner
       dem Schwarzmarkt 2,5 % ab, die es gar nicht gibt. */
    sellOrderFeeAt: function (city, method) {
      return AO.craft.sellSideAt(city, method) === 'sell' ? AO.data.consts.orderFee : 0;
    },

    /* Steuer- und Gebuehrenfaktor beim Verkauf, abhaengig vom Handelsort. */
    sellMultiplierAt: function (city, premium, method) {
      var tax = premium ? AO.data.consts.taxPremium : AO.data.consts.taxNormal;
      return 1 - tax - AO.craft.sellOrderFeeAt(city, method);
    },

    /* --------------------------------------------------------------------
       Vollstaendige Kalkulation.
       opt = {
         recipe, ench, amountCrafted, crafts, returnRate (0..1),
         buyCity, sellCity, quality, premium, buyMethod, sellMethod,
         stationFee, focusPerCraft, useFocus, priceOf(id, city, q, side)
       }
       -------------------------------------------------------------------- */
    calc: function (opt) {
      var r = opt.returnRate || 0;
      var crafts = opt.crafts || 0;
      var out = crafts * (opt.amountCrafted || 1);
      var price = opt.priceOf || function (id, city, q, side) {
        return AO.market.get(id, city, q, side);
      };
      var buySide = AO.craft.buySide(opt.buyMethod);

      /* Selbst hergestellte Vorstufen werden nicht am Markt gekauft - auf sie
         faellt folglich keine Kauforder-Einstellgebuehr an. */
      var built = opt.isBuilt || function () { return false; };
      var rows = [], matTotal = 0, buyTotal = 0, missingPrice = [];
      opt.recipe.forEach(function (entry) {
        var id = matId(entry[0], opt.ench, entry[2]);
        var perCraft = entry[1];
        var noRet   = AO.craft.noReturn(id);      /* Artefakte kommen nie zurueck */
        var needRaw = perCraft * crafts;          /* ohne Rueckgabe */
        var need    = noRet ? needRaw : needRaw * (1 - r);  /* tatsaechlich einzukaufen */
        var back    = needRaw - need;             /* durch Rueckgabe gespart */
        var p = price(id, opt.buyCity, 1, buySide);
        if (p === null || p === undefined) missingPrice.push(id);
        var cost = need * (p || 0);
        matTotal += cost;
        var isBuilt = built(id);
        if (!isBuilt) buyTotal += cost;
        rows.push({
          id: id, base: entry[0], perCraft: perCraft, built: isBuilt, noReturn: noRet,
          needRaw: needRaw, need: need, back: back,
          price: p, cost: cost,
          name: AO.craft.matName(id),
          iv: (mat(id) || {}).iv || 0
        });
      });

      var ivInfo = AO.craft.itemValue(opt.recipe, opt.ench, opt.productId);
      var feePerCraft = AO.craft.stationFee(ivInfo.value, opt.stationFee);
      var feeTotal = feePerCraft * crafts;
      var orderBuy = opt.buyMethod === 'order' ? buyTotal * C.orderFee : 0;
      var focusTotal = opt.useFocus ? (opt.focusPerCraft || 0) * crafts : 0;

      var costTotal = matTotal + feeTotal + orderBuy;

      var sellPrice = price(opt.productId, opt.sellCity, opt.quality || 1,
                            AO.craft.sellSideAt(opt.sellCity, opt.sellMethod));
      var gross = out * (sellPrice || 0);
      var tax = gross * (opt.premium ? C.taxPremium : C.taxNormal);
      var orderSell = gross * AO.craft.sellOrderFeeAt(opt.sellCity, opt.sellMethod);
      var net = gross - tax - orderSell;
      var profit = net - costTotal;

      return {
        rows: rows, out: out, crafts: crafts, buyTotal: buyTotal,
        itemValue: ivInfo.value, missingValue: ivInfo.missing,
        missingPrice: missingPrice,
        matTotal: matTotal, feePerCraft: feePerCraft, feeTotal: feeTotal,
        orderBuy: orderBuy, costTotal: costTotal,
        sellPrice: sellPrice, gross: gross, tax: tax, orderSell: orderSell,
        net: net, profit: profit,
        perItem: out ? profit / out : NaN,
        margin: costTotal ? profit / costTotal * 100 : NaN,
        focusTotal: focusTotal,
        silverPerFocus: focusTotal ? profit / focusTotal : NaN
      };
    },

    /* Alle Item-IDs, die fuer eine Kalkulation Preise brauchen */
    idsFor: function (item, ench) {
      var ids = [AO.craft.productId(item, ench)];
      AO.craft.recipeFor(item, ench).forEach(function (e) {
        ids.push(matId(e[0], ench, e[2]));
      });
      return ids;
    },

    /* Produkt-ID inkl. Verzauberung.
       Ausruestung heisst im Markt "T4_MAIN_SWORD@1", raffinierte Ressourcen
       dagegen "T4_PLANKS_LEVEL1@1" - beides am Datenbestand nachgeprueft. */
    productId: function (item, ench) {
      if (!ench) return item.id;
      var lvl = item.id + '_LEVEL' + ench;
      if (AO.data.materials[lvl]) return lvl + '@' + ench;
      return item.id + '@' + ench;
    },

    /* Kann dieses Item ueberhaupt verzaubert werden?

       Zwei Bauarten: Ausruestung nimmt dieselben Zutaten in verzauberter
       Form (T4_METALBAR_LEVEL1) - erkennbar am Merkmal 1 in der Zutat.
       Traenke dagegen haben je Stufe ein eigenes Rezept: Grundrezept plus
       ein Arkanes Extrakt. Die liegen in "re". */
    enchantable: function (item) {
      if (item.re && item.re.length) return true;
      return item.r.some(function (e) { return e[2] === 1; });
    },

    /* Hoechste Verzauberungsstufe.
         Ausruestung          .4
         Traenke und Speisen  .3  (dafuer gibt es kein .4-Rezept)
         gar nicht verzauberbar  0
       Die Null ist wichtig: die beiden T1-Gerichte Gegrillter Fisch und
       Seegras-Salat haben kein Verzauberungsrezept. Gaeben sie hier 4
       zurueck, zoege ein einziges davon die Stufenleiste der ganzen
       Warengruppe Nahrung wieder auf .4 hoch. */
    enchMax: function (item) {
      if (item.re && item.re.length) return item.re.length;
      return AO.craft.enchantable(item) ? 4 : 0;
    },

    /* Das Rezept, das fuer diese Stufe wirklich gilt. */
    recipeFor: function (item, ench) {
      if (ench > 0 && item.re && item.re[ench - 1]) return item.re[ench - 1];
      return item.r;
    }
  };
})();
