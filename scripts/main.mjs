import { createApi } from "./api.mjs";
import { HOOKS, MODULE_ID } from "./constants.mjs";
import { registerKeybindings } from "./keybindings.mjs";
import { DiceTrayWindow, onGetSceneControlButtons } from "./popout.mjs";
import { registerSettings } from "./settings.mjs";
import { onStateChange, snapshot } from "./state.mjs";
import { onDropCanvasData, onHotbarDrop } from "./roll.mjs";
import { onCreateChatMessage, onPreCreateChatMessage, saveOnHide } from "./stats-tracker.mjs";
import {
  ensureTray, followChatInput, injectToggleButton, onChatMessageSent, onPoolMessageCreated
} from "./tray.mjs";

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
  ensureTray(element);
  injectToggleButton(element);
});

// Foundry moves the chat input between the sidebar, the notifications area and a popped-out chat
// (collapsing the sidebar, changing tabs, popping chat out); the tray follows it.
Hooks.on("renderChatInput", (_app, elements) => followChatInput(elements["#chat-message"]));

Hooks.once("ready", () => {
  if ( game.settings.get(MODULE_ID, "popoutAutoOpen") ) DiceTrayWindow.toggle(true);
  saveOnHide();
  Hooks.callAll(HOOKS.ready, game.modules.get(MODULE_ID).api);
});

// Roll statistics: tagged by the client that makes each message (pre-create hooks run only
// there), and counted when the message really exists.
Hooks.on("preCreateChatMessage", onPreCreateChatMessage);
Hooks.on("createChatMessage", (message, options, userId) => {
  onCreateChatMessage(message);
  onPoolMessageCreated(message, options, userId);
});

Hooks.on("getSceneControlButtons", onGetSceneControlButtons);

// A roll command sent from the chat bar is the pool being rolled; it's used up once the roll lands.
Hooks.on("chatMessage", (_log, message, chatData) => onChatMessageSent(message, chatData));

// Dice dragged out of the tray: roll them on the canvas, or keep them as a hotbar macro.
Hooks.on("dropCanvasData", onDropCanvasData);
Hooks.on("hotbarDrop", onHotbarDrop);
