export const MODULE_ID = "sogrom-dicetray";

/** Folder of the module's die icons. */
export const ICON_PATH = `modules/${MODULE_ID}/assets/icons`;

export const MODE_CONFIG = {
  advantage:    { suffix: "adv", keep: "kh", flavorKey: "FlavorAdvantage",    icon: "fa-angle-double-up",   labelKey: "Advantage",    tooltipKey: "TooltipAdvantage" },
  disadvantage: { suffix: "dis", keep: "kl", flavorKey: "FlavorDisadvantage", icon: "fa-angle-double-down", labelKey: "Disadvantage", tooltipKey: "TooltipDisadvantage" }
};

export const THEME_CHOICES = {
  "darkmode": "SOGROM_DICETRAY.ThemeDarkMode",
  "lightmode": "SOGROM_DICETRAY.ThemeLightMode"
};
export const THEME_CLASSES = Object.keys(THEME_CHOICES);

export const MAX_DICE_PER_TYPE = 99;
export const MAX_MODIFIER = 99;
