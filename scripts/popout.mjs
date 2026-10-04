import { MODULE_ID } from "./constants.mjs";
import { createDiceTray } from "./tray.mjs";

const { ApplicationV2 } = foundry.applications.api;

/** Name of the scene control tool that opens the window. */
const TOOL = "sogromDiceTray";

/** Save the window position at most this often while it is being dragged. */
const SAVE_POSITION_DELAY_MS = 500;

/**
 * The dice tray in its own window, for players who keep the sidebar collapsed or on another tab.
 * It renders the same tray as the sidebar and shares its pool.
 */
export class DiceTrayWindow extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "sogrom-dice-tray-window",
    classes: ["sogrom-dice-tray-window"],
    tag: "aside",
    window: {
      title: "SOGROM_DICETRAY.Title",
      icon: "fas fa-dice-d20",
      minimizable: true,
      resizable: false
    },
    position: { width: 300, height: "auto" }
  };

  /** The single window instance, created on first use. */
  static #instance;

  static get instance() {
    return (this.#instance ??= new this());
  }

  /** Open the window if closed, close it if open. */
  static async toggle(open = !this.#instance?.rendered) {
    if ( open ) await this.instance.render({ force: true });
    else await this.#instance?.close();
  }

  /** Re-render the window if it's open, e.g. after the dice layout changed. */
  static refresh() {
    if ( this.#instance?.rendered ) this.#instance.render();
  }

  static get isOpen() {
    return !!this.#instance?.rendered;
  }

  #savePosition = foundry.utils.debounce(({ left, top }) => {
    game.settings.set(MODULE_ID, "popoutPosition", { left, top });
  }, SAVE_POSITION_DELAY_MS);

  /** @override */
  async _renderHTML() {
    return createDiceTray({ popout: true });
  }

  /** @override */
  _replaceHTML(tray, content) {
    content.replaceChildren(tray);
  }

  /** @override */
  _initializeApplicationOptions(options) {
    options = super._initializeApplicationOptions(options);
    // Reopen where the player last left it; the first time, beside the scene controls.
    const saved = game.settings.get(MODULE_ID, "popoutPosition") ?? {};
    options.position.left = saved.left ?? 120;
    options.position.top = saved.top ?? 80;
    return options;
  }

  /** @override */
  setPosition(position) {
    const result = super.setPosition(position);
    if ( this.rendered && !this.minimized ) this.#savePosition(result);
    return result;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    syncTool(true);
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    syncTool(false);
  }
}

/** Light up (or dim) the scene control button to match whether the window is open. */
function syncTool(active) {
  const controls = ui.controls?.controls;
  if ( !controls ) return;
  let changed = false;
  for ( const control of Object.values(controls) ) {
    const tool = control.tools?.[TOOL];
    if ( tool && (tool.active !== active) ) {
      tool.active = active;
      changed = true;
    }
  }
  if ( changed ) ui.controls.render();
}

/** Add the window's toggle to the scene controls the player chose in the settings. */
export function onGetSceneControlButtons(controls) {
  const where = game.settings.get(MODULE_ID, "popoutButton");
  if ( where === "none" ) return;
  const groups = (where === "all") ? Object.values(controls) : [controls.tokens].filter(Boolean);
  for ( const control of groups ) {
    control.tools[TOOL] = {
      name: TOOL,
      order: Object.keys(control.tools).length,
      title: "SOGROM_DICETRAY.PopoutTool",
      icon: "fas fa-dice-d20",
      toggle: true,
      active: DiceTrayWindow.isOpen,
      onChange: (_event, active) => DiceTrayWindow.toggle(active)
    };
  }
}
