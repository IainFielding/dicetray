import { facesOf } from "./dice.mjs";
import { getModes } from "./layout.mjs";
import { getDiceGroups, state } from "./state.mjs";
import { GENERIC_MODES } from "./systems.mjs";

/** Numbered dice smallest first, then any others (dF, …) in the order they were added. */
function groupOrder(a, b) {
  const fa = facesOf(a);
  const fb = facesOf(b);
  if ( Number.isNaN(fa) || Number.isNaN(fb) ) return Number.isNaN(fa) - Number.isNaN(fb);
  return (fa - fb) || a.localeCompare(b);
}

/**
 * Build the roll formula for a pool, e.g. "2d6 + 1d20kh + 3".
 * Pure: depends only on the arguments, so it can be unit-tested outside Foundry.
 *
 * The active mode (see {@link import("./systems.mjs").RollMode}) changes it:
 * - repeat (advantage/disadvantage): each group is rolled twice and the better or worse set kept.
 *   Systems whose dice understand `adv`/`dis` (dnd5e) get those modifiers on numbered dice, so their
 *   own chat cards and automation recognise the roll; everything else is written with core dice
 *   pools: `2d20kh` for a single die, `{3d6,3d6}kh` for several.
 * - extraDie: a die is added to or taken from the total once, e.g. `1d20 + 1d6`.
 * - wildDie: each group is rolled alongside the wild die, keeping the higher: `{1d8x,1dw}kh`.
 *
 * @param {{pool: string[], mode: string, modifier: number, keep: object}} state
 * @param {object} [options]
 * @param {boolean} [options.nativeAdvantage]  Whether the system's dice support `adv`/`dis`.
 * @param {Record<string, object>} [options.modes]  The system's modes; generic advantage by default.
 * @returns {string} "" when the pool is empty.
 */
export function buildFormula({ pool, mode, modifier, keep }, { nativeAdvantage = false, modes = GENERIC_MODES } = {}) {
  if ( !pool.length ) return "";
  const groups = getDiceGroups(pool);
  const active = modes[mode];
  let formula = Object.keys(groups).sort(groupOrder).map(key => {
    const count = groups[key];
    const mod = keep[key];
    const keepSuffix = (mod?.count > 0) ? ((mod.count === 1) ? mod.type : `${mod.type}${mod.count}`) : "";
    const term = `${count}${key}${keepSuffix}`;
    switch ( active?.style ) {
      case "wildDie": return `{${term},${active.die}}kh`;
      case "repeat":
        // The system's adv/dis belongs to its numbered dice; Fate dice and the like use the pool form.
        // So does a group with keep-highest/lowest: dnd5e picks the better set by its full total
        // before keeping, which isn't the "best of two kept sets" the tray (and its odds) promise.
        if ( nativeAdvantage && active.suffix && !keepSuffix && !Number.isNaN(facesOf(key)) ) {
          return `${term}${active.suffix}`;
        }
        if ( (count === 1) && !keepSuffix && (key === `d${facesOf(key)}`) ) return `2${key}${active.keep}`;
        return `{${term},${term}}${active.keep}`;
      default: return term;
    }
  }).join(" + ");
  if ( active?.style === "extraDie" ) formula += ` ${active.op} ${active.die}`;
  if ( modifier > 0 ) formula += ` + ${modifier}`;
  else if ( modifier < 0 ) formula += ` - ${Math.abs(modifier)}`;
  return formula;
}

/** Whether the active system's dice understand the `adv`/`dis` modifiers. */
export function systemSupportsAdvantage() {
  const modifiers = CONFIG.Dice?.terms?.d?.MODIFIERS ?? {};
  return ("adv" in modifiers) && ("dis" in modifiers);
}

/** The formula for the shared pool, written for the active system. */
export function currentFormula() {
  return buildFormula(state, { nativeAdvantage: systemSupportsAdvantage(), modes: getModes() });
}

/**
 * The formula for one die type, as it would roll if dragged out of the tray: that die's group
 * from the pool with its keep modifier and roll mode — or one click's worth if none of that type
 * has been added. The flat modifier and an extra-die mode belong to the whole roll, so they go with
 * the group only when it is the whole pool; otherwise they stay for the rest.
 * @param {string} key    The die type, e.g. "d6".
 * @param {number} [count]  How many make "one" of this die when none are in the pool.
 * @returns {{formula: string, fromPool: boolean}}
 */
export function formulaForDie(key, count = 1) {
  const dice = state.pool.filter(k => k === key);
  const fromPool = dice.length > 0;
  const modes = getModes();
  const wholePool = fromPool ? (dice.length === state.pool.length) : !state.pool.length;
  const partial = { ...state, pool: fromPool ? dice : Array(count).fill(key) };
  if ( !wholePool ) {
    partial.modifier = 0;
    if ( modes[state.mode]?.style === "extraDie" ) partial.mode = "normal";
  }
  return { formula: buildFormula(partial, { nativeAdvantage: systemSupportsAdvantage(), modes }), fromPool };
}

/**
 * Pull the formula out of a chat-bar roll command ("/r 2d6", "/roll 1d20 + 2").
 * @returns {string|null} null when the text isn't a roll command.
 */
export function parseRollCommand(text) {
  const match = text.trim().match(/^\/r(?:oll)?\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
