import { MODULE_ID } from "./constants.mjs";
import { queryOne } from "./dom.mjs";
import { consume, getDiceGroups, state } from "./state.mjs";

/**
 * The chat input, wherever Foundry has put it (sidebar, notifications, a popped-out or detached
 * chat), wrapped so its text can be read and written whether or not it is a ProseMirror editor.
 */
export function getChatInput() {
  const input = queryOne("#chat-message");
  const editor = input?.querySelector(".editor-content.ProseMirror");
  if ( !editor ) return input;
  return {
    element: input,
    get value() { return editor.innerText.replace(/\n$/, ""); },
    set value(v) { editor.innerText = v; },
    focus() { editor.focus(); }
  };
}

/** What the chat bar holds, as the player sees it. */
export const readBar = () => (getChatInput()?.value ?? "").trim();

/* -------------------------------------------- */
/*  Roll commands                               */
/* -------------------------------------------- */

/** The chat log's class — a system may extend it — whose parse() and CHAT_COMMANDS read commands. */
const chatLogClass = () => ui.chat?.constructor ?? foundry.applications.sidebar.tabs.ChatLog;

/**
 * Read a dice command (/r, /gmr, /br, /sr, /pr and their long forms, with "# flavor") exactly as
 * Foundry's chat log reads it, HTML from the chat bar included. One line only: several lines are
 * several commands, sent as they are.
 * @returns {{prefix: string, formula: string, flavor: string|null, messageMode: string|null}|null}
 *   messageMode is null for plain /r, which uses the mode the player has selected.
 */
export function parseRollCommand(text) {
  const cls = chatLogClass();
  const [rule, matches] = cls.parse(String(text ?? "").trim());
  const command = cls.CHAT_COMMANDS?.[rule];
  if ( !command?.isRoll || !matches ) return null;
  // Multi-line commands come back as one match per line.
  const lines = Array.isArray(matches[0]) ? matches : [matches];
  if ( (lines.length !== 1) || !lines[0] ) return null;
  const [, prefix, formula, flavor] = lines[0];
  if ( !formula?.trim() ) return null;
  return { prefix: prefix.trim(), formula: formula.trim(), flavor: flavor?.trim() || null, messageMode: command.mode ?? null };
}

/* -------------------------------------------- */
/*  The pool in the chat bar                    */
/* -------------------------------------------- */

/** The text the tray last put in the chat bar; "" when it has none there. */
let mirrored = "";

export const mirroredText = () => mirrored;

export function setMirrored(value) {
  mirrored = value;
}

/**
 * The pool's roll command in the chat bar: the tray mirrors the pool there as /r, and the player
 * may edit it (another formula, /gmr, # flavor). Only while there is a pool and the tray has put it
 * there — a roll command the player typed with no dice in the pool is theirs, and stays theirs.
 * Every part of the tray that reads or replaces the chat bar decides with this one rule.
 * @param {string} [text]  The chat bar's text, if already read.
 * @returns {{text: string, prefix: string, formula: string, flavor: string|null, messageMode: string|null}|null}
 */
export function poolCommand(text = readBar()) {
  if ( !state.pool.length || !mirrored ) return null;
  const command = parseRollCommand(text);
  return command ? { ...command, text } : null;
}

/** Whether the pool's command has been edited from what the tray wrote. */
export const commandEdited = command => !!command && (command.text !== mirrored);

/* -------------------------------------------- */
/*  Sending the pool from the chat bar          */
/* -------------------------------------------- */

/** The chat bar's text when Enter was last pressed in it, and when. */
let enterPressed = null;

/** A send has this long to reach the chatMessage hook (some systems evaluate the roll first). */
const SEND_WINDOW_MS = 5000;

/**
 * Pool sends waiting for their message, by token: the dice they roll, and when. The token rides on
 * the chat data into preCreateChatMessage, which moves it to the operation's options (nothing is
 * saved on the message); createChatMessage on this client finds it there. Kept small.
 */
const sends = new Map();
const MAX_SENDS = 20;
const POOL_TOKEN = "poolSend";
const POOL_OPTION = `${MODULE_ID}.${POOL_TOKEN}`;

/** A send still waiting this long has failed or been cancelled. */
const SEND_TIMEOUT_MS = 30000;

/** chatInput hook: Enter in the chat bar itself — the only way the pool is sent from there. */
export function onChatInput(event) {
  if ( (event.key === "Enter") && !event.shiftKey && !event.isComposing ) {
    enterPressed = { text: readBar(), at: Date.now() };
  }
}

/**
 * chatMessage hook: the pool's command, sent by Enter in the chat bar, is the pool being rolled.
 * The message about to be made from `chatData` is tagged, and the pool is used up only when that
 * very message exists ({@link onPoolMessageCreated}): a typo or a cancelled roll loses nothing,
 * and no other roll — a chat macro, a command button, a sheet — can be mistaken for it.
 */
export function onChatMessageSent(message, chatData) {
  const enter = enterPressed;
  enterPressed = null;
  if ( !enter || !chatData || ((Date.now() - enter.at) > SEND_WINDOW_MS) ) return;
  const command = poolCommand(enter.text);
  const sent = parseRollCommand(message);
  if ( !command || !sent || (sent.prefix !== command.prefix) || (sent.formula !== command.formula) ) return;
  const token = foundry.utils.randomID();
  sends.set(token, { rolled: getDiceGroups(), at: Date.now() });
  if ( sends.size > MAX_SENDS ) sends.delete(sends.keys().next().value);
  foundry.utils.setProperty(chatData, `flags.${MODULE_ID}.${POOL_TOKEN}`, token);
}

/** Whether the pool has been sent from the chat bar and its message hasn't arrived yet. */
export function poolSendInFlight() {
  const now = Date.now();
  for ( const [token, { at }] of sends ) {
    if ( (now - at) > SEND_TIMEOUT_MS ) sends.delete(token);
    else return true;
  }
  return false;
}

/** preCreateChatMessage: move a pool send's token off the message and into the operation's options. */
export function onPoolPreCreate(message, options) {
  const token = message.getFlag(MODULE_ID, POOL_TOKEN);
  if ( !token ) return;
  options[POOL_OPTION] = token;
  // Leave nothing behind: drop the module's flags altogether if the token was all there was.
  const only = Object.keys(message.flags?.[MODULE_ID] ?? {}).length === 1;
  const path = only ? `flags.${MODULE_ID}` : `flags.${MODULE_ID}.${POOL_TOKEN}`;
  message.updateSource({ [path]: foundry.data.operators.ForcedDeletion.create() });
}

/** createChatMessage hook: the pool's own roll message has landed, so what it rolled is used up. */
export function onPoolMessageCreated(_message, options) {
  const token = options?.[POOL_OPTION];
  const send = token && sends.get(token);
  if ( !send ) return;
  sends.delete(token);
  consume(send.rolled, { withModifiers: true });
}
