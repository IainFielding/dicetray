import { queryOne } from "./dom.mjs";
import { parseRollCommand } from "./formula.mjs";
import { state } from "./state.mjs";

/**
 * The chat input, wherever Foundry has put it (sidebar, notifications, a popped-out or detached
 * chat), wrapped so its text can be read and written whether or not it is a ProseMirror editor.
 */
export function getChatInput() {
  const input = queryOne("#chat-message");
  const editor = input?.querySelector(".editor-content.ProseMirror");
  if ( !editor ) return input;
  return {
    get value() { return editor.innerText.replace(/\n$/, ""); },
    set value(v) { editor.innerText = v; },
    focus() { editor.focus(); }
  };
}

/**
 * The pool's roll command in the chat bar: the tray mirrors the pool there as /r, and the player
 * may edit it (another formula, /gmr, # flavor). Only while there is a pool — with none, a roll
 * command in the chat bar is one the player typed themselves. Every part of the tray that reads or
 * replaces the chat bar decides with this one rule.
 * @returns {{text: string, prefix: string, formula: string, flavor: string|null, messageMode: string|null}|null}
 */
export function poolCommand() {
  if ( !state.pool.length ) return null;
  const text = (getChatInput()?.value ?? "").trim();
  const command = parseRollCommand(text);
  return command ? { ...command, text } : null;
}
