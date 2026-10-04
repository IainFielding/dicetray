import { registerSettings } from "./settings.mjs";
import { clearPool } from "./state.mjs";
import { onDropCanvasData, onHotbarDrop } from "./roll.mjs";
import { injectDiceTray, injectToggleButton, removeAll } from "./tray.mjs";

Hooks.once("init", registerSettings);

Hooks.on("renderChatLog", (_app, element) => {
  injectDiceTray(element);
  injectToggleButton(element);
});

Hooks.on("collapseSidebar", () => {
  // The sidebar moves the chat input between layouts; start again in the new one.
  removeAll();
  const element = ui.chat?.element;
  if ( !element ) return;
  injectDiceTray(element);
  injectToggleButton(element);
});

Hooks.on("changeSidebarTab", () => {
  const element = ui.chat?.element;
  if ( element ) injectDiceTray(element);
});

// A message sent from the chat bar uses up the pool.
Hooks.on("chatMessage", () => clearPool());

// Dice dragged out of the tray: roll them on the canvas, or keep them as a hotbar macro.
Hooks.on("dropCanvasData", onDropCanvasData);
Hooks.on("hotbarDrop", onHotbarDrop);
