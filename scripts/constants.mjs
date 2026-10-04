export const MODULE_ID = "sogrom-dicetray";

/** The dice every tray shows. */
export const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

/** Less common dice, shown on a second row when the GM turns it on. */
export const EXTRA_DICE_TYPES = [2, 3, 5, 7, 14, 16, 24, 30];

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
