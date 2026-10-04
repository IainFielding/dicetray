import { MODE_CONFIG } from "./constants.mjs";
import { getDiceGroups } from "./state.mjs";

/**
 * Build the roll formula for a pool, e.g. "2d6 + 1d20kh + 3".
 * Pure: depends only on the state passed in, so it can be unit-tested outside Foundry.
 * @param {{pool: number[], mode: string, modifier: number, keep: object}} state
 * @returns {string} "" when the pool is empty.
 */
export function buildFormula({ pool, mode, modifier, keep }) {
  if ( !pool.length ) return "";
  const groups = getDiceGroups(pool);
  const modeSuffix = MODE_CONFIG[mode]?.suffix ?? "";
  const faces = Object.keys(groups).map(Number).sort((a, b) => a - b);
  let formula = faces.map(f => {
    let suffix = "";
    const mod = keep[f];
    if ( mod?.count > 0 ) suffix += (mod.count === 1) ? mod.type : `${mod.type}${mod.count}`;
    suffix += modeSuffix;
    return `${groups[f]}d${f}${suffix}`;
  }).join(" + ");
  if ( modifier > 0 ) formula += ` + ${modifier}`;
  else if ( modifier < 0 ) formula += ` - ${Math.abs(modifier)}`;
  return formula;
}

/**
 * Pull the formula out of a chat-bar roll command ("/r 2d6", "/roll 1d20 + 2").
 * @returns {string|null} null when the text isn't a roll command.
 */
export function parseRollCommand(text) {
  const match = text.trim().match(/^\/r(?:oll)?\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
