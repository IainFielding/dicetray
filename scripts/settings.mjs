import { MODULE_ID, THEME_CHOICES } from "./constants.mjs";
import { invalidateRows } from "./layout.mjs";
import { applyTheme, rebuildTrays } from "./tray.mjs";

/** The layout changed: rebuild every open tray from it. */
function onLayoutChange() {
  invalidateRows();
  rebuildTrays();
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

  game.settings.register(MODULE_ID, "extraDice", {
    name: "SOGROM_DICETRAY.SettingExtraDice",
    hint: "SOGROM_DICETRAY.SettingExtraDiceHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: onLayoutChange
  });

  // The GM's dice layout: rows of button definitions (see dice.mjs). Empty means the default.
  game.settings.register(MODULE_ID, "diceRows", {
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: onLayoutChange
  });
}
