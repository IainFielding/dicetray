import { createApi } from "./api.mjs";
import { HOOKS, MODULE_ID } from "./constants.mjs";
import { registerKeybindings } from "./keybindings.mjs";
import { DiceTrayWindow, onGetSceneControlButtons } from "./popout.mjs";
import { registerSettings } from "./settings.mjs";
import { clearPool, onStateChange, snapshot } from "./state.mjs";
import { onDropCanvasData, onHotbarDrop } from "./roll.mjs";
import { injectDiceTray, injectToggleButton, rebuildTrays } from "./tray.mjs";

Hooks.once("init", () => {
  registerSettings();
  registerKeybindings();
  foundry.applications.handlebars.loadTemplates({
    "sogrom-dicetray.layout-face": `modules/${MODULE_ID}/templates/layout-face.hbs`
  });
  const api = createApi();
  game.modules.get(MODULE_ID).api = api;
  Hooks.callAll(HOOKS.init, api);
});

onStateChange(() => Hooks.callAll(HOOKS.poolChanged, snapshot()));

Hooks.on("renderChatLog", (_app, element) => {
  injectDiceTray(element);
  injectToggleButton(element);
});

// The sidebar moves the chat input between layouts; start again in the new one.
Hooks.on("collapseSidebar", () => rebuildTrays());

Hooks.on("changeSidebarTab", () => {
  const element = ui.chat?.element;
  if ( element ) injectDiceTray(element);
});

Hooks.once("ready", () => {
  if ( game.settings.get(MODULE_ID, "popoutAutoOpen") ) DiceTrayWindow.toggle(true);
  Hooks.callAll(HOOKS.ready, game.modules.get(MODULE_ID).api);
});

Hooks.on("getSceneControlButtons", onGetSceneControlButtons);

// A message sent from the chat bar uses up the pool.
Hooks.on("chatMessage", () => clearPool());

// Dice dragged out of the tray: roll them on the canvas, or keep them as a hotbar macro.
Hooks.on("dropCanvasData", onDropCanvasData);
Hooks.on("hotbarDrop", onHotbarDrop);
