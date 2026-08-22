# Technical documentation

*[Deutsche Fassung →](TECHNIK.md)*

This file describes **how** the toolkit calculates and **where** every number
comes from. For installation and a first overview, see the
[README in the project root](../README.md).

> This tool is a private project and **not affiliated with Sandbox
> Interactive**. Albion Online, its item names and its graphics belong to
> Sandbox Interactive GmbH. Prices come from the crowdsourced
> [Albion Online Data Project](https://www.albion-online-data.com/).

## Starting it

Double-click `index.html`. That's it.

> After an update, press **Ctrl + F5** once, otherwise the browser will show
> the old version from its cache.

## Layout

```
index.html              shell: sidebar, header bar, view container
css/
  tokens.css            colours, spacing, radii - every design value in one place
  base.css              reset, typography, form elements
  layout.css            sidebar, topbar, grid, breakpoints
  components.css        cards, tables, buttons, chips, key figures
js/
  core/
    format.js           number, date and text formatting (German)
    store.js            settings persisted in the browser
    market.js           loading market prices, caching, own prices
    ui.js               DOM helpers, segmented switches, toasts
    craft.js            crafting maths (costs, return, taxes, profit)
    router.js           sidebar navigation and hash routing
    i18n.js             language: item names and interface (de/en/es)
  views/
    _craftview.js       shared component for refining / crafting / cooking / potions
    batch.js            batch calculator: a whole category with your own prices
    upgrade.js          enchanting calculator (runes/souls/relics)
    craftscan.js        Crafting Deals (every craftable item)
    opportunity.js      opportunity search with a complete trade route
    refining.js         refining calculator (configuration, ~50 lines)
    …                   one file per tool
  app.js                startup: wire up the sidebar, start the router
data/
  meta.js               servers, cities, bonuses, constants
  items.js              1,530 equipment recipes
  refining.js           35 refining recipes (T2-T8, all 5 resources)
  consumables.js        84 recipes for food and potions
  fish.js               fish sauces and seaweed
  upgrade.js            enchanting recipes (runes, souls, relics)
  materials.js          materials with item values
  categories.js         category names
  sprachen.js           interface dictionary (German → English/Spanish)
```

### Why `data/*.js` and not `data/*.json`

Browsers block `fetch()` on local files (`file://`) for security reasons. The
files therefore contain plain JSON assigned to a global variable and loaded
through an ordinary `<script>` tag. Content and structure are identical to
JSON – only the wrapper differs. For the same reason **no ES modules** are
used: `<script type="module">` fails on `file://` because of CORS.

### Adding a new tool

1. Create `js/views/mytool.js` and set
   `AO.views.mytool = { id, title, subtitle, html(), mount(root) }`
2. Add `<script src="js/views/mytool.js"></script>` to `index.html`
3. Add an entry to `NAV` in `js/core/router.js`

Crafting-like calculators need no logic of their own – configuring
`AO.craftView({…})` is enough (see `js/views/cooking.js`, 15 lines). Refining,
crafting, cooking and potions share this one component, so they all behave
identically. Optional building blocks: `ench`, `quality`, `blackMarket`,
`selfCraft`, `overview`, `bonusCityOf`, `familyName`.

## Hideout crafting

Hideouts have **no fixed return rate** – it depends on zone quality and power
cores. The value is therefore not guessed but entered: the station in the
hideout shows a **production bonus** in percent, and the toolkit derives the
return rate from it.

The conversion is the official formula `RRR = B / (1 + B)`, checked against all
known values:

| Production bonus B | Return rate | equivalent to |
|---|---|---|
| 58 % | 36.7 % | bonus city |
| 77 % | 43.5 % | focus |
| 117 % | 53.9 % | bonus city + focus |

Focus adds roughly **+59 percentage points** to the bonus. (The base bonus is
strictly speaking ~17.93 % and is displayed in game as 18 % – which is why the
game shows 15.2 % rather than the calculated 15.3 %.)

The return-rate selector in the refining, crafting, batch and opportunity
calculators therefore offers **Hideout** and **Hideout + focus**. The bonus is
entered once and applies everywhere; it can also be changed under *Settings*.
The station fee (often 0 in your own hideout) is set as usual in the
"Fee /100 NV" field.

The **focus calculator** knows about hideouts too: pick the production location
(no bonus / city bonus / hideout) and see immediately what a focus point is
worth in silver there.

Don't forget: there is no market in a hideout – you sell in a city or at the
Black Market, and the transport there is not part of the calculation.

## Your own prices apply immediately and everywhere

A price you enter yourself – a relic, a soul, a bar – applies across the
**whole toolkit**, not just in the view where you typed it. To make that
visible, every price change announces itself once, debounced (`ao:prices`,
120 ms), to the rest of the interface:

* **The visible view recalculates immediately** – in the enchanting view
  including the entire flip list below it. A changed rune price therefore feeds
  through every path found, not just the detail calculation.
* **Hidden views** are marked dirty and recalculate the next time they are
  opened. If all fifteen recalculated on every keystroke, typing would crawl.
* **While you are typing**, the input field is not rebuilt. A rebuild would
  reset the half-typed number to the stored value, so it is deferred until you
  leave the field. The dependent numbers still update on every character.

Measured in the crafting calculator: typing "54321" changes the material cost
on every single character (350,733 → 417,216 → 1,080,691 → 7,714,086 →
74,046,682), and the field keeps both its content and the caret. In the
enchanting view, a rune price of 5,000 moves the material column of the flip
list from 3,168 to 1,440,000 (288 runes × 5,000) – without a new search.

Technically this also removes a bug: the flip list's cache used to key on the
**number** of own prices. That number does not change when an existing value is
corrected – so the list stayed put. Now a revision counter
(`AO.market.rev()`) counts every change.

## Three languages

German, English, Spanish – switchable in the header bar, and the choice
sticks. Switching reloads the page once, because the views carry their names
in the HTML.

### The item names come from the game

That is the core of it: the names are **not translated** but taken from the
game client's localisation (`ao-bin-dumps/formatted/items.json`). The tool
therefore shows exactly the name you see in the game:

| | |
|---|---|
| Deutsch | Breitschwert des Adepten |
| English | Adept's Broadsword |
| Español | Espada ancha del iniciado |

Every item carries three names in `data/items.js`: `n` English, `d` German,
`s` Spanish. When you switch, `js/core/i18n.js` sets the `n` field to the
chosen language – the views still simply read `.n` and did not have to be
touched. The English original is kept in `_en`, so switching works any number
of times in either direction.

Spanish names exist for **1,530 out of 1,530** equipment items, and likewise
for every material, dish, potion and refined resource. Ten entries with no
game name at all (internal prototypes) were dropped from the data while we
were at it – an item without an Albion name does not belong in a list that
searches by Albion names.

Category names ("Daggers", "Cloth – Robes") are **our** ordering, not the
game's. They live in `data/categories.js` in all three languages.

### The interface

The sixteen views build their HTML with German text. Rather than rewriting all
of them – and touching verified calculations in the process –
`js/core/i18n.js` translates the **finished DOM tree**: a dictionary in
`data/sprachen.js` maps the German text to its translation, and a
`MutationObserver` catches everything drawn later.

The side effect is exactly the one we want: **anything not in the dictionary
is left alone** – item names and numbers cannot be translated by accident.

Covered are navigation, view titles, column headings, field labels, buttons,
switches, chips, tooltips, the footer **and the long explanatory texts** –
**614 dictionary entries**.

### Sentences with numbers in them

Some of the text carries values that change on every redraw: "On 9 of 51 paths
…", "1,234 units in three weeks across all cities". Such sentences cannot be
matched by a fixed key.

The dictionary therefore understands **patterns with placeholders**: `{n}` for
a number, `{name}` for an item or city name. On first use these are compiled
into a regular expression, the captured pieces are substituted into the
translation in order, and the result is memoised – a table with a hundred rows
carries the same tooltip a hundred times.

```
"{n}Stück in drei Wochen über alle Städte"
   → "1.234 units in three weeks across all cities"
   → "1.234 unidades en tres semanas en todas las ciudades"
```

If several patterns match, the more specific one wins – measured by the length
of the key. Otherwise `{n}Stück` would have swallowed the longer sentence
`für {n}Stück · — je Stück`.

Of the 614 entries, **87 are such patterns**.

### Measured, not asserted

What was checked was not the size of the dictionary but the result: all
sixteen views were walked through with market data loaded and both the craft
and enchanting scans fully run, then every piece of text in the tree was held
against the item names of the language in question. What remains in **English
and Spanish alike is only numbers, city names and item ids** – not one German
sentence left.

Three things came to light that a pure word count would never have shown:

* Tooltips set **after** the node is inserted trigger no `childList` record –
  the observer now also watches `title`, `placeholder` and `aria-label`.
* `querySelectorAll` only finds descendants. When the observer hands in exactly
  the one table row that carries the tooltip, the root node itself has to be
  checked too – that affected 1,296 row tooltips.
* "z. B." contains a non-breaking space. Lookups now normalise it, but the
  original text is what gets replaced.

The summary line of the scans ("… with profit · 892 skipped for incomplete
prices · …") is assembled from segments, any of which can be omitted – 32
possible wordings. Rather than writing all of them down, each segment now sits
in its own `<span>` and is translated individually.

## Appearance: built on the real Albion values

The interface was redesigned from scratch – not by feel, but from values taken
from official sources: measured from Sandbox Interactive screenshots, sampled
from the item renderer `render.albiononline.com`, read out of the stylesheet on
`albiononline.com`, and taken from a developer reply on the official forum.

Three of my original assumptions turned out to be **wrong** and were corrected:

| Assumed | Established |
|---|---|
| Dark stone/slate as the window ground | **Warm parchment** `#eac7a1` → `#9e745e` with a wide dark-brown frame `#42332c` |
| A red "Buy" button | Buttons are **dark slate pills** `#2b2b33` → `#1a1917` with gold lettering `#e8d66a`. Red means something else in the market window: *you are paying above average* |
| "Albion is angular" | Windows are **noticeably rounded**, around 16–20 px at a 420 px window width |

### Colours and fonts

**Tier colours** come from a developer reply on the official forum and were
confirmed by measuring the item renderer:
T1 `#484047` · T2 `#635349` · T3 `#3f5131` · T4 `#355f78` · T5 `#77221a` ·
T6 `#c9712c` · T7 `#d1b044` · T8 `#d0d0d0`.

**Enchantment colours** from the official wiki (`Template:Enchantment color`):
.1 `#6bff91` · .2 `#49f1ff` · .3 `#bd89ff` · .4 `#ffb702`. They now colour the
decimal place of the tier badge, exactly as in the game.

**Fonts:** Lora (headings) and Open Sans (body text) – both are used by Sandbox
Interactive on their own website. The font of the game interface itself is
documented nowhere; four forum threads asking about it went unanswered, so
nothing is guessed here.

**Not a single view had to be touched.** All class names are unchanged; only
the four CSS files were swapped. The trick is in the tokens: `:root` carries
the light parchment world, and `.sidebar, .topbar` redefine **the same variable
names** with frame brown – which recolours everything inside them by itself.

### Four switches in the header bar

| Switch | Effect |
|---|---|
| **Light / Dark** | parchment or dark throughout |
| **Colours / Contrast** | see below |
| **Normal / Compact** | decides whether wide tables fit on screen |
| **Hide panel** | hides the settings column, giving tables ~340 px |

All of them remember their state and hang off attributes on `<html>`, so CSS
alone does the work.

### Contrast mode for red-green colour blindness

Green for profit and red for loss is precisely the distinction that fails with
red-green colour blindness – and it is the single most important number in the
whole tool. Contrast mode replaces it with the **Okabe-Ito** palette, which was
designed explicitly for colour vision deficiency:

| | light | dark |
|---|---|---|
| Profit | Blue `#005b8f` | Sky blue `#56b4e9` |
| Loss | Vermilion `#b34e00` | Orange `#e69f00` |
| Warning | Violet `#6d2a83` | Pink `#cc79a7` |

On top of that, profit and loss get a **▲ or ▼** in front – so the distinction
works entirely without colour. The tier badges dodge as well, since T2 is green
and T5 is red.

Measured across all four combinations of theme and colour mode: contrast ratios
between **5.0:1 and 10.1:1** – all above the 4.5:1 threshold.

### Everything fits on the screen

Previously the wide result tables pushed the whole page sideways – by up to
**862 px**. Two causes, both fixed:

1. Grid items default to `min-width: auto` and do not shrink below their
   content. With `min-width: 0` the table now scrolls inside its own box
   instead of the page.
2. The bronze fitting was a pseudo-element with a negative `inset` sitting
   outside the card, and counted towards the scrollable area. It is now a
   box-shadow ring – which takes up no space.

That left the two 14-column tables. **Compact** is therefore the default:
smaller padding, a wrapping name column, no item ids under the name, smaller
images. Measured at 1920×1080: **not a single table overflow across all 16
views.**

### Clearer

* **Navigation by task** rather than by origin: *Where is it worth it?* –
  *Calculators* – *Tools*, with the dashboard in front and the settings behind.
* **Collapsible panels**: large secondary tables can be folded away, and the
  state is kept per view. The content stays in the DOM so the calculations keep
  running.
* **Two-stage filter bars**: the important things in the first row, the fine
  detail behind "More filters". Crafting Deals and the enchanting view
  previously had up to ten controls side by side.

## What never comes back when crafting

The return rate does not apply to everything. Until now the distinction hung on
`shopcategory="artefacts"` – which covers artifact weapons, but by no means
every ingredient that stays consumed in the game.

The game data is more precise. Any ingredient of a recipe can carry:

```xml
<craftresource uniquename="T4_SKILLBOOK_STANDARD" count="1" maxreturnamount="0" />
```

That is the **Tome of Insight** in the Satchel of Insight – it does not come
back. Evaluated across the whole dump:

| | |
|---|---|
| Ingredients carrying the marker | 1,261 |
| of those marked in **every** recipe | 1,112 |
| of those marked only in some | 149 |

Only the unambiguous ones were adopted. The 149 ambiguous ones are exclusively
**transmutation recipes** (T4 fibre to T5 fibre, T4 fibre to T4.1 fibre) –
which the toolkit does not carry at all. In ordinary refining, wood, ore,
fibre, hide and stone of course still come back.

**126 ingredients** had to be newly locked as a result:

* the **Tome of Insight** (Satchel of Insight, all five tiers)
* the **base armor** and the **Royal Sigils** of the Royal armor sets
* the **cape blueprints** of the faction and artifact capes (70 of them),
  along with the base cape
* faction and mission tokens

What that amounts to, using 100 × *Adept's Satchel of Insight* in Martlock at a
36.7 % return rate: the tome costs 100 × 25,997 = **2,599,700** instead of a
calculated 1,645,610. The calculator was previously understating the cost by
**954,090 silver** – on a recipe whose material cost is 87 % that one tome.

## Refining: guild sales and every kind at once

Refining is a volume business. Two things were missing for that.

### Selling to the guild

A checkbox in the market column switches the calculator to direct trade with
guild members: the price is then the **market value minus a discount** (15 % by
default), and **neither sales tax nor order fee** applies – a hand-to-hand
trade knows neither.

Checked on 100 × T5 leather: through the market 4 % tax and 2.5 % order fee,
through the guild both zero. With premium the market leaves **93.5 %** of the
price – so **from a 6.5 % discount onwards you are giving money away rather
than saving it**. That is exactly what the hint under the switch says, and it
follows the settings: turn premium off and it reads 10.5 %.

The market value comes from actual trades across all cities, not from an offer.
It therefore needs trade data – in guild mode "Load market prices" fetches it
for the products of that view as well. If it is missing, the price stays empty
rather than being guessed.

The guild sale sits in the shared calculation core (`AO.craft.calc` accepts a
`guildPrice`) and could be enabled in any calculator; for now it is on in
refining only, because that is what was asked for.

### Every kind in a family, with the location

The panel **"All tiers compared"** was collapsed and only showed cost, sale,
profit and margin. It is now open and additionally names, per tier:

* **cheapest purchase** – the city where the material for that tier costs the
  least in total. If even one material price is missing there, that city drops
  out; a partial calculation would mislead.
* **best sale** – the location with the highest proceeds **after** tax and
  order fee. In guild mode it reads "to the guild".

The numbers behind them sit in the tooltip, not in the column. The reason: they
would have a different basis from their neighbours – material per craft
*before* the return rate against cost per unit *after* it. Side by side that
reads wrong.

An example from the test run (leather, buying and selling set to Caerleon):

| Tier | cheapest purchase | best sale | Cost / unit | Sale / unit |
|---|---|---|---|---|
| T5 Worked Leather | Fort Sterling | Caerleon | 1,723 | 1,595 |
| T8 Hardened Leather | Lymhurst | Brecilien | 18,313 | no sale price in Caerleon |

### A bug that came to light along the way

The T8 row previously showed **0** as the sale price and therefore a −100 %
margin – although there simply was no offer there. The cause is a JavaScript
quirk: `isFinite(null)` is **true**, because `null` becomes `0`. The formatter
therefore took the missing price for a valid zero.

`F.s()` and `F.sg()` now check explicitly for `null` and `undefined`. Since
then the row says "no sale price in Caerleon" instead of claiming a total loss.

## Profit overview in the single-item calculators

Below every single-item calculator there is now **"What is worth it right
now?"** – a table that runs **every item in that view** through the settings on
the left: same cities, same return rate, same fee, same enchantment. Clicking a
row loads it into the detail calculation above.

It sits in the shared calculator core, so it applies equally to **cooking,
refining, crafting and potions**. Columns: material, fee, cost per unit, sale
price, **sold/day**, data age, profit per unit, margin and silver per focus
point. Sortable by profit, margin or focus.

### Why the trade figures come along

A first draft loaded prices only. The list was then headed by niche goods:
*Avalonian Chicken Omelette* at **733 % margin** – with no indication that
anyone ever buys it. The overview therefore fetches the trade figures for the
products at the same time; that is a single extra request, because only the
items of that one view are involved.

With those figures the picture sorts itself out:

| Dish | Margin | sold/day |
|---|---|---|
| Avalonian Chicken Omelette T3 | 733.4 % | **2.6** |
| Avalonian Pork Omelette T7 | 29.8 % | **353.9** |
| Avalonian Beef Stew T8 | 16.1 % | **846.1** |

The smallest margin is the best business here. Rows below one unit sold per day
are shown in the warning colour.

Runtime: cooking and potions under a second, the crafting calculator with 834
complete calculations around **3 seconds**. Cross-checked: clicking *Avalonian
Pork Omelette* shows exactly the same numbers above as the row does (50,189
cost, 69,694 sale, +14,975, 29.8 %).

The full check – market value, fantasy offers, data age as a hard condition,
all product groups at once – remains the job of **Crafting Deals**. The
overview here is the quick glance, not a replacement.

## Enchanted potions and dishes

Potions and dishes can be enchanted – **T8.1**, **T7.2**, **T8.3** and so on in
game. The toolkit previously knew only the base level.

The construction differs from equipment. An enchanted sword takes the same
ingredients in enchanted form (`T4_METALBAR_LEVEL1`). An enchanted potion or
dish, by contrast, takes **the unchanged base recipe plus one ingredient**:

| | Ingredient that carries the enchantment |
|---|---|
| Potions | arcane extract `T1_ALCHEMY_EXTRACT_LEVEL1/2/3` |
| Dishes | fish sauce `T1_FISHSAUCE_LEVEL1/2/3` |

Using the T8 gathering potion as the example:

| Level | additionally | Focus (T8 gathering potion) |
|---|---|---|
| .0 | – | 1,319 |
| .1 | 90 × Basic Arcane Extract | 1,520 |
| .2 | 90 × Refined Arcane Extract | 1,920 |
| .3 | 90 × Pure Arcane Extract | 3,121 |

Quantities and yield of the other ingredients stay the same – verified across
all 40 potions and all 51 dishes. A level **.4 does not exist**; the game
carries no recipe for it. The tier bars therefore only offer `.0` to `.3`, and
Crafting Deals checks only those levels under "all".

Two dishes have **no** enchantment recipe at all: *Grilled Fish* and *Seaweed
Salad* – the two that only exist at T1 anyway. For them the bar shows only
"Normal".

That had a side effect which only showed up when measuring: `enchMax()`
returned `4` for items that cannot be enchanted. In the food group, a single
one of those two T1 dishes pulled the tier bar of the **whole group** back up
to `.4`. The function now returns `0` there.

Because the recipe differs per level, the ingredient lists live in
`data/consumables.js` under `re` (one entry per level). `AO.craft.recipeFor()`
picks one, `AO.craft.enchMax()` reports the highest level.

The levels are available in **all four calculators** that know about potions:
the potion calculator, Crafting Deals, the batch calculator and the
opportunities tab – each with a tier bar that stops at `.3`. In the focus
calculator it follows the selected item: sword `.0`–`.4`, potion `.0`–`.3`.

Established from `items.xml`: **91 of 104** craftable consumables carry an
`<enchantments>` block with levels 1 to 3. Checked by hand twice, both times
matching the calculator down to the silver:

| | Material | Fee | Sale per unit | Profit |
|---|---|---|---|---|
| T8 gathering potion .3, Martlock | 18,820,387 | 129,600 | 209,959 | **681,180** |
| T6 mutton stew .2, Martlock | 2,766,805 | 21,600 | 80,000 | **4,695,915** |

(City bonus 36.7 %, fee 800, premium, 10 crafts in both cases.)

### The rare ingredient does not come back

Every potion recipe contains a rare alchemy ingredient – spirit paws, runestone
tooth and the like. The return rate used to be applied to them, which made the
purchase come out too cheap.

The game data says so explicitly:

```xml
<craftresource uniquename="T7_ALCHEMY_RARE_ELEMENTAL" count="1" maxreturnamount="0" />
```

`maxreturnamount="0"` means: never returned. **21 ingredients** carry the
marker (seven families × T3/T5/T7); they are now flagged like artifacts. Over
10 crafts at a 36.7 % return rate that matters in full: 10 units instead of a
calculated 6.33.

The same marker also sits on **enchanted raw resources in equipment recipes**
(`T4_METALBAR_LEVEL1` and similar, around 250 entries). Whether that really
means they are not returned when crafting has not been verified here – so it is
left untouched there for now.

### Not every "_LEVEL" carries an "@" on the market

Adding this brought a second thing to light. Refined resources are called
`T4_METALBAR_LEVEL1@1` on the market; the arcane extract and the fish sauce,
on the other hand, are simply `T1_ALCHEMY_EXTRACT_LEVEL1`. Both forms were
checked against the API – the other one has an offer in **no** city at all:

| | without `@` | with `@` |
|---|---|---|
| `T4_CLOTH_LEVEL1`, `T4_ROCK_LEVEL1`, `T5_HIDE_LEVEL2`, `T6_WOOD_LEVEL1` | 0 offers | 6 offers |
| `T1_ALCHEMY_EXTRACT_LEVEL2`, `T1_FISHSAUCE_LEVEL2` | 3 resp. 6 offers | 0 |

The rewriting in `AO.market.marketId()` therefore checks a `pm` marker on the
material instead of going by the suffix alone.

## How many tiers a dish has

In the cooking calculator the tier bar looks short – for a salad it only offers
**T2, T4 and T6**. That is not a missing record: every dish exists at exactly
three tiers in the game, and which three differs per dish. Verified against the
dump:

| Dish | Tiers |
|---|---|
| Soup | T1, T3, T5 |
| Salad | T2, T4, T6 |
| Omelette, pie, roast | T3, T5, T7 |
| Sandwich, stew | T4, T6, T8 |
| Grilled fish, seaweed salad | T1 only |

So that it no longer looks like a gap, the tier bar now states explicitly which
tiers exist for the selected item – "Turnip Salad only exists in the game at
tiers T2, T4 and T6."

### New: the Avalonian dishes

**9 dishes** really were missing: Avalonian omelette (T3/T5/T7), sandwich and
stew (T4/T6/T8 each). They only entered the game after the last data export.
Added along with recipe, focus cost and stack size – one craft yields 10 units
each.

That brought a new material with it: **Avalonian Energy**
(`QUESTITEM_TOKEN_AVALON`, item value 64). It is fully tradable – offers
between 4,370 and 4,953 across all cities.

One assumption in there cannot be substantiated: whether the energy is returned
by the return rate when crafting. The dump carries no marker for it – the
existing rule in the toolkit comes from `shopcategory="artefacts"`, and a token
does not fall under that. **No return** is therefore assumed, which makes the
dishes come out too expensive rather than too cheap.

Cross-checked: Avalonian Goat Sandwich T4, item value 1,200 = 4×bread(40) +
8×goat meat(40) + 2×butter(40) + 10×energy(64).

## Data coverage

The item data comes from the official game data (`ao-bin-dumps`) and is not
maintained by hand. While adding the **tracking toolkit**
(`T3–T8_2H_TOOL_TRACKING`, 2 planks + 6 leather each, focus 245 to 4,021), it
became apparent that the export only knew the XML types `<weapon>` and
`<equipmentitem>`. Anything under a type of its own was missing.

Comparing today's dump against the data set – **209 items have since been
added**:

| Missing | Count | Cause |
|---|---|---|
| ~~Shapeshifter staffs~~ | ~~41~~ | own type `<transformationweapon>` – **added** |
| ~~Avalonian tools~~ | ~~35~~ | only entered the game after the last export – **added** |
| ~~Faction and artifact capes~~ | ~~79~~ | no `craftingcategory` – **added** |
| ~~Royal armor~~ | ~~45~~ | same cause – **added** |
| ~~Avalonian dishes~~ | ~~9~~ | new in the game – **added** |
| Repair kits | 5 | own type `<furnitureitem>` |
| T1 equipment | 2 | deliberately excluded (`t >= 2`) |

With that the gap is closed. A fresh comparison against the dump finds only
**10 missing items, and all of them are T1** – the tier that has been
deliberately excluded from the start (`t >= 2`), because it plays no role in
trade.

### Added: 76 items

**41 shapeshifter staffs** (T3–T8, six families: werewolf, boar, panther,
bloodmoon, crystal and Avalon) and **35 Avalonian tools** (T4–T8: axe, pickaxe,
sickle, skinning knife, stone hammer, fishing rod, siege hammer) – with recipe,
focus costs for all five enchantment levels, and which materials can be
enchanted.

Along with them came **26 materials**, 25 of them shapeshifter artifacts with
item values from the dump, all marked as *no return*.

One ingredient stays without an item value: **Rare Animal Remains**
(`T1_ALCHEMY_COMMON`) carries neither an `itemvalue` nor a recipe in the dump.
It is entered anyway, but **without a value** – the calculator then reports it
explicitly as missing instead of inventing a number. Exactly one item is
affected, the *Journeyman's Werewolf Staff*. The same applies to the
long-known *Rugged Werewolf Fangs*.

Cross-checked on the *Adept's Bloodmoon Staff*: 20×planks(16) + 12×leather(16)
+ 1×artifact(128) = **640**, with the werewolf fangs reported as missing.

### Added: capes and Royal armor

**124 further items**: 79 faction and artifact capes (Morgana, undead, demons,
Keeper, heretic, Avalon, smuggler and the seven city factions) plus 45 Royal
armor pieces (all three armor types × head, body, shoes × T4–T8).

These entries carry **no `craftingcategory` attribute** in the dump, and that
is exactly where the export gave up. The fallback rule is verified against the
dump and does not have to guess anything:

1. `craftingcategory`, where present – as before
2. otherwise `shopsubcategory1`, if it matches one of our categories. For armor
   it literally says `plate_armor`, `cloth_helmet`, `leather_shoes` – exactly
   our names
3. otherwise `cape`, if `shopcategory="capes"`. Capes carry
   `accessoires_capes_<faction>` or `other` there

Of the 124, the category came from rule 3 in 79 cases and from rule 2 in 45.

#### A pitfall with the item value

Royal armor is crafted from the **finished base armor** plus four Royal Sigils.
The base armor is therefore an ingredient and had to go into the material
table – but it carries no item value of its own; that follows from its own
recipe.

My first attempt produced no value for any of these pieces. The cause: a
`<craftresource uniquename="X" />` is self-closing and carries the same name as
the real element. My recipe index picked up these references as well and
therefore never found the matching recipe. Once self-closing tags were
excluded, it works out:

* *Adept's Soldier Armor* = 16 × steel bar(16) = **256**
* *Adept's Royal Armor* = base armor(256) + 4 × sigil(16) = **320**
* *Adept's Avalonian Cape* = cape(128) + crest(32) + 15 × energy(64) = **1,120**

Only five **faction tokens** remain without an item value – those are currency,
not a crafting product, and the dump carries neither a value nor a recipe for
them. They are entered but without a value; the calculator reports them
explicitly as missing.

They pay off immediately in Crafting Deals. Those figures are outdated now
that the base armor and the cape blueprint are no longer made cheaper by the
return rate – recalculated in Martlock, an *Adept's Undead Cape* now yields
+47,585 (22.3 %).

## Crafting Deals

The same instant view as the flip search, but for crafting: buy material in one
city, craft it with return rate and station fee, sell it – and see in one row
what is left over. It searches **all 1,672 craftable items**: equipment,
refined resources, food, potions and fish sauces.

The maths runs through `AO.craft.calc()` – that is, exactly the same
calculation as in the single-item calculators, not a second copy of it.
Clicking a row leads to the matching single-item calculator.

Everything the flip search has is included:

* **Enchantment** individually (.0 to .4) or *all* at once
* **Return rate** from city bonus, focus, hideout or entered by hand
* **Tradability**: units actually sold per day, from the real trade data of the
  last three weeks
* **Data age** as a hard condition
* **Market price or last achieved** as the basis, plus a filter against fantasy
  offers
* **Market value** across all cities as the item's worth
* **Guild sale** at market value minus a discount, tax-free
* Filters by **product group** and **tier**, sorting by profit, margin or
  **silver per focus point**

A run across all enchantment levels takes around **8 seconds** and produced
2,079 complete calculations in testing, 861 of them profitable.

Checked by hand, *Elder's Sickle* (T8, city bonus 36.7 %, fee 800):
6 planks × (1−0.367) = 3.798 at 33,450 plus 2 bars × 0.633 = 1.266 at 26,434
gives 160,509 material; item value 2,048 × 0.1125 × 8 = 1,843 fee;
198,984 × 0.935 − 162,352 = **23,698 profit**. The table shows the same
numbers.

### Never above the cheapest offer

When the basis is set to **last achieved**, the price in a city is now capped
at the current cheapest offer. Listing above that does not sell – you just wait
until the cheaper offers are gone.

The case that exposed it: *Adept's Mercenary Shoes .3* in Fort Sterling,
quality Normal. Over three weeks, 50 units sold there at an average of
**84,901** – but the cheapest offer now stands at **59,990**. The calculation
used 84,901 and reported a profit of +24,946; the real figure is **+17,240**.

**At the Black Market the cap does not apply**: there the reported price is the
game's buy order, not a competing offer – and it sits at a median 34 % below
what is really paid there. Verified: a *Grandmaster's Stalker Jacket .3* still
calculates with 2,732,174 achieved rather than the current buy order of
448,103.

Incidentally the case confirms that the quality is right: 84,901 is the Normal
average in Fort Sterling, 59,990 the Normal offer there. The Outstanding level
stood at 88,984 at the same time and never entered the calculation.

### Always the lowest quality

You cannot choose the quality when crafting – what comes out of the station is
overwhelmingly **Normal**. Calculating with a better level means computing a
price you will not actually reach.

The lowest level therefore applies in every craft calculation:

* **Crafting Deals**: no selector any more, fixed at Normal. Material is only
  traded in Normal anyway.
* **Crafting, cooking, potion and refining calculators**: Normal as the
  default. Anyone setting it higher sees an explicit note underneath:
  "Calculating with *Outstanding*. Crafting does not hand you quality for free –
  only Normal is reliable."
* **Batch calculator**: the same marking.

The **enchanting calculator** is not affected: there you buy the item, so the
quality is a real choice and is preserved through enchanting.

### Clicking a row

A click leads to the matching single-item calculator – equipment to the
crafting calculator, refined resources to refining, food and fish to cooking,
potions to the potion calculator – and sets it to **exactly that item**,
including enchantment, buying and selling city, quality, fee, return mode and
focus.

Initially only the view was switched, without passing the selection on – the
item still sitting there was whatever you had last picked yourself, so a
completely different one. The single-item calculators now have a
`select(itemId, assumptions)` interface: it resolves the family from the id
(`T5_2H_CLAYMORE` → `2H_CLAYMORE`, tier 5), sets the state and rebuilds the
controls.

Cross-checked: the same item shows the same numbers in both views – *Master's
Boltcasters* 79,305 cost, 223,957 sale, **+130,095** profit, 164.0 % margin;
likewise verified for refining, food, potions and an enchanted item (*Adept's
Mistwalker Jacket .2*, +53,441).

If you have just selected a name, the view does not switch – selection beats
click.

### A bug that came to light along the way

Enchanted resources are called `T4_METALBAR_LEVEL1` in the game data, but
`T4_METALBAR_LEVEL1@1` on the market. Material purchases used to go through the
id **without** the suffix – and the API returns no prices at all for that form.
Verified against wood, ore, fibre, cloth, bars and leather: the form without
`@` has no offer in any city, the form with `@` has one in all of them.

Every calculator that buys enchanted material was affected – crafting, batch,
opportunities and the new Crafting Deals. It became visible here: at
enchantment .1 there were **109** complete calculations, after the fix **664**.

The rewriting sits in the market layer (`AO.market.marketId`), not in the
calculators: they all continue to work with the id from the game data, and only
the market access speaks the market's language. It is idempotent – an id that
is already complete stays unchanged. Prices you entered yourself under the old
id are rewritten once.

Cross-check in the crafting calculator: `T4_METALBAR_LEVEL1` in Caerleon now
827 – identical to the API. For `T4_PLANKS_LEVEL1` the API really does report
no offer there, and the calculator says exactly that instead of inventing a
number.

## Enchanting calculator

For Black Market trading: buy a .0 weapon cheaply, upgrade it with runes, souls
and relics, and sell the .2 that people want.

Established from the game data (4,458 recipes, 1,240 enchantable items):

| Step | Material |
|---|---|
| .0 → .1 | runes |
| .1 → .2 | souls |
| .2 → .3 | relics |

The quantity depends on the item – sword 288, bow 384, helmet 96 – and is the
same across all tiers and levels. **Enchanting costs no silver** and no station
fee, only the material; tax and order fees apply as usual when buying and
selling. A **.4 cannot be enchanted** – the game has no recipe for it.

Selection is by **category and tier** (all 16 weapon types, armor, off-hand,
bags, capes – artifact weapons included), or by search. Item, material and sale
can each be set in different cities, and the sale can also go to the Black
Market.

**Flip overview:** one button searches **all 1,240 enchantable items** at every
tier and on every path (.0→.1, .0→.3, .2→.3 …) and lists what currently pays –
by default only the profitable paths, sortable by profit or margin, with a
minimum-profit filter. Clicking a row loads that path into the detail
calculation above. The search can optionally be narrowed to the selected
category.

That is around 5,000 price queries; they run in 25 blocks of 200 ids each,
throttled to 6 concurrent requests. Paths with missing prices do not appear but
are counted.

### Why the Black Market looked too bad

The Black Market does not carry standing prices but **buy orders that the game
constantly renews**. What the API reports as the highest buy order is therefore
a snapshot of a constantly changing order book – and systematically the worse
half of it.

Measured across **241 items** with trade data at the Black Market (a random
selection from all enchantable ones, enchantment 1–3):

| current buy order / actually achieved there | |
|---|---|
| Median | **0.66×** – i.e. 34 % below |
| Below the achieved price | 88 % of cases |
| Below 0.8× | 67 % |
| Below 0.5× | 34 % |

It is explicitly **not** a data quality problem: the Black Market prices are
actually fresher than the cities' (median 0.3 h against 6.1 h) and far more
complete (84 % of entries have a buy order against 9.5 % in the cities). The
number is correct – it is just a snapshot.

The calculator now says so where it matters: for the selected item, the current
buy order is shown next to the price actually achieved there, with the
deviation, and the flip search counts on how many paths the snapshot sits
below. A button switches to "last achieved". In the test run this raised the
number of profitable paths from **227 to 432**.

Both numbers are honest, they just answer different questions: the buy order
says what you get if you hand it over **right now**; the achieved price says
what was obtainable if you waited for a usable order.

#### Order fee at the Black Market – a real calculation error

This exposed something: when selling to the Black Market, the calculator
deducted a **2.5 % sell order fee** as soon as the settings said "sell order".
But that fee only applies when you place an order **of your own** – not when
you fill an existing one. At the Black Market you always sell into an existing
buy order; there is nothing to place there.

Fixed via `AO.craft.sellOrderFeeAt(location, method)`, which only applies the
fee where an order is actually placed. That now holds in every calculator that
goes through `AO.craft.calc()`. Profitable paths rose from 227 to 284, and the
rows add up cleanly: profit = sale × 0.96 − cost.

#### And a column that did not match the calculation

The "Sale" column kept showing the market offer even when the calculation used
the last achieved price or the guild price – profit and displayed sale price
visibly did not match. It now always shows the price actually used; the other
figure is in the tooltip.

### Guild sale

A checkbox in the left column switches the whole calculator to direct trading
with guild members. The price then follows from the **market value minus a
discount** (15 % by default), and neither sales tax nor order fee applies – a
hand-to-hand trade knows neither. The flip search calculates in the same mode,
so it sorts by what pays on that route.

**The market value can be overridden.** The field behaves like any other price
field: what you type beats what is calculated, and a ↺ restores the computed
value. This matters because our number is a reconstruction from real trades –
what the game client shows as *Estimated Market Value* may differ. If you read
it off in game, type it in.

#### Why the market route is always shown next to it

A discount off the market value is not a tax saving but a gift – and how large
it is only becomes visible in comparison. With premium, a normal sale through a
sell order leaves **93.5 %** of the price (4 % tax + 2.5 % fee). From about
**−6.5 %** onwards, a guild sale is therefore no longer cheaper but more
expensive than the market – without premium, from −10.5 %. Against an instant
sale into a buy order it looks the other way round: for equipment that sits at
a median 61 % of the offer, so a guild sale holds up to around −40 %.

The proceeds box therefore shows three numbers:

* **Break-even with the market route at −X %** – beyond that you are giving
  money away.
* **At this discount you are at zero: −Y %** – the hard floor.
* **Net via \<selling city\>** – what the same item would have made on the
  market.

If the guild price falls below the cost of acquisition, the box turns red. If
even the full market value does not cover the cost, it says so explicitly –
then the item is not suited to this route.

An example from the test run that saves you from exactly that: *Expert's Mage
Sandals .3* cost 182,124 to make. The Black Market pays 257,652 for them, but
the market value across all cities is only 109,423. A guild price at −15 %
would have been **93,010** – a loss of 89,114 per unit, while the same item
would have made 58,781 profit at the Black Market.

#### Two phases in the search

The flip search only fetches trade data for promising paths – otherwise it
would be over 100 MB. But the market value comes from exactly that trade data.
Without a precaution the pre-selection in guild mode therefore finds nothing,
loads nothing and stops at zero hits (on the first attempt: 3 paths checked
instead of 9,238).

The fix is an upper bound: the pre-selection calculates with the full market
price without any deductions – no guild price can beat that. Whatever fails
that hurdle is not worth considering as a guild sale either. Afterwards it
calculates properly with the loaded market values: 1,411 complete paths, 59 of
them profitable.

### Which paths appear in the list

Next to the tier filter there is a row of switches for the six enchanting paths
– *.0 → .1, .0 → .2, .0 → .3, .1 → .2, .1 → .3, .2 → .3*. Multiple selection:
one click shows a path, a second hides it again, *All paths* resets. The search
still covers everything as before; only the display is filtered, and switching
takes around 0.4 seconds.

Tier and path filters combine – *T5* plus *.2 → .3* shows exactly the
intersection.

### Market value

The game shows an **Estimated Market Value** in the marketplace. The game server
computes that number itself and does not publish it: the Data Project endpoint
only knows `sell_price_min` / `buy_price_max` and the trade history. It is
therefore reconstructed from the same basis the game builds it from – actual
trades: the volume-weighted average
of the last three weeks across **all cities** combined.

The column sits next to "last achieved" and refers to the item you are
**selling**. The difference between the two is the actual point: "last
achieved" applies at the chosen selling location, the market value to the item
in general. For the *Expert's Mage Sandals .3*, for instance, the Black Market
pays 231,779, while across all cities 109,423 was paid (21 units in three
weeks) – that premium is exactly why the route there pays off.

The **Black Market stays out of it**: there it is not a player buying but the
game, at prices entirely of its own. For the T4 spear, 7,191 of 9,327 units
traded came from there and lifted the value from 4,855 to 7,614 – a number at
which you cannot obtain the item anywhere.

Cross-checked directly in the running client against the API endpoint, with the
same city list: 21 units, 109,423.24 on both sides.

#### A bug that surfaced along the way

Trade data used to be **overwritten** only, never removed. But a response
always covers all the cities queried – where nothing is traded any more,
nothing should be recorded any more. Otherwise the data set drags along trades
that have long since fallen out of the time window.

It became visible on the T4 spear: the calculator carried 9,327 units across
six cities, the API reported 2,364 across four – including Caerleon with 100
units at an average of 17,054, where nothing is traded at all right now. The
old data for the queried items is now discarded before the new data is written
(failed blocks keep their state). Measured across three consecutive searches:
21 units / 109,423 – constant and matching the API.

### Keeping tiers apart

The search over **everything** stays as it was – it still checks every
enchantable item at every tier. What is new is a **tier switch** above the
result list (*All tiers · T4 · T5 · T6 · T7 · T8*) that only changes the
display. Nothing is searched again: switching takes around 0.4 seconds, because
it only filters and sorts.

Below the info line it also shows how the hits are spread across tiers ("shown
per tier: T4 10 · T5 16 · T6 11"). Those numbers are switches themselves – one
click filters to that tier, a second switches back.

The counting happens **after** all the other filters. A first draft counted
before them and reported "T7 15" while nothing was listed under T7 – the
minimum profit had long since removed them. The breakdown now sums exactly to
the number of rows shown (10 + 16 + 11 = 37).

The choice survives a change of view.

### Buy order applies to the material only

The **buy order** switch affects only **runes, souls and relics** in the
enchanting view. The item itself is always bought **instantly**, and the 2.5 %
placement fee accordingly only applies to the material.

The reason is market reality: placing a buy order for a particular weapon in a
particular quality and waiting for a seller to fill it practically never works.
Enchanting material, by contrast, is bulk goods that moves constantly.

Measured on the loaded data set (39,897 equipment entries, all cities):

| | highest buy order as % of the offer (median) | share below half the offer |
|---|---|---|
| Equipment | **61.1 %** | 34.6 % |
| Runes / souls / relics | **91.8 %** | 2.0 % |

For material, offer and buy order sit close together – an order there really
does get filled. For equipment a third gapes between them; calculating with
that price would have made the purchase systematically too cheap.

The old version got in the way twice over: where there was no buy order at all
– which was the case for the three most promising paths of the test run – the
path counted as "without complete prices" and disappeared from the list
entirely.

### Tradability

A price only says what someone is *asking* – not whether anyone ever buys. In a
second step the search therefore fetches the **real trade figures** of the last
three weeks (history endpoint, `item_count` = units actually sold per day) and
checks **both ends**: can the starting level even be bought at the buying
location, and does anyone take the target level at the selling location?

The "Volume/day" column shows both (buy / sell), and a minimum value filters
out dead goods. A real case shows why this is needed: the Grandmaster's Clarent
Blade sat in first place with **+367,213 silver profit** – but at the buying
location it had not been traded **a single time** in three weeks. With the
filter it disappears; without it, it heads the list.

Trade data is many times bulkier than prices – across all qualities it would be
more than 100 MB for the whole data set. The calculation therefore runs first,
and only afterwards are the **promising paths** checked for tradability. If no
trade data exists for an item, it is not quietly discarded – the check only
applies where there is data at all.

### Data age

A price is only as good as its last scan. For every path the search therefore
tracks how old the **oldest price involved** is – purchase, material and sale
taken together – and shows it in the "Data" column (green under 3 h, grey under
24, yellow above). A selector throws out anything older.

What difference that makes is shown by a real run: at "max. 24 h" there were 51
paths in the list, headed by **+53,766 silver** – but the prices behind it were
**12 hours old**. At "max. 3 h", **2 paths** remained, the best at +4,590.
Around 9,000 paths dropped out because of stale data.

Prices you entered yourself always count as fresh – they came from you, after
all.

### Offer versus the price actually achieved

An offer is a claim, not a deal. Listing a Deathgivers at 5,000,000 does not
mean you have sold it – yet it still headed the search at **+3.8 M profit**.

From the same trade data that already feeds the volume check, the
**volume-weighted average of the prices actually paid** over the last three
weeks is therefore also computed (`avg_price` weighted by `item_count`). It
appears in the new **"last achieved"** column right next to the sale price; if
the offer sits more than 50 % above it, the sale column turns yellow.

Two adjustments alongside it:

* **Basis** – *market price* (current offer or buy order) or *last achieved*.
  The second setting runs the whole path through with the price at which
  trading really happened.
* **"at most ×N above achieved"** – throws out paths whose sale price exceeds N
  times the achieved price (default 2, `0` disables it). Skipped paths are
  counted: "… · 4 skipped for fantasy offers".

Verified on the reported case: with the 5 M offer as an own price, the search
reports exactly **1 skipped for fantasy offers**. The real offer had meanwhile
come down to 850,309 against 723,621 achieved – a factor of 1.2, so
unremarkable; switching to *last achieved* drops the profit from +198,571 to
+80,118.

Where no trade data exists the check does not apply – it discards nothing
blindly.

### Quality levels

Quality is preserved through enchanting: a weapon bought in *Good* stays
*Good*. That makes every quality level a trade of its own with its own prices
on both sides. The **"all qualities"** switch searches all five levels and
reports in a column of its own which one is meant; clicking the row loads it.

A full scan across all qualities checks around **9,250 paths** and takes about
**6 seconds**.

In addition, a table compares all reachable target levels for the selected item
side by side. If a price is missing, the calculator refuses to state a profit
rather than inventing a number.

Not enchantable and therefore not in the selection: **tools** as well as **T2
and T3 equipment** – the game has no enchantment for those at all.

## The free calculator

Every other calculator takes the recipe off your hands. This one takes nothing
off your hands – and that is the point: you enter **what you buy**, **what
comes out of it** and **which fees** you apply.

What it is for: a trade with no crafting at all, a hideout with a fee that is
written down nowhere, an arrangement with your guild, a recipe the game has
just changed – anything that fits no stored recipe.

| Adjustable | |
|---|---|
| Type | *Crafting* (with return rate and station fee) or *Trading only* |
| Return rate | free, with the known values as buttons beside it |
| Fee | silver per craft, exactly as the station shows it |
| Tax | free, 4 % by default |
| Order fee | free, switchable per side |
| Guild sale | tax and order fee do not apply |

It stays convenient nonetheless: **every row can carry a real item**. Name,
image and – at the push of a button – the market price then come by
themselves, while numbers you typed in stay as they are. If you would rather
type, just type a name.

For each purchase row you can also decide whether the return rate applies to
it. An artifact never comes back; that is one click.

At the bottom stand costs, net proceeds, profit, margin – and the **break-even
price** per unit. Rows without a price are counted and named explicitly rather
than slipping through as zero.

Verified on a sheet with 100 crafts (16 bars at 500, 8 leather at 400, 1
artifact at 20,000 with no return, return rate 36.7 %, fee 1,500, sale
60,000):

| | by hand | in the calculator |
|---|---|---|
| Purchase | 2,708,960 | 2,708,960 |
| Total cost | 2,858,960 | 2,858,960 |
| Profit | 2,751,040 | **2,751,040** |

With a guild sale the profit rises by exactly 390,000 – the 6.5 % of tax and
order fee on 6,000,000 of revenue. In trading mode the return rate and station
fee fall away, and the purchase rises to the full 3,120,000.

The sheet lives in the browser storage and survives a restart.

## The kitchen's processing products

**Potato Schnapps** and **Pumpkin Moonshine** were missing as craftable items,
although they had long been in the data as ingredients. The reason lies in the
extraction again: these products sit in the dump not as `<consumableitem>` but
as `<simpleitem>` with `shopsubcategory1="farmingproducts"`.

All 14 have been added:

| | |
|---|---|
| Spirits | Potato Schnapps (T6), Corn Hooch (T7), Pumpkin Moonshine (T8) |
| Butter | goat's, sheep's, cow's butter (T4/T6/T8) |
| Grain | flour (T3), bread (T4) |
| Meat | chicken through cow (T3–T8) |

They appear in the cooking calculator under the new category **Processing**.
Along with them came six materials that were still missing: the live animals
(chicken, goat, goose, sheep, pig, cow) that the raw meat comes from. They sit
in the dump only as a reference without a tier of their own – that is derived
from the id.

There is **no enchantment for these products**: the dump carries none, and none
is traded on the market either (checked for spirits, butter and bread – zero
offers on `@1`).

## Batch calculator

For when you want to put a whole category to the test at once – and do not
trust the market prices anyway.

Pick a category (e.g. plate helmets, T4) and all its items are listed one below
the other. **At the top** you enter the prices of the shared resources (steel
bar, leather …); they apply to every row immediately, each with the quantity
that row's recipe needs. **In the row** you can enter a different price for the
same resource for one particular item, as well as the artifact price (which
belongs to that one piece anyway) and the sale price.

Everything entered is stored permanently and survives any restart.
Gold-outlined fields are your own values; `↺` goes back to the price from the
top, or to the market price.

Price precedence per field: row entry → own price (top) → market price.

## Opportunities tab

Searches within a product group (refining, food, potions, fish) for what
currently pays best – and names the **complete route**: in which city each
material is cheapest, where it is refined or crafted, and where the product
sells best. Clicking the row unfolds the individual prices.

Two rules keep false opportunities out:

- A row appears **only** if every price is available – every material and the
  end product. Incomplete ones are counted and reported, but not displayed.
- Prices that are too old are dropped as well (configurable, default 24 hours).
  Stale data otherwise creates phantom opportunities.

## Fish sauces

Basic, Fancy and Special Fish Sauce as well as Seaweed appear in the cooking
calculator and in the opportunity search. They sit in the dump as `simpleitem`
of the category "fish" and have, according to the game data, an **item value of
0** – so no station fee applies.

## Language

German, English, Spanish – switchable in the header bar and under *Settings*.
The choice applies to the interface **and** the item names; the names are not
translated but taken from the game's own localisation. All three sit in the
data files (`n` = English, `d` = German, `s` = Spanish). Details in the
[Three languages](#three-languages) section.

## Black Market

The Black Market is located in Caerleon but is a **separate location** in the
API with completely different prices – the difference decides between profit
and loss (example, T4 broadsword: 23,999 on the Caerleon market against 9,717
as a Black Market buy order). It is therefore offered as a selling location of
its own in the crafting calculator. It trades **equipment only**, no resources –
so it does not appear in the refining calculator.

The Black Market carries **buy orders exclusively** – you sell into them and
cannot buy anything there. Therefore:

- It is **not offered as a buying location**.
- When selling, the **purchase price always applies** (the highest buy order),
  even if "sell order" is set. What the API lists as an "offer" there are other
  players' sell orders – competition, not your proceeds. For the Adept's Spear
  .3 that was 246,887 as an offer against **227,400** as a buy order; only the
  second number is what you actually get.
- The hint states the scan age of that purchase price and warns: a buy order
  has a **limited quantity**. Buying it out pushes the price down to the next,
  usually much lower order – a second flip of the same item often no longer
  pays.

## Where the numbers come from

| Quantity | Source |
|---|---|
| Recipes, focus costs, item values | official game data ([ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps)) |
| Market prices | [Albion Online Data Project](https://www.albion-online-data.com) (crowdsourced) |
| Item images | Albion Online Render Service |

**Verified formulas**

- Item value of resources = `2^(tier + enchantment)` – confirmed without
  deviation for all 115 refined entries
- Item value of craftable items = the sum of the ingredient values
  (cross-check, T4 metal bar: 2× T4 ore (4) + 1× T3 bar (8) = 16 ✓).
  If the game carries a value for the product itself, that one applies – raw
  resource values are rounded in the dump (T5 ore 5.34 instead of 16/3), so the
  sum would otherwise give 32.02 instead of the official 32.
- Market ids for enchanted goods: equipment is called `T4_MAIN_SWORD@1`,
  refined resources on the other hand `T4_PLANKS_LEVEL1@1` – both checked
  against the API
- Station fee per craft = `item value × 0.1125 × station fee ÷ 100`
- Return rate: returned material is processed further → consumption = demand ×
  (1 − rate). **Artifacts excepted** – they are always fully consumed when
  crafting and never come back
  ([Albion wiki](https://wiki.albiononline.com/wiki/Resource_return_rate)).
  Detected via `shopcategory="artefacts"` from the game data; 705 materials are
  marked accordingly (`nr=1` in `data/materials.js`). The material table shows
  "no return" there instead of a returned quantity.
- Selling: 4 % tax with premium, otherwise 8 %; buy and sell orders each 2.5 %
  placement fee, instant purchase free of charge

**Deliberately adjustable rather than guessed** – these two values are *not* in
the official game data:

- Which city favours which category for **item crafting**. In the crafting
  calculator you therefore choose the return rate directly (the percentages
  themselves are documented). The **refining** bonuses, by contrast, are known
  and hard-coded.
- The conversion factor for **crafting fame**. The fame calculator can be
  calibrated against the crafting window in seconds: enter the fame shown there
  once, and the factor then applies to every item.

For 26 of 1,418 recipes the game carries no item value for individual
ingredients (mob drops such as werewolf fangs). These do not raise the station
fee; the affected calculators report it.

## Reviewed

The calculation logic was checked by a second, independent pass (reading plus
numerically reproducing it in Node). Four errors came out of it and have been
fixed:

1. With "craft the previous tier yourself", the **sale price of the end
   product** was also replaced by your own production cost as soon as the
   buying and selling city were the same – the profit collapsed. The
   substitution now affects materials only.
2. The **buy order fee** ran across all materials, including self-made ones
   that are not bought on the market at all. It now sits only on the actual
   purchase; conversely, the self-crafting chain was missing the 2.5 % on its
   own raw materials.
3. The **language switch** did not reach the item selection lists, because
   their family list was cached.
4. The **tier comparison** calculated T2/T3 with an enchantment that does not
   exist there, and queried non-existent market ids for it.

## Known quirks

- **Row prices in the batch calculator apply regardless of the buying city.**
  If you enter a material price there for an item, it stays after a change of
  city. That is deliberate – the whole point of the entry is a price you trust.
  The gold outline shows you immediately where your own values are; `↺` takes
  the price from the top again.
- **Own prices are tied to the server.** A price entered for Europe does not
  apply on the Asia server, and does not hide the real market price there.

## Prices

Market data is loaded **only at the push of a button**, never automatically in
the background. Every price field can be overridden; your own prices take
precedence and survive every update. `↺` resets a field to the market price.
The coloured dot shows the age of the data (green < 3 h, yellow < 24 h, red
older, grey = no data).

Everything is kept in the browser alone (localStorage). Under *Settings* it can
all be reset individually or completely.

---

Unofficial fan tool. Albion Online is a registered trademark of Sandbox
Interactive GmbH; this project has no connection to it.

---

# Windows client

The toolkit also comes as an **installable Windows program** with its own
window and Start menu and desktop entries. The calculator itself is the same:
Electron loads exactly the `index.html` that also works by double-clicking.
**No server, no hosting, no port forwarding.**

## As a user: installing

1. On the *Releases* page, download `AlbionToolkit-Setup-x.y.z.exe`.
2. Run it, choose a target folder, done.

**On first start Windows SmartScreen will warn you**, because the installer is
not code-signed. That is the normal case for small open-source tools and says
nothing about the contents – a signature costs between 100 and 400 € a year
depending on the provider. To continue: *More info* → *Run anyway*. If you
would rather not, take the folder from the source code and open `index.html`
directly – it is the same application.

## As a developer: building

```
npm install          # once, fetches Electron and electron-builder
npm start            # to try it out, opens the window
npm run dist         # builds dist/AlbionToolkit-Setup-x.y.z.exe and the ZIP
```

All you need is Node.js. **The calculator itself needs none of it** –
`index.html`, `css/`, `js/` and `data/` stay unchanged and still run without
any toolchain at all. Node is only there for packaging.

`node_modules/` and `dist/` are in `.gitignore` and do not belong in the repo.
The source goes into the repo, the finished `.exe` onto the release.

### Automated build

`.github/workflows/release.yml` builds installer and ZIP on GitHub and attaches
them to a release. It is triggered by a tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

The workflow can also be started by hand (*workflow_dispatch*); the files then
hang off the run itself as artifacts. `--publish never` matters in the build
step: with a tag present and a `repository` field in package.json,
electron-builder would otherwise try to create the release itself and demand a
token for it. The upload is done by the last step instead.

## What is inside the shell

`electron/main.js` is deliberately thin: one window, load the file, remember
size and position. On the security side `nodeIntegration` is **off** and
`contextIsolation` is **on** – the page gets no access whatsoever to the file
system. Nor does it need any: it calculates and asks two external services for
prices and images.

External links open in your real browser rather than in a second window without
an address bar. The menu offers *Reload*, zoom, full screen and the developer
tools – the latter help when a price query gets stuck.

The application icon (`build/icon.ico`, six sizes from 16 to 256 px) is drawn
from scratch – an anvil in gold on dark slate. Sandbox Interactive's item
graphics belong to them and were not used for it.

## A notice when something new is out

The Windows client **checks quietly at startup** whether a newer version
exists. If there is nothing, you notice nothing. If there is, a dialog offers
three choices: *Download now* · *Later* · *Skip this version*.

Deliberately it only **asks** – nothing is downloaded and nothing is installed.
One click opens the release page in your browser, and you run the installer
yourself as before. The reason is concrete: a real self-update
(`electron-updater`) verifies, on Windows, the signature of the downloaded file
against that of the running one. Since nothing here is signed, that check would
have to be switched off – one security level less for one click less. Not worth
it.

The query goes to the GitHub releases endpoint, once, with eight seconds of
patience. **Every failure ends silently** – no network, GitHub unreachable,
unparseable answer: then nothing happens. An error dialog at startup would be
worse than a missed version.

The rest of it:

* The dialog speaks the language of the interface. It is read from the page
  (`AO.i18n.lang()`); if that fails, German it is.
* Skipping a version means you are not asked about that one again. `update.json`
  in the user data remembers it.
* The version comparison works on numbers, not text – otherwise `1.10.0` would
  be older than `1.9.0`. Pre-releases (`-beta`) trigger nothing.
* It only runs in the installed build. During development it would be noise;
  `AO_UPDATE_TEST=<version>` enables it for verification.

Measured: with a faked version 1.0.0 the dialog appears reading "Albion Toolkit
1.0.1 ist da." with the three buttons; with the real version it does not
appear; a failed query leaves no crash behind.

One limitation in the nature of the thing: **anyone on 1.0.1 or older will not
get this notice** – it is not in there yet. That one update has to be fetched
by hand.

## What the program sends over the network

Nothing of yours. Outbound there are only:

* **Prices** from the Albion Online Data Project (`*.albion-online-data.com`) –
  and only at the push of a button, never on its own.
* **Item images** from the official renderer (`render.albiononline.com`).
* **Fonts** from Google Fonts. Without a network connection the fallback fonts
  take over.
* **One line to the GitHub releases endpoint** at startup, to find out whether
  a newer version exists. Nothing is sent beyond the request itself.

A Content Security Policy in `index.html` enforces exactly that list: no
foreign script, no form submission, and connections only to those three hosts.
It was checked against real operation – loading prices, item images and the
Lora font all work, nothing is blocked.

Your own prices, settings and display choices live in the local storage of your
machine. There is no login, no account and no tracking pixel.

## Donations

The toolkit is free and stays free. The footer carries a PayPal.Me link for
anyone who wants to leave something voluntarily:
<https://www.paypal.com/paypalme/DevEnvi24>

**With nothing in return** – that is not a figure of speech but the point: as
soon as anything is owed in exchange for a contribution (access to features,
freedom from ads, requested extensions), it becomes payment for a service and
therefore a commercial activity. The text therefore promises nothing, and will
not promise anything.
