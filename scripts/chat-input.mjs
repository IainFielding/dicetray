/** The chat input, wrapped so its text can be read and written whether or not it is a ProseMirror editor. */
export function getChatInput() {
  const input = document.getElementById("chat-message");
  const editor = input?.querySelector(".editor-content.ProseMirror");
  if ( !editor ) return input;
  return {
    get value() { return editor.innerText.replace(/\n$/, ""); },
    set value(v) { editor.innerText = v; },
    focus() { editor.focus(); }
  };
}
