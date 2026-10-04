import { MODE_CONFIG } from "./constants.mjs";
import { getDiceGroups, state } from "./state.mjs";

/**
 * Build the roll formula for a pool, e.g. "2d6 + 1d20kh + 3".
 * Pure: depends only on the arguments, so it can be unit-tested outside Foundry.
 *
 * Advantage and disadvantage roll each group twice and keep the better (or worse) set. Systems
 * whose dice understand `adv`/`dis` (dnd5e) get those modifiers, so their own chat cards and
 * automation recognise the roll; everywhere else the same thing is written with core dice pools:
 * `2d20kh` for a single die, `{3d6,3d6}kh` for several.
 *
 * @param {{pool: number[], mode: string, modifier: number, keep: object}} state
 * @param {object} [options]
 * @param {boolean} [options.nativeAdvantage]  Whether the system's dice support `adv`/`dis`.
 * @returns {string} "" when the pool is empty.
 */
export function buildFormula({ pool, mode, modifier, keep }, { nativeAdvantage = false } = {}) {
  if ( !pool.length ) return "";
  const groups = getDiceGroups(pool);
  const advantage = MODE_CONFIG[mode];
  const faces = Object.keys(groups).map(Number).sort((a, b) => a - b);
  let formula = faces.map(f => {
    const count = groups[f];
    const mod = keep[f];
    const keepSuffix = (mod?.count > 0) ? ((mod.count === 1) ? mod.type : `${mod.type}${mod.count}`) : "";
    if ( !advantage ) return `${count}d${f}${keepSuffix}`;
    if ( nativeAdvantage ) return `${count}d${f}${keepSuffix}${advantage.suffix}`;
    if ( (count === 1) && !keepSuffix ) return `2d${f}${advantage.keep}`;
    const term = `${count}d${f}${keepSuffix}`;
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
 * @returns {{formula: string, fromPool: boolean}}
 */
export function formulaForDie(faces) {
  const dice = state.pool.filter(f => f === faces);
  const fromPool = dice.length > 0;
  const formula = buildFormula({ ...state, pool: fromPool ? dice : [faces] },
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
