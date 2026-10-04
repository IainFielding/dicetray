import { MODE_CONFIG, MODULE_ID } from "./constants.mjs";
import { currentFormula, parseRollCommand } from "./formula.mjs";
import { clearPool, state } from "./state.mjs";
import { getChatInput } from "./chat-input.mjs";

/** Flavor text for the chat card, naming the roll mode or keep modifier in use. */
function rollFlavor() {
  let flavor = game.i18n.localize("SOGROM_DICETRAY.FlavorBase");
  const keeps = Object.values(state.keep);
  let detail;
  if ( MODE_CONFIG[state.mode] ) detail = MODE_CONFIG[state.mode].flavorKey;
  else if ( keeps.some(m => m.type === "kh") ) detail = "FlavorKeepHighest";
  else if ( keeps.some(m => m.type === "kl") ) detail = "FlavorKeepLowest";
  if ( detail ) flavor += ` (${game.i18n.localize(`SOGROM_DICETRAY.${detail}`)})`;
  return flavor;
}

/**
 * Evaluate a formula and post it to chat. The message uses the core chat message mode
 * (public, GM, blind, self) the user has selected, which Roll#toMessage applies by default.
 * @returns {Promise<boolean>} Whether the roll was posted.
 */
export async function rollFormula(formula, { flavor } = {}) {
  try {
    const roll = new Roll(formula);
    await roll.evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker(), flavor });
    return true;
  } catch ( err ) {
    console.error(`${MODULE_ID} | Roll error:`, err);
    ui.notifications.error(game.i18n.localize("SOGROM_DICETRAY.RollError"));
    return false;
  }
}

/** Roll the current pool, honouring any edits the user made to the /r command in the chat bar. */
export async function rollPool() {
  const chatText = getChatInput()?.value ?? "";
  const formula = parseRollCommand(chatText) ?? currentFormula();
  if ( !formula ) {
    ui.notifications.warn(game.i18n.localize("SOGROM_DICETRAY.EmptyPool"));
    return;
  }
  if ( await rollFormula(formula, { flavor: rollFlavor() }) ) clearPool();
}
