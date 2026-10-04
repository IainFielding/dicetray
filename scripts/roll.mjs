import { HOOKS, MODULE_ID } from "./constants.mjs";
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
 *
 * Every roll the tray makes comes through here, so other modules see them all: the preRoll hook
 * can change the formula or flavor, or cancel the roll, and the roll hook follows the message.
 * @param {string} formula
 * @param {object} [options]
 * @param {string} [options.flavor]
 * @param {"tray"|"rightClick"|"drop"|"api"} [options.source]  What asked for the roll.
 * @returns {Promise<ChatMessage|null>} The message, or null if cancelled or the roll failed.
 */
export async function rollFormula(formula, { flavor, source = "tray" } = {}) {
  const data = { formula, flavor, source };
  if ( Hooks.call(HOOKS.preRoll, data) === false ) return null;
  try {
    const roll = new Roll(data.formula);
    await roll.evaluate();
    const message = await roll.toMessage({ speaker: ChatMessage.getSpeaker(), flavor: data.flavor });
    Hooks.callAll(HOOKS.roll, roll, message, data);
    return message ?? null;
  } catch ( err ) {
    console.error(`${MODULE_ID} | Roll error:`, err);
    ui.notifications.error(game.i18n.localize("SOGROM_DICETRAY.RollError"));
    return null;
  }
}

/**
 * Roll the current pool, honouring any edits the user made to the /r command in the chat bar.
 * @param {object} [options]
 * @param {string} [options.source]  What asked for the roll; see rollFormula.
 * @returns {Promise<ChatMessage|null>}
 */
export async function rollPool({ source = "tray" } = {}) {
  const chatText = getChatInput()?.value ?? "";
  const formula = parseRollCommand(chatText) ?? currentFormula();
  if ( !formula ) {
    ui.notifications.warn(game.i18n.localize("SOGROM_DICETRAY.EmptyPool"));
    return null;
  }
  const message = await rollFormula(formula, { flavor: rollFlavor(), source });
  if ( message ) clearPool();
  return message;
}

/**
 * A die dragged from the tray and dropped on the canvas rolls what it carries. If that was the
 * die's group from the pool, those dice are used up; the rest of the pool stays.
 * @returns {false|void} false to stop the canvas handling the drop itself.
 */
export function onDropCanvasData(_canvas, data) {
  if ( data?.type !== DRAG_TYPE ) return;
  rollFormula(data.formula, { flavor: rollFlavor(), source: "drop" }).then(rolled => {
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
