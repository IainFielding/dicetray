import { MODULE_ID, THEME_CHOICES } from "./constants.mjs";
import { DiceLayoutConfig } from "./apps/layout-config.mjs";
import { invalidateRows } from "./layout.mjs";
import { DiceTrayWindow } from "./popout.mjs";
import { applyTheme, rebuildTrays } from "./tray.mjs";

/** The layout changed: rebuild every open tray from it. */
function onLayoutChange() {
  invalidateRows();
  rebuildTrays();
  DiceTrayWindow.refresh();
}

export function registerSettings() {
  game.settings.register(MODULE_ID, "theme", {
    name: "SOGROM_DICETRAY.SettingTheme",
    hint: "SOGROM_DICETRAY.SettingThemeHint",
    scope: "client",
    config: true,
    type: String,
    default: "darkmode",
    choices: THEME_CHOICES,
    onChange: value => applyTheme(value)
  });

  game.settings.register(MODULE_ID, "showDiceTray", {
    name: "SOGROM_DICETRAY.SettingShow",
    hint: "SOGROM_DICETRAY.SettingShowHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "rightClick", {
    name: "SOGROM_DICETRAY.SettingRightClick",
    hint: "SOGROM_DICETRAY.SettingRightClickHint",
    scope: "user",
    config: true,
    type: String,
    default: "remove",
    choices: {
      remove: "SOGROM_DICETRAY.RightClickRemove",
      roll: "SOGROM_DICETRAY.RightClickRoll"
    }
  });

  game.settings.registerMenu(MODULE_ID, "layout", {
    name: "SOGROM_DICETRAY.LayoutMenu",
    label: "SOGROM_DICETRAY.LayoutMenuLabel",
    hint: "SOGROM_DICETRAY.LayoutMenuHint",
    icon: "fas fa-dice",
    type: DiceLayoutConfig,
    restricted: true
  });

  // The GM's dice layout: rows of button definitions (see dice.mjs). Empty means the default.
  game.settings.register(MODULE_ID, "diceRows", {
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: onLayoutChange
  });

  game.settings.register(MODULE_ID, "popoutButton", {
    name: "SOGROM_DICETRAY.SettingPopoutButton",
    hint: "SOGROM_DICETRAY.SettingPopoutButtonHint",
    scope: "client",
    config: true,
    type: String,
    default: "tokens",
    choices: {
      none: "SOGROM_DICETRAY.PopoutButtonNone",
      tokens: "SOGROM_DICETRAY.PopoutButtonTokens",
      all: "SOGROM_DICETRAY.PopoutButtonAll"
    },
    onChange: () => ui.controls?.render({ reset: true })
  });

  game.settings.register(MODULE_ID, "popoutAutoOpen", {
    name: "SOGROM_DICETRAY.SettingPopoutAutoOpen",
    hint: "SOGROM_DICETRAY.SettingPopoutAutoOpenHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "popoutPosition", {
    scope: "client",
    config: false,
    type: Object,
    default: {}
  });
}
