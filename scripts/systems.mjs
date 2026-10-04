/**
 * Game system support: the dice a system's tray starts with, and what its mode buttons (advantage
 * and the like) are called and do.
 *
 * Pure apart from reading `game.system.id` in {@link activeSystemId}, so the maps and the mode logic
 * can be unit-tested.
 *
 * @typedef {object} RollMode
 * @property {"repeat"|"extraDie"|"wildDie"} style  How the mode changes the formula:
 *   - repeat:   each group is rolled twice and the better (`keep: "kh"`) or worse (`"kl"`) set kept;
 *               uses the system's own `suffix` modifier (dnd5e's adv/dis) on numbered dice when its
 *               dice support it
 *   - extraDie: `die` is added to (`op: "+"`) or taken from (`"-"`) the total, once
 *   - wildDie:  each group is rolled alongside `die` and the higher kept
 * @property {string} label    Lang key for the button text ("ADV").
 * @property {string} tooltip  Lang key for its tooltip.
 * @property {string} flavor   Lang key naming the mode on the chat card.
 * @property {string} icon     Font Awesome icon class.
 * @property {string} [keep]   repeat: "kh" or "kl".
 * @property {string} [suffix] repeat: the system's own modifier, if it has one.
 * @property {string} [die]    extraDie/wildDie: the die, e.g. "1d6" or "1dw".
 * @property {string} [op]     extraDie: "+" or "-".
 *
 * @typedef {object} SystemMap
 * @property {() => import("./dice.mjs").DiceButton[][]} [rows]  The default layout.
 * @property {Record<string, Partial<RollMode>>|null} [modes]  The mode buttons. Entries are merged
 *   over the generic advantage/disadvantage; `{}` or null hides the mode buttons.
 */

import { diceButtons, STANDARD_DICE } from "./dice.mjs";

/** Advantage and disadvantage as most d20 games play them. */
export const GENERIC_MODES = {
  advantage: {
    style: "repeat", keep: "kh", suffix: "adv", icon: "fa-angle-double-up",
    label: "SOGROM_DICETRAY.Advantage", tooltip: "SOGROM_DICETRAY.TooltipAdvantage", flavor: "SOGROM_DICETRAY.FlavorAdvantage"
  },
  disadvantage: {
    style: "repeat", keep: "kl", suffix: "dis", icon: "fa-angle-double-down",
    label: "SOGROM_DICETRAY.Disadvantage", tooltip: "SOGROM_DICETRAY.TooltipDisadvantage",
    flavor: "SOGROM_DICETRAY.FlavorDisadvantage"
  }
};

const standardRows = () => [diceButtons(STANDARD_DICE)];
const icon = (system, path) => `systems/${system}/${path}`;

/** Built-in maps, by system id. Other systems get the standard dice and generic modes. */
export const SYSTEM_MAPS = {
  dnd5e: {},

  pf2e: {
    // Flat checks are a d20 against DC 5 or 11 (persistent damage, concealment, …): one click each.
    rows: () => [[
      ...diceButtons([4, 6, 8, 10, 12]),
      { formula: "d20", drawer: [
        { formula: "/r 1d20cs>=5 # DC 5 Flat Check", label: "DC 5", tooltip: "SOGROM_DICETRAY.Pf2eFlatCheck5" },
        { formula: "/r 1d20cs>=11 # DC 11 Flat Check", label: "DC 11", tooltip: "SOGROM_DICETRAY.Pf2eFlatCheck11" }
      ] },
      { formula: "d100" }
    ]],
    modes: {
      advantage: { label: "SOGROM_DICETRAY.Pf2eFortune", tooltip: "SOGROM_DICETRAY.Pf2eFortuneTooltip",
        flavor: "SOGROM_DICETRAY.Pf2eFortuneFlavor" },
      disadvantage: { label: "SOGROM_DICETRAY.Pf2eMisfortune", tooltip: "SOGROM_DICETRAY.Pf2eMisfortuneTooltip",
        flavor: "SOGROM_DICETRAY.Pf2eMisfortuneFlavor" }
    }
  },

  daggerheart: {
    // The system's own Duality and Fate roll commands, with its dice art.
    rows: () => [[
      ...diceButtons([4, 6, 8, 10, 12, 20]),
      { formula: "/dr", label: "Duality", tooltip: "SOGROM_DICETRAY.DaggerheartDuality",
        img: icon("daggerheart", "assets/icons/dice/duality/DualityBW.svg"), drawer: [
          { formula: "/fr type=hope", label: "Hope", tooltip: "SOGROM_DICETRAY.DaggerheartFateHope",
            img: icon("daggerheart", "assets/icons/dice/hope/d12.svg") },
          { formula: "/fr type=fear", label: "Fear", tooltip: "SOGROM_DICETRAY.DaggerheartFateFear",
            img: icon("daggerheart", "assets/icons/dice/fear/d12.svg") }
        ] }
    ]],
    // Advantage adds a d6 to the roll and disadvantage takes one away.
    modes: {
      advantage: { style: "extraDie", die: "1d6", op: "+", tooltip: "SOGROM_DICETRAY.DaggerheartAdvantageTooltip" },
      disadvantage: { style: "extraDie", die: "1d6", op: "-", tooltip: "SOGROM_DICETRAY.DaggerheartDisadvantageTooltip" }
    }
  },

  swade: {
    // Trait and damage dice ace (explode); a Wild Card rolls the wild die alongside and keeps the higher.
    rows: () => [[4, 6, 8, 10, 12].map(f => ({ formula: `d${f}x`, img: `modules/sogrom-dicetray/assets/icons/d${f}-grey.svg`,
      tooltip: "SOGROM_DICETRAY.SwadeAcingDie" }))],
    modes: {
      wild: {
        style: "wildDie", die: "1dw", icon: "fa-star", label: "SOGROM_DICETRAY.SwadeWild",
        tooltip: "SOGROM_DICETRAY.SwadeWildTooltip", flavor: "SOGROM_DICETRAY.SwadeWildFlavor"
      }
    }
  },

  dcc: {
    // The full dice chain.
    rows: () => [diceButtons([3, 4, 5, 6, 7, 8, 10]), diceButtons([12, 14, 16, 20, 24, 30, 100])],
    modes: null
  },

  fate: {
    rows: () => [[{ formula: "4dF", label: "4dF", tooltip: "SOGROM_DICETRAY.FateRoll" }, { formula: "dF", label: "dF" },
      ...diceButtons([6])]],
    modes: null
  },

  starwarsffg: {
    // The narrative dice, with the system's own art.
    rows: () => {
      const die = (letter, image, tooltip, label) => ({
        formula: `d${letter}`, label, tooltip, img: icon("starwarsffg", `images/dice/starwars/${image}.png`)
      });
      return [[
        die("p", "yellow", "SOGROM_DICETRAY.FfgProficiency", "Pro"),
        die("a", "green", "SOGROM_DICETRAY.FfgAbility", "Abi"),
        die("b", "blue", "SOGROM_DICETRAY.FfgBoost", "Boo"),
        die("c", "red", "SOGROM_DICETRAY.FfgChallenge", "Cha"),
        die("i", "purple", "SOGROM_DICETRAY.FfgDifficulty", "Dif"),
        die("s", "black", "SOGROM_DICETRAY.FfgSetback", "Set"),
        die("f", "whiteHex", "SOGROM_DICETRAY.FfgForce", "For")
      ], diceButtons([10, 100])];
    },
    modes: null
  },

  alienrpg: {
    rows: () => [[
      { formula: "db", label: "Base", tooltip: "SOGROM_DICETRAY.AlienBase", img: icon("alienrpg", "ui/DsN/alien-dice-b6.png") },
      { formula: "ds", label: "Stress", tooltip: "SOGROM_DICETRAY.AlienStress", img: icon("alienrpg", "ui/DsN/alien-dice-y6.png") },
      ...diceButtons([6])
    ]],
    modes: null
  },

  "cosmere-rpg": {
    rows: () => [[...diceButtons([4, 6, 8, 10, 12, 20]), { formula: "dp", label: "Plot", tooltip: "SOGROM_DICETRAY.CosmerePlot" }]]
  },

  demonlord: {
    // Boons add the highest of their d6s, banes take it away; the tray adds one at a time.
    rows: () => [diceButtons([3, 6, 20])],
    modes: {
      advantage: { style: "extraDie", die: "1d6", op: "+", label: "SOGROM_DICETRAY.DemonlordBoon",
        tooltip: "SOGROM_DICETRAY.DemonlordBoonTooltip", flavor: "SOGROM_DICETRAY.DemonlordBoonFlavor" },
      disadvantage: { style: "extraDie", die: "1d6", op: "-", label: "SOGROM_DICETRAY.DemonlordBane",
        tooltip: "SOGROM_DICETRAY.DemonlordBaneTooltip", flavor: "SOGROM_DICETRAY.DemonlordBaneFlavor" }
    }
  }
};

/** Systems that share another's map. */
export const SYSTEM_ALIASES = {
  sf2e: "pf2e",
  "fate-core-official": "fate",
  ModularFate: "fate",
  genesys: "starwarsffg"
};

/** Maps added at runtime, e.g. by other modules through the API. They win over the built-in ones. */
const registered = new Map();

/** Add or replace the map for a system. */
export function registerSystemMap(id, map) {
  registered.set(id, map ?? {});
}

/** The map for a system id, following aliases; an empty map (standard dice) if there is none. */
export function systemMap(id) {
  if ( registered.has(id) ) return registered.get(id);
  const target = SYSTEM_ALIASES[id] ?? id;
  return registered.get(target) ?? SYSTEM_MAPS[target] ?? {};
}

/** The active world's system id. */
export const activeSystemId = () => game.system?.id;

/** The default layout for a system. */
export function systemRows(id) {
  return systemMap(id).rows?.() ?? standardRows();
}

/**
 * The mode buttons for a system: the generic ones with its overrides merged in, any extra modes it
 * adds, or none at all.
 * @returns {Record<string, RollMode>}
 */
export function systemModes(id) {
  const map = systemMap(id);
  if ( !("modes" in map) ) return GENERIC_MODES;
  if ( !map.modes ) return {};
  const modes = {};
  for ( const [key, override] of Object.entries(map.modes) ) {
    modes[key] = { ...(GENERIC_MODES[key] ?? {}), ...override };
  }
  return modes;
}
