export const MODULE_ID = "sogrom-dicetray";

export const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];

export const MODE_CONFIG = {
  advantage:    { suffix: "adv", flavorKey: "FlavorAdvantage",    icon: "fa-angle-double-up",   labelKey: "Advantage",    tooltipKey: "TooltipAdvantage" },
  disadvantage: { suffix: "dis", flavorKey: "FlavorDisadvantage", icon: "fa-angle-double-down", labelKey: "Disadvantage", tooltipKey: "TooltipDisadvantage" }
};

export const THEME_CHOICES = {
  "darkmode": "SOGROM_DICETRAY.ThemeDarkMode",
  "lightmode": "SOGROM_DICETRAY.ThemeLightMode"
};
export const THEME_CLASSES = Object.keys(THEME_CHOICES);

export const MAX_DICE_PER_TYPE = 99;
export const MAX_MODIFIER = 99;
