import { queryOne } from "./dom.mjs";

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
