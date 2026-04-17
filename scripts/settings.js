import { injectDiceTray, injectToggleButton } from "./dice-tray.js";

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

// Inject dice tray and toggle button on each ChatLog render.
// The element passed to the hook is the content area; app.element includes the header.
Hooks.on("renderChatLog", (app, element, context, options) => {
  console.log(`${MODULE_ID} | renderChatLog hook fired`);
  injectDiceTray(element);
  if (app.element) injectToggleButton(app.element);
});

// On first world load, the export button may not be in the DOM when renderChatLog fires.
// A MutationObserver watches the sidebar for the export button to appear, then injects
// the toggle button. Disconnects itself once the button is placed or already exists.
Hooks.once("ready", () => {
  if (document.querySelector(".sogrom-dice-tray-toggle")) return;

  const target = document.getElementById("sidebar") || document.body;
  const observer = new MutationObserver(() => {
    if (document.querySelector(".sogrom-dice-tray-toggle")) {
      observer.disconnect();
      return;
    }

    const exportBtn = target.querySelector('[data-action="export"]');
    if (exportBtn) {
      injectToggleButton(exportBtn.closest(".application, .sidebar-tab, #sidebar") || target);
      observer.disconnect();
    }
  });

  observer.observe(target, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 30000);
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
