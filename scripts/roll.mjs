import { MODULE_ID } from "./constants.mjs";
import { getModes } from "./layout.mjs";
import { currentFormula, parseRollCommand } from "./formula.mjs";
import { clearPool, removeAllOf, state } from "./state.mjs";
import { getChatInput } from "./chat-input.mjs";

/** `type` of the drag data a die dragged out of the tray carries. */
export const DRAG_TYPE = "SogromDiceTrayRoll";

/** Flavor text for the chat card, naming the roll mode or keep modifier in use. */
function rollFlavor() {
  let flavor = game.i18n.localize("SOGROM_DICETRAY.FlavorBase");
  const keeps = Object.values(state.keep);
  let detail;
  const mode = getModes()[state.mode];
  if ( mode ) detail = mode.flavor;
  else if ( keeps.some(m => m.type === "kh") ) detail = "SOGROM_DICETRAY.FlavorKeepHighest";
  else if ( keeps.some(m => m.type === "kl") ) detail = "SOGROM_DICETRAY.FlavorKeepLowest";
  if ( detail ) flavor += ` (${game.i18n.localize(detail)})`;
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

/**
 * A die dragged from the tray and dropped on the canvas rolls what it carries. If that was the
 * die's group from the pool, those dice are used up; the rest of the pool stays.
 * @returns {false|void} false to stop the canvas handling the drop itself.
 */
export function onDropCanvasData(_canvas, data) {
  if ( data?.type !== DRAG_TYPE ) return;
  rollFormula(data.formula, { flavor: rollFlavor() }).then(rolled => {
    if ( rolled && data.fromPool ) removeAllOf(data.key);
  });
  return false;
}

/**
 * A die dropped on the hotbar becomes a macro that rolls the same formula.
 * @returns {false|void} false to stop the hotbar handling the drop itself.
 */
export function onHotbarDrop(_hotbar, data, slot) {
  if ( data?.type !== DRAG_TYPE ) return;
  createRollMacro(data.formula, slot);
  return false;
}

async function createRollMacro(formula, slot) {
  const name = formula;
  const command = `/r ${formula}`;
  const macro = game.macros.find(m => (m.name === name) && (m.command === command) && m.isOwner)
    ?? await getDocumentClass("Macro").create({ name, type: "chat", command, img: "icons/svg/d20-grey.svg" });
  if ( macro ) await game.user.assignHotbarMacro(macro, slot);
}
