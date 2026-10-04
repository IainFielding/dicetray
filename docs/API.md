# Sogrom's Dice Tray — API

Other modules, systems and macros can work with the dice tray through a small API and a set of
hooks. Everything here is a public contract: names won't change without a major version.

```js
const tray = game.modules.get("sogrom-dicetray")?.api;
```

The API exists from Foundry's `init` hook onwards (the module calls `sogrom-dicetray.init` as soon as
it does), so a system or module can register a system map before any tray is drawn.

## Methods

| Method | Returns | What it does |
|--------|---------|--------------|
| `registerSystem(systemId, map)` | — | Give a game system its own default dice and mode buttons, or replace a built-in map. See [System maps](#system-maps). |
| `getLayout()` | `DiceButton[][]` | The rows of buttons the tray shows: the GM's layout, or the system's default. A copy. |
| `getModes()` | `Record<string, RollMode>` | The mode buttons (advantage and the like) for this world's system. A copy. |
| `getPool()` | `{dice, mode, modifier, keep}` | The pool as it stands, e.g. `{ dice: { d20: 2 }, mode: "advantage", modifier: 3, keep: {} }`. |
| `getFormula()` | `string` | The formula the pool would roll right now, or `""` when it is empty. |
| `add(formula, times = 1)` | `boolean` | Add dice as if a button with this formula were clicked `times` times: `add("d6", 3)`, `add("4dF")`. `false` if the formula isn't a single dice term or the per-die limit (99) is reached. |
| `remove(formula, times = 1)` | — | Take dice back out: `remove("d6")`. |
| `setModifier(value)` | — | Set the flat modifier (−99 to 99). |
| `setMode(mode)` | — | Turn on one of the system's modes (`"advantage"`, `"disadvantage"`, `"wild"`, …), or turn them off with `null`. |
| `clear()` | — | Empty the pool: dice, keep modifiers, mode and modifier. |
| `roll()` | `Promise<ChatMessage \| null>` | Roll the pool to chat, then empty it. |
| `rollFormula(formula, {flavor})` | `Promise<ChatMessage \| null>` | Roll any formula to chat the way the tray does, hooks included. |
| `toggleWindow(open)` | `Promise` | Open (`true`), close (`false`) or toggle (omitted) the pop-out tray window. |
| `getStats(user = game.user, {today})` | `object` | A user's roll statistics: `{ rolls, d20: { count, mean, nat20, nat1, faces }, dice: [{ faces, count, mean, expected }] }`, for all time or (with `today: true`) today. |
| `openStats()` | `Promise` | Open the roll statistics window. |

Rolls use the chat message mode (public, GM, blind, self) the player has selected.

### Example: macros

```js
const tray = game.modules.get("sogrom-dicetray").api;

// Set up a pool and open the tray, so the player can adjust it and press Roll.
tray.clear();
tray.add("d8", 2);
tray.setModifier(3);
await tray.toggleWindow(true);

// Or roll something straight away, through the tray's hooks.
await tray.rollFormula("4d6kh3", { flavor: "Ability score" });
```

## Hooks

| Hook | Arguments | When |
|------|-----------|------|
| `sogrom-dicetray.init` | `api` | During Foundry's `init`, once the API exists. The place to call `registerSystem`. |
| `sogrom-dicetray.ready` | `api` | When the world is ready. |
| `sogrom-dicetray.preRoll` | `data` | Before every roll the tray makes. `data` is `{ formula, flavor, source }`, where `source` is `"tray"` (the Roll button, Enter or a shortcut), `"rightClick"`, `"drop"` (a die dropped on the canvas) or `"api"`. Change `formula` or `flavor` in place, or return `false` to cancel the roll. |
| `sogrom-dicetray.roll` | `roll, message, data` | After a roll is posted to chat. |
| `sogrom-dicetray.poolChanged` | `pool` | Whenever the pool changes; `pool` is the same shape as `getPool()`. |

### Example: add a bonus to every roll made from the tray, or stop empty-handed rolls

```js
Hooks.on("sogrom-dicetray.preRoll", data => {
  if ( data.source === "api" ) return;                // leave macros alone
  if ( game.user.character?.statuses.has("blessed") ) data.formula += " + 1d4";
  if ( !game.user.character ) return false;           // cancel: no character assigned
});
```

## System maps

A system map gives a game system its starting dice and its mode buttons. The module ships maps
for dnd5e, pf2e/sf2e, Daggerheart, SWADE, DCC, Fate, Star Wars FFG/Genesys, Alien RPG, Cosmere RPG
and Shadow of the Demon Lord; every other system gets the standard dice and roll-twice advantage.
A map registered through the API wins over a built-in one.

```js
Hooks.once("sogrom-dicetray.init", api => {
  api.registerSystem("my-system", {
    // The default layout: rows of buttons. The GM can still change it in Configure Dice.
    rows: () => [[
      { formula: "d6" },
      { formula: "d10", drawer: [{ formula: "d100" }] },
      { formula: "dx", label: "Stunt", tooltip: "MYSYSTEM.StuntDie", img: "systems/my-system/stunt.svg" },
      { formula: "/stunt", label: "Stunt!" }            // a chat command, run on click
    ]],
    // The mode buttons. Omit `modes` for generic advantage/disadvantage, or set it to null for none.
    modes: {
      advantage: { label: "MYSYSTEM.Edge", tooltip: "MYSYSTEM.EdgeHint", flavor: "MYSYSTEM.Edge" },
      disadvantage: null,                                // not shown
      boost: { style: "extraDie", die: "1d4", op: "+", icon: "fa-bolt",
        label: "MYSYSTEM.Boost", tooltip: "MYSYSTEM.BoostHint", flavor: "MYSYSTEM.Boost" }
    }
  });
});
```

### Buttons (`DiceButton`)

| Property | |
|----------|---|
| `formula` | Required. What one click adds: a dice term — `d6`, `4dF`, `d6x`, `2d10r1`, or a system's own letter die such as `dp` — or a chat command starting with `/`, which runs when clicked. |
| `label` | Text shown when there is no image. |
| `img` | Image path. Standard dice default to the module's icons. If the image fails to load, the label is shown. |
| `tooltip` | Hover text. |
| `color` | Hex colour (`#3fa7ff`) the image is tinted with. |
| `drawer` | More buttons, shown when this one is held. One level deep. |

`label` and `tooltip` may be lang keys; text that isn't a key is shown as it is.

### Modes (`RollMode`)

Entries are merged over the generic `advantage` and `disadvantage`, so a map only needs to say what
differs. A `null` entry removes that mode.

| Property | |
|----------|---|
| `style` | `"repeat"`: roll each group twice and keep the better (`keep: "kh"`) or worse (`"kl"`) set. `"extraDie"`: add (`op: "+"`) or take away (`"-"`) `die` once. `"wildDie"`: roll each group alongside `die` and keep the higher. |
| `keep` | repeat: `"kh"` or `"kl"`. |
| `suffix` | repeat: the system's own die modifier (dnd5e's `adv`/`dis`), used when its dice understand it. |
| `die` | extraDie / wildDie: e.g. `"1d6"`, `"1dw"`. |
| `op` | extraDie: `"+"` or `"-"`. |
| `label`, `tooltip`, `flavor` | Lang keys: the button text, its tooltip, and the name shown on the chat card. |
| `icon` | Font Awesome class, e.g. `"fa-star"`. |
