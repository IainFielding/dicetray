import { MODE_CONFIG } from "./constants.mjs";
import { facesOf } from "./dice.mjs";
import { getDiceGroups, state } from "./state.mjs";

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
 * Advantage and disadvantage roll each group twice and keep the better (or worse) set. Systems
 * whose dice understand `adv`/`dis` (dnd5e) get those modifiers, so their own chat cards and
 * automation recognise the roll; everywhere else the same thing is written with core dice pools:
 * `2d20kh` for a single die, `{3d6,3d6}kh` for several.
 *
 * @param {{pool: string[], mode: string, modifier: number, keep: object}} state
 * @param {object} [options]
 * @param {boolean} [options.nativeAdvantage]  Whether the system's dice support `adv`/`dis`.
 * @returns {string} "" when the pool is empty.
 */
export function buildFormula({ pool, mode, modifier, keep }, { nativeAdvantage = false } = {}) {
  if ( !pool.length ) return "";
  const groups = getDiceGroups(pool);
  const advantage = MODE_CONFIG[mode];
  let formula = Object.keys(groups).sort(groupOrder).map(key => {
    const count = groups[key];
    const mod = keep[key];
    const keepSuffix = (mod?.count > 0) ? ((mod.count === 1) ? mod.type : `${mod.type}${mod.count}`) : "";
    const term = `${count}${key}${keepSuffix}`;
    if ( !advantage ) return term;
    // The system's adv/dis belongs to its numbered dice; Fate dice and the like use the pool form.
    if ( nativeAdvantage && !Number.isNaN(facesOf(key)) ) return `${term}${advantage.suffix}`;
    if ( (count === 1) && !keepSuffix && (key === `d${facesOf(key)}`) ) return `2${key}${advantage.keep}`;
    return `{${term},${term}}${advantage.keep}`;
  }).join(" + ");
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
  return buildFormula(state, { nativeAdvantage: systemSupportsAdvantage() });
}

/**
 * The formula for one die type, as it would roll if dragged out of the tray: that die's group
 * from the pool with its keep modifier, the roll mode and the modifier — or a single die if none
 * of that type has been added.
 * @param {string} key    The die type, e.g. "d6".
 * @param {number} [count]  How many make "one" of this die when none are in the pool.
 * @returns {{formula: string, fromPool: boolean}}
 */
export function formulaForDie(key, count = 1) {
  const dice = state.pool.filter(k => k === key);
  const fromPool = dice.length > 0;
  const formula = buildFormula({ ...state, pool: fromPool ? dice : Array(count).fill(key) },
    { nativeAdvantage: systemSupportsAdvantage() });
  return { formula, fromPool };
}

/**
 * Pull the formula out of a chat-bar roll command ("/r 2d6", "/roll 1d20 + 2").
 * @returns {string|null} null when the text isn't a roll command.
 */
export function parseRollCommand(text) {
  const match = text.trim().match(/^\/r(?:oll)?\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
