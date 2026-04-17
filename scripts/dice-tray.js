const MODULE_ID = "sogrom-dicetray";
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
const MODE_CONFIG = {
  keephighest:  { suffix: "kh",  flavorKey: "FlavorKeepHighest",  icon: "fa-arrow-up",          labelKey: "KeepHighest" },
  advantage:    { suffix: "adv", flavorKey: "FlavorAdvantage",    icon: "fa-angle-double-up",   labelKey: "Advantage" },
  disadvantage: { suffix: "dis", flavorKey: "FlavorDisadvantage", icon: "fa-angle-double-down", labelKey: "Disadvantage" },
  keeplowest:   { suffix: "kl",  flavorKey: "FlavorKeepLowest",   icon: "fa-arrow-down",        labelKey: "KeepLowest" },
};

const THEME_CHOICES = {
  "darkmode": "SOGROM_DICETRAY.ThemeDarkMode",
  "lightmode": "SOGROM_DICETRAY.ThemeLightMode"
};
const THEME_CLASSES = Object.keys(THEME_CHOICES);

let dicePool = [];
let diceTrayMode = "normal";
const trayInstances = new Set();

// Settings

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
    choices: THEME_CHOICES,
    onChange: (value) => applyTheme(value)
  });
});

// UI Creation

function createDiceTray() {
  const tray = document.createElement("div");
  tray.classList.add("sogrom-dice-tray");

  const theme = game.settings.get(MODULE_ID, "theme");
  if (theme) tray.classList.add(theme);

  const titleBar = document.createElement("div");
  titleBar.classList.add("dice-tray-title");
  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "";
  titleBar.innerHTML = `<i class="fas fa-dice-d20"></i> ${game.i18n.localize("SOGROM_DICETRAY.Title")} <span class="dice-tray-version">v${moduleVersion}</span>`;
  tray.appendChild(titleBar);

  const diceRow = document.createElement("div");
  diceRow.classList.add("dice-tray-dice-row");

  for (const faces of DICE_TYPES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dice-tray-btn", "dice-tray-die-btn");
    btn.dataset.faces = faces;
    btn.textContent = `D${faces}`;
    btn.title = `Add a D${faces}`;
    btn.addEventListener("click", () => addDie(faces));
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      removeDie(faces);
    });
    diceRow.appendChild(btn);
  }
  tray.appendChild(diceRow);

  const modeRow = document.createElement("div");
  modeRow.classList.add("dice-tray-mode-row");

  for (const [id, cfg] of Object.entries(MODE_CONFIG)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dice-tray-btn", "dice-tray-mode-btn");
    btn.dataset.mode = id;
    if (id === diceTrayMode) btn.classList.add("active");
    btn.innerHTML = `<i class="fas ${cfg.icon}"></i> ${game.i18n.localize("SOGROM_DICETRAY." + cfg.labelKey)}`;
    btn.addEventListener("click", () => setRollMode(id));
    modeRow.appendChild(btn);
  }
  tray.appendChild(modeRow);

  const formulaDisplay = document.createElement("input");
  formulaDisplay.type = "text";
  formulaDisplay.classList.add("dice-tray-formula");
  formulaDisplay.placeholder = game.i18n.localize("SOGROM_DICETRAY.FormulaPlaceholder");
  formulaDisplay.spellcheck = false;
  formulaDisplay.autocomplete = "off";
  formulaDisplay.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      rollDice(e);
    }
  });
  tray.appendChild(formulaDisplay);

  const actionRow = document.createElement("div");
  actionRow.classList.add("dice-tray-action-row");

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.classList.add("dice-tray-btn", "dice-tray-clear-btn");
  clearBtn.innerHTML = `<i class="fas fa-times"></i> ${game.i18n.localize("SOGROM_DICETRAY.ClearButton")}`;
  clearBtn.addEventListener("click", clearPool);
  actionRow.appendChild(clearBtn);

  const rollBtn = document.createElement("button");
  rollBtn.type = "button";
  rollBtn.classList.add("dice-tray-btn", "dice-tray-roll-btn");
  rollBtn.innerHTML = `<i class="fas fa-dice-d20"></i> ${game.i18n.localize("SOGROM_DICETRAY.RollButton")}`;
  rollBtn.addEventListener("click", rollDice);
  actionRow.appendChild(rollBtn);

  tray.appendChild(actionRow);
  trayInstances.add(tray);
  return tray;
}

function injectDiceTray(element) {
  if (element.querySelector(".sogrom-dice-tray")) return;

  const tray = createDiceTray();

  const visible = game.settings.get(MODULE_ID, "showDiceTray");
  if (!visible) tray.classList.add("dice-tray-hidden");

  const inputPart = element.querySelector('[data-application-part="input"]');
  if (inputPart) {
    inputPart.insertBefore(tray, inputPart.firstChild);
    return;
  }

  const form = element.querySelector("form");
  if (form) {
    form.parentElement.insertBefore(tray, form);
    return;
  }

  element.appendChild(tray);
}

function injectToggleButton(element) {
  if (element.querySelector(".sogrom-dice-tray-toggle")) return;

  const exportBtn = element.querySelector('[data-action="export"]');
  if (!exportBtn) return;

  const visible = game.settings.get(MODULE_ID, "showDiceTray");

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.classList.add("sogrom-dice-tray-toggle");
  const currentTheme = game.settings.get(MODULE_ID, "theme");
  if (currentTheme) toggleBtn.classList.add(currentTheme);
  toggleBtn.dataset.action = "toggleDiceTray";
  toggleBtn.dataset.tooltip = game.i18n.localize("SOGROM_DICETRAY.ToggleTray");
  toggleBtn.setAttribute("aria-label", game.i18n.localize("SOGROM_DICETRAY.ToggleTray"));
  toggleBtn.innerHTML = `<i class="fas fa-dice-d20"></i>`;
  if (!visible) toggleBtn.classList.add("toggled-off");

  toggleBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const current = game.settings.get(MODULE_ID, "showDiceTray");
    await game.settings.set(MODULE_ID, "showDiceTray", !current);

    for (const tray of trayInstances) {
      if (!tray.isConnected) { trayInstances.delete(tray); continue; }
      tray.classList.toggle("dice-tray-hidden", current);
    }
    document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(btn => {
      btn.classList.toggle("toggled-off", current);
    });
  });

  exportBtn.parentElement.insertBefore(toggleBtn, exportBtn);
}

// State & Logic

function addDie(faces) {
  dicePool.push(faces);
  updateDieButtons();
  updateFormulaDisplay();
}

function removeDie(faces) {
  const idx = dicePool.lastIndexOf(faces);
  if (idx !== -1) {
    dicePool.splice(idx, 1);
    updateDieButtons();
    updateFormulaDisplay();
  }
}

function getDiceGroups() {
  const groups = {};
  for (const faces of dicePool) groups[faces] = (groups[faces] || 0) + 1;
  return groups;
}

function updateDieButtons() {
  const groups = getDiceGroups();
  for (const tray of trayInstances) {
    if (!tray.isConnected) { trayInstances.delete(tray); continue; }
    for (const btn of tray.querySelectorAll(".dice-tray-die-btn")) {
      const faces = Number(btn.dataset.faces);
      const count = groups[faces] || 0;
      btn.classList.toggle("active", count > 0);
      let badge = btn.querySelector(".dice-tray-badge");
      if (count > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.classList.add("dice-tray-badge");
          btn.appendChild(badge);
        }
        badge.textContent = count;
      } else if (badge) {
        badge.remove();
      }
    }
  }
}

function updateModeButtons() {
  for (const tray of trayInstances) {
    if (!tray.isConnected) { trayInstances.delete(tray); continue; }
    for (const btn of tray.querySelectorAll(".dice-tray-mode-btn")) {
      btn.classList.toggle("active", btn.dataset.mode === diceTrayMode);
    }
  }
}

function setRollMode(mode) {
  diceTrayMode = (diceTrayMode === mode) ? "normal" : mode;
  updateModeButtons();
  updateFormulaDisplay();
}

function buildFormula() {
  if (dicePool.length === 0) return "";
  const groups = getDiceGroups();
  const suffix = MODE_CONFIG[diceTrayMode]?.suffix ?? "";
  const sortedFaces = Object.keys(groups).map(Number).sort((a, b) => a - b);
  return sortedFaces.map(f => `${groups[f]}d${f}${suffix}`).join(" + ");
}

function updateFormulaDisplay() {
  const formula = buildFormula();
  for (const tray of trayInstances) {
    if (!tray.isConnected) { trayInstances.delete(tray); continue; }
    const el = tray.querySelector(".dice-tray-formula");
    if (!el) continue;
    if (dicePool.length === 0) {
      el.value = "";
      el.classList.remove("has-dice");
    } else {
      el.value = formula;
      el.classList.add("has-dice");
    }
  }
}

async function rollDice(e) {
  const tray = e?.target?.closest(".sogrom-dice-tray");
  const el = tray?.querySelector(".dice-tray-formula") ?? document.querySelector(".dice-tray-formula");
  const formula = el ? el.value.trim() : buildFormula();
  if (!formula) {
    ui.notifications.warn(game.i18n.localize("SOGROM_DICETRAY.EmptyPool"));
    return;
  }

  let flavor = game.i18n.localize("SOGROM_DICETRAY.FlavorBase");
  const modeInfo = MODE_CONFIG[diceTrayMode];
  if (modeInfo) {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY." + modeInfo.flavorKey) + ")";
  }

  try {
    const roll = new Roll(formula);
    await roll.evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker(),
      flavor: flavor
    });
  } catch (err) {
    console.error(`${MODULE_ID} | Roll error:`, err);
    ui.notifications.error(game.i18n.localize("SOGROM_DICETRAY.RollError"));
    return;
  }

  clearPool();
}

function clearPool() {
  dicePool = [];
  diceTrayMode = "normal";
  updateDieButtons();
  updateModeButtons();
  updateFormulaDisplay();
}

function applyTheme(theme) {
  for (const tray of trayInstances) {
    if (!tray.isConnected) { trayInstances.delete(tray); continue; }
    tray.classList.remove(...THEME_CLASSES);
    if (theme) tray.classList.add(theme);
  }
  document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(el => {
    el.classList.remove(...THEME_CLASSES);
    if (theme) el.classList.add(theme);
  });
}

// Hook Registrations

Hooks.on("renderChatLog", (app, element) => {
  injectDiceTray(element);
  if (app.element) injectToggleButton(app.element);
});

Hooks.once("ready", () => {
  if (document.querySelector(".sogrom-dice-tray-toggle")) return;
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  const observer = new MutationObserver(() => {
    const exportBtn = sidebar.querySelector('[data-action="export"]');
    if (!exportBtn) return;
    injectToggleButton(exportBtn.closest(".application, .sidebar-tab, #sidebar") || sidebar);
    observer.disconnect();
  });
  observer.observe(sidebar, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
});
