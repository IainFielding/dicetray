import { HOOKS, MODULE_ID } from "./constants.mjs";
import { getModes } from "./layout.mjs";
import { currentFormula } from "./formula.mjs";
import { consume, getDiceGroups, state } from "./state.mjs";
import { getChatInput, poolCommand } from "./chat-input.mjs";

/** `type` of the drag data a die dragged out of the tray carries. */
export const DRAG_TYPE = "SogromDiceTrayRoll";

/**
 * Flavor text for the chat card, naming the roll mode or keep modifier in use.
 * @param {object} [rolled]  The part of the pool being rolled; the whole pool by default.
 */
export function rollFlavor(rolled = state) {
  let flavor = game.i18n.localize("SOGROM_DICETRAY.FlavorBase");
  const keeps = Object.values(rolled.keep);
  let detail;
  const mode = getModes()[rolled.mode];
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
 * @-references (`@abilities.dex.mod`) are filled from the speaking character's roll data, as a
 * chat-bar /r command would.
 * @param {string} formula
 * @param {object} [options]
 * @param {string} [options.flavor]
 * @param {string|null} [options.messageMode]  "gm", "blind", "self" or "public"; the player's
 *   selected mode when omitted.
 * @param {"tray"|"rightClick"|"drop"|"api"} [options.source]  What asked for the roll.
 * @returns {Promise<ChatMessage|null>} The message, or null if cancelled or the roll failed.
 */
export async function rollFormula(formula, { flavor, messageMode = null, source = "tray" } = {}) {
  const data = { formula, flavor, messageMode, source };
  if ( Hooks.call(HOOKS.preRoll, data) === false ) return null;
  try {
    const speaker = ChatMessage.getSpeaker();
    const rollData = ChatMessage.getSpeakerActor(speaker)?.getRollData() ?? {};
    const roll = new Roll(data.formula, rollData);
    // As core does: a blind roll is hidden from its roller, so it can't ask them to roll it.
    const mode = data.messageMode ?? game.settings.get("core", "messageMode");
    await roll.evaluate({ allowInteractive: mode !== "blind" });
    const options = data.messageMode ? { messageMode: data.messageMode } : {};
    const message = await roll.toMessage({ speaker, flavor: data.flavor }, options);
    // Another module may stop the message being made; then nothing was posted.
    if ( !message ) return null;
    Hooks.callAll(HOOKS.roll, roll, message, data);
    return message;
  } catch ( err ) {
    console.error(`${MODULE_ID} | Roll error:`, err);
    ui.notifications.error(game.i18n.localize("SOGROM_DICETRAY.RollError"));
    return null;
  }
}

/** The pool roll in progress, so a double click or a held key doesn't post it twice. */
let rolling = null;

/**
 * Roll the current pool, honouring any edits the user made to the /r command in the chat bar.
 * While a roll is in progress, asking again returns that same roll.
 * @param {object} [options]
 * @param {string} [options.source]  What asked for the roll; see rollFormula.
 * @returns {Promise<ChatMessage|null>}
 */
export function rollPool(options = {}) {
  rolling ??= rollPoolNow(options).finally(() => { rolling = null; });
  return rolling;
}

async function rollPoolNow({ source = "tray" } = {}) {
  // The pool's command in the chat bar is the pool, perhaps edited: /gmr, # flavor and all.
  const command = poolCommand();
  const formula = command?.formula ?? currentFormula();
  if ( !formula ) {
    ui.notifications.warn(game.i18n.localize("SOGROM_DICETRAY.EmptyPool"));
    return null;
  }
  // What is being rolled, as it is now: dice added while the roll is in progress aren't part of it.
  const rolled = getDiceGroups();
  const message = await rollFormula(formula, {
    flavor: command?.flavor ?? rollFlavor(), messageMode: command?.messageMode ?? null, source
  });
  if ( message ) {
    // The command was rolled; clear it so it can't roll twice — unless the player has since typed
    // something else there.
    const chat = getChatInput();
    if ( command && chat && (chat.value.trim() === command.text) ) chat.value = "";
    consume(rolled, { withModifiers: true });
  }
  return message;
}

/**
 * A die dragged from the tray and dropped on the canvas rolls what it carries. If that was the
 * die's group from the pool, those dice are used up; the rest of the pool stays.
 * @returns {false|void} false to stop the canvas handling the drop itself.
 */
export function onDropCanvasData(_canvas, data) {
  if ( data?.type !== DRAG_TYPE ) return;
  rollFormula(data.formula, { flavor: data.flavor ?? rollFlavor(), source: "drop" }).then(message => {
    if ( !message ) return;
    // Use up exactly what was dragged out, plus the modifier and mode if they went with it.
    const groups = data.fromPool ? { [data.key]: data.rolled } : {};
    if ( data.fromPool || data.withModifiers ) consume(groups, { withModifiers: !!data.withModifiers });
  });
  return false;
}

/**
 * A die dropped on the hotbar becomes a macro that rolls the same formula.
 * @returns {false|void} false to stop the hotbar handling the drop itself.
 */
export function onHotbarDrop(_hotbar, data, slot) {
  if ( data?.type !== DRAG_TYPE ) return;
  createRollMacro(data.formula, slot).catch(err => {
    console.error(`${MODULE_ID} | Could not make a roll macro:`, err);
    ui.notifications.error(game.i18n.localize("SOGROM_DICETRAY.MacroError"));
  });
  return false;
}

async function createRollMacro(formula, slot) {
  const name = formula;
  const command = `/r ${formula}`;
  const macro = game.macros.find(m => (m.name === name) && (m.command === command) && m.isOwner)
    ?? await getDocumentClass("Macro").create({ name, type: "chat", command, img: "icons/svg/d20-grey.svg" });
  if ( macro ) await game.user.assignHotbarMacro(macro, slot);
}
