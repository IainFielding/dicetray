export const MODULE_ID = "sogrom-dicetray";

// --- Settings Registration ---
// Register client-side settings to persist dice tray visibility and theme per user.

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showDiceTray", {
    name: "SOGROM_DICETRAY.SettingShow",
    hint: "SOGROM_DICETRAY.SettingShowHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "theme", {
    name: "SOGROM_DICETRAY.SettingTheme",
    hint: "SOGROM_DICETRAY.SettingThemeHint",
    scope: "client",
    config: true,
    type: String,
    default: "darkmode",
    choices: {
      "darkmode": "SOGROM_DICETRAY.ThemeDarkMode",
      "lightmode": "SOGROM_DICETRAY.ThemeLightMode"
    },
    onChange: (value) => applyTheme(value)
  });
});

/**
 * Apply the selected theme class to all dice tray and toggle button instances.
 * Removes any previous theme class before adding the new one.
 */
export const THEME_CLASSES = ["darkmode", "lightmode"];

export function applyTheme(theme) {
  document.querySelectorAll(".sogrom-dice-tray").forEach(el => {
    el.classList.remove(...THEME_CLASSES);
    if (theme) el.classList.add(theme);
  });
  document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(el => {
    el.classList.remove(...THEME_CLASSES);
    if (theme) el.classList.add(theme);
  });
}