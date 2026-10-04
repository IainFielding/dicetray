export const MODULE_ID = "sogrom-dicetray";

/**
 * Hooks the module calls, for other modules and macros. Documented in docs/API.md; renaming one
 * breaks everything that listens for it.
 */
export const HOOKS = Object.freeze({
  /** (api) During Foundry's init, once the API exists. Register system maps here. */
  init: `${MODULE_ID}.init`,
  /** (api) When the world is ready. */
  ready: `${MODULE_ID}.ready`,
  /** (data: {formula, flavor, source}) Before any roll; change data, or return false to cancel. */
  preRoll: `${MODULE_ID}.preRoll`,
  /** (roll, message, data) After a roll is posted to chat. */
  roll: `${MODULE_ID}.roll`,
  /** (pool) Whenever the pool changes. */
  poolChanged: `${MODULE_ID}.poolChanged`
});

/** Localise one of the module's own strings: t("Title") → game.i18n.localize("SOGROM_DICETRAY.Title"). */
export const t = key => game.i18n.localize(`SOGROM_DICETRAY.${key}`);

/** Folder of the module's die icons. */
export const ICON_PATH = `modules/${MODULE_ID}/assets/icons`;

export const THEME_CHOICES = {
  "darkmode": "SOGROM_DICETRAY.ThemeDarkMode",
  "lightmode": "SOGROM_DICETRAY.ThemeLightMode"
};
export const THEME_CLASSES = Object.keys(THEME_CHOICES);

export const MAX_DICE_PER_TYPE = 99;
export const MAX_MODIFIER = 99;
