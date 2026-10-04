import { MODULE_ID, THEME_CHOICES } from "./constants.mjs";
import { applyTheme } from "./tray.mjs";

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
}
