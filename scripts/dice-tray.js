const MODULE_ID = "sogrom-dicetray";
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
const MODE_CONFIG = {
  advantage:    { suffix: "adv", flavorKey: "FlavorAdvantage",    icon: "fa-angle-double-up",   labelKey: "Advantage",    tooltipKey: "TooltipAdvantage" },
  disadvantage: { suffix: "dis", flavorKey: "FlavorDisadvantage", icon: "fa-angle-double-down", labelKey: "Disadvantage", tooltipKey: "TooltipDisadvantage" },
};

const THEME_CHOICES = {
  "darkmode": "SOGROM_DICETRAY.ThemeDarkMode",
  "lightmode": "SOGROM_DICETRAY.ThemeLightMode"
};
const THEME_CLASSES = Object.keys(THEME_CHOICES);

let dicePool = [];
let diceTrayMode = "normal";
let lastDieType = null;
let rollModifier = 0;
const keepModifiers = {};
const trayInstances = new Set();

// Helpers

function forEachTray(callback) {
  for (const tray of trayInstances) {
    if (!tray.isConnected) { trayInstances.delete(tray); continue; }
    callback(tray);
  }
}

function updateBadge(btn, count) {
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

function createKeepButton({ type, icon, labelKey, tooltipKey }) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add("dice-tray-btn", "dice-tray-keep-btn");
  btn.dataset.keep = type;
  btn.dataset.labelKey = labelKey;
  btn.dataset.icon = icon;
  btn.dataset.tooltipKey = tooltipKey;
  btn.title = game.i18n.localize("SOGROM_DICETRAY." + tooltipKey);
  const count = getKeepCount(type);
  if (count > 0) btn.classList.add("active");
  btn.innerHTML = `<i class="fas ${icon}"></i> ${game.i18n.localize("SOGROM_DICETRAY." + labelKey)}`;
  updateBadge(btn, count);
  btn.addEventListener("click", () => adjustKeep(type, 1));
  btn.addEventListener("contextmenu", (e) => { e.preventDefault(); adjustKeep(type, -1); });
  return btn;
}

function refreshUI() {
  updateDieButtons();
  updateModeButtons();
  updateKeepButtons();
  updateFormulaDisplay();
}

// Settings

Hooks.once("init", () => {
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

  game.settings.register(MODULE_ID, "showDiceTray", {
    name: "SOGROM_DICETRAY.SettingShow",
    hint: "SOGROM_DICETRAY.SettingShowHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

// ProseMirror Chat Helper

function getChatTextarea() {
  const proseMirror = document.getElementById("chat-message");
  const editorContent = proseMirror?.querySelector(".editor-content.ProseMirror");
  if (!editorContent) return proseMirror;
  return {
    get value() { return editorContent.innerText.replace(/\n$/, ""); },
    set value(v) { editorContent.innerText = v; },
    focus() { editorContent.focus(); },
  };
}

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

  const diceRow = document.createElement("div");
  diceRow.classList.add("dice-tray-dice-row");

  for (const faces of DICE_TYPES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dice-tray-btn", "dice-tray-die-btn");
    btn.dataset.faces = faces;
    btn.title = game.i18n.format("SOGROM_DICETRAY.TooltipAddDie", { die: `D${faces}` });
    const iconPath = `modules/${MODULE_ID}/assets/icons/d${faces}-grey.svg`;
    const img = document.createElement("img");
    img.src = iconPath;
    img.alt = `D${faces}`;
    img.classList.add("dice-tray-die-icon");
    img.addEventListener("error", () => {
      const fallback = document.createElement("span");
      fallback.classList.add("dice-tray-die-fallback");
      fallback.textContent = `D${faces}`;
      img.replaceWith(fallback);
    });
    btn.appendChild(img);
    btn.addEventListener("click", () => addDie(faces));
    btn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      removeDie(faces);
    });
    diceRow.appendChild(btn);
  }
  tray.appendChild(diceRow);

  // Controls row: stacked pairs for modifier, keep, mode + roll button
  const controlsRow = document.createElement("div");
  controlsRow.classList.add("dice-tray-controls-row");

  // Modifier pair: + / -
  const modPair = document.createElement("div");
  modPair.classList.add("dice-tray-stacked-pair");

  const plusBtn = document.createElement("button");
  plusBtn.type = "button";
  plusBtn.classList.add("dice-tray-btn", "dice-tray-modifier-btn");
  plusBtn.title = game.i18n.localize("SOGROM_DICETRAY.TooltipModifierPlus");
  plusBtn.innerHTML = `<i class="fas fa-plus"></i>`;
  plusBtn.addEventListener("click", () => adjustModifier(1));
  modPair.appendChild(plusBtn);

  const minusBtn = document.createElement("button");
  minusBtn.type = "button";
  minusBtn.classList.add("dice-tray-btn", "dice-tray-modifier-btn");
  minusBtn.title = game.i18n.localize("SOGROM_DICETRAY.TooltipModifierMinus");
  minusBtn.innerHTML = `<i class="fas fa-minus"></i>`;
  minusBtn.addEventListener("click", () => adjustModifier(-1));
  modPair.appendChild(minusBtn);

  controlsRow.appendChild(modPair);

  // Keep pair: KH / KL
  const keepPair = document.createElement("div");
  keepPair.classList.add("dice-tray-stacked-pair");
  keepPair.appendChild(createKeepButton({ type: "kh", icon: "fa-arrow-up", labelKey: "KeepHighest", tooltipKey: "TooltipKeepHighest" }));
  keepPair.appendChild(createKeepButton({ type: "kl", icon: "fa-arrow-down", labelKey: "KeepLowest", tooltipKey: "TooltipKeepLowest" }));
  controlsRow.appendChild(keepPair);

  // Mode pair: ADV / DIS
  const modePair = document.createElement("div");
  modePair.classList.add("dice-tray-stacked-pair");
  for (const [id, cfg] of Object.entries(MODE_CONFIG)) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dice-tray-btn", "dice-tray-mode-btn");
    btn.dataset.mode = id;
    btn.title = game.i18n.localize("SOGROM_DICETRAY." + cfg.tooltipKey);
    if (id === diceTrayMode) btn.classList.add("active");
    btn.innerHTML = `<i class="fas ${cfg.icon}"></i> ${game.i18n.localize("SOGROM_DICETRAY." + cfg.labelKey)}`;
    btn.addEventListener("click", () => setRollMode(id));
    modePair.appendChild(btn);
  }
  controlsRow.appendChild(modePair);

  // Roll button (full height, same size as dice button)
  const controlsRollBtn = document.createElement("button");
  controlsRollBtn.type = "button";
  controlsRollBtn.classList.add("dice-tray-btn", "dice-tray-controls-roll-btn");
  controlsRollBtn.title = game.i18n.localize("SOGROM_DICETRAY.ButtonRoll");
  controlsRollBtn.innerHTML = game.i18n.localize("SOGROM_DICETRAY.ButtonRoll");
  controlsRollBtn.addEventListener("click", (e) => rollDice(e));
  controlsRow.appendChild(controlsRollBtn);

  tray.appendChild(controlsRow);

  tray.appendChild(titleBar);

  trayInstances.add(tray);
  return tray;
}

function injectDiceTray(element) {
  // Remove all existing trays to prevent duplicates across chat contexts (sidebar/pop-out)
  document.querySelectorAll(".sogrom-dice-tray").forEach(el => el.remove());
  const chatMessage = element.querySelector('#chat-message');
  if (!chatMessage) return;
  const tray = createDiceTray();
  const visible = game.settings.get(MODULE_ID, "showDiceTray");
  if (!visible) tray.classList.add("dice-tray-hidden");
  tray.style.flex = "0 0";
  tray.style.pointerEvents = "all";
  tray.style.order = "999";
  chatMessage.after(tray);
}

function injectToggleButton(element) {
  if (element.querySelector(".sogrom-dice-tray-toggle")) return;

  function actuallyInject() {
    const messageModesDiv = element.querySelector('#message-modes');

    if (!messageModesDiv) return false;

    let insertAfterBtn = messageModesDiv.querySelector('button[aria-label="Public as Character"]');
    if (!insertAfterBtn) {
      const allBtns = messageModesDiv.querySelectorAll('button');
      if (allBtns.length > 0) {
        insertAfterBtn = allBtns[allBtns.length - 1];
      } else {
        return false;
      }
    }

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
    if (visible) toggleBtn.classList.add("tray-visible");
    toggleBtn.style.pointerEvents = "all";

    // Remove any existing toggle buttons in other contexts before inserting
    document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(el => el.remove());

    toggleBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const current = game.settings.get(MODULE_ID, "showDiceTray");
      await game.settings.set(MODULE_ID, "showDiceTray", !current);

      forEachTray(tray => tray.classList.toggle("dice-tray-hidden", current));
      document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(btn => {
        btn.classList.toggle("toggled-off", current);
        btn.classList.toggle("tray-visible", !current);
      });
    });

    insertAfterBtn.insertAdjacentElement('afterend', toggleBtn);
    return true;
  }

  // Try immediately, if not present, observe for it
  if (!actuallyInject()) {
    const observer = new MutationObserver(() => {
      if (actuallyInject()) observer.disconnect();
    });
    observer.observe(element, { childList: true, subtree: true });
    // Safety: disconnect after 5 seconds
    setTimeout(() => observer.disconnect(), 5000);
  }
}

// State & Logic

const MAX_DICE_PER_TYPE = 99;

function addDie(faces) {
  const count = dicePool.filter(f => f === faces).length;
  if (count >= MAX_DICE_PER_TYPE) {
    ui.notifications.warn(game.i18n.format("SOGROM_DICETRAY.MaxDiceReached", { max: MAX_DICE_PER_TYPE, die: `D${faces}` }));
    return;
  }
  dicePool.push(faces);
  lastDieType = faces;
  refreshUI();
}

function removeDie(faces) {
  const idx = dicePool.lastIndexOf(faces);
  if (idx !== -1) {
    dicePool.splice(idx, 1);
    refreshUI();
  }
}

function getDiceGroups() {
  const groups = {};
  for (const faces of dicePool) groups[faces] = (groups[faces] || 0) + 1;
  return groups;
}

function updateDieButtons() {
  const groups = getDiceGroups();
  forEachTray(tray => {
    for (const btn of tray.querySelectorAll(".dice-tray-die-btn")) {
      const faces = Number(btn.dataset.faces);
      const count = groups[faces] || 0;
      btn.classList.toggle("active", count > 0);
      updateBadge(btn, count);
      // Show keep modifier indicator on the die button
      const mod = keepModifiers[faces];
      let indicator = btn.querySelector(".dice-tray-keep-indicator");
      if (mod && count > 0) {
        if (!indicator) {
          indicator = document.createElement("span");
          indicator.classList.add("dice-tray-keep-indicator");
          btn.appendChild(indicator);
        }
        indicator.textContent = mod.type.toUpperCase();
        indicator.dataset.type = mod.type;
      } else if (indicator) {
        indicator.remove();
      }
    }
  });
}

function updateModeButtons() {
  forEachTray(tray => {
    for (const btn of tray.querySelectorAll(".dice-tray-mode-btn")) {
      btn.classList.toggle("active", btn.dataset.mode === diceTrayMode);
    }
  });
}

function getKeepCount(type) {
  if (!lastDieType) return 0;
  const mod = keepModifiers[lastDieType];
  if (!mod || mod.type !== type) return 0;
  return mod.count;
}

function adjustKeep(type, delta) {
  if (dicePool.length === 0 || !lastDieType) return;
  diceTrayMode = "normal";
  const existing = keepModifiers[lastDieType];
  if (existing && existing.type !== type) {
    // Switching from kh to kl or vice versa on this die type
    delete keepModifiers[lastDieType];
  }
  const current = (existing && existing.type === type) ? existing.count : 0;
  const newCount = Math.max(0, current + delta);
  if (newCount > 0) {
    keepModifiers[lastDieType] = { type, count: newCount };
  } else {
    delete keepModifiers[lastDieType];
  }
  refreshUI();
}

function updateKeepButtons() {
  forEachTray(tray => {
    for (const btn of tray.querySelectorAll(".dice-tray-keep-btn")) {
      const type = btn.dataset.keep;
      const count = getKeepCount(type);
      btn.classList.toggle("active", count > 0);
      // Update label and tooltip to show target die type
      const icon = btn.dataset.icon;
      const labelKey = btn.dataset.labelKey;
      const baseLabel = game.i18n.localize("SOGROM_DICETRAY." + labelKey);
      if (count > 0 && lastDieType) {
        btn.innerHTML = `<i class="fas ${icon}"></i> ${baseLabel} D${lastDieType}`;
        const tooltipForKey = type === "kh" ? "TooltipKeepHighestFor" : "TooltipKeepLowestFor";
        btn.title = game.i18n.format("SOGROM_DICETRAY." + tooltipForKey, { die: `D${lastDieType}` });
      } else {
        btn.innerHTML = `<i class="fas ${icon}"></i> ${baseLabel}`;
        btn.title = game.i18n.localize("SOGROM_DICETRAY." + btn.dataset.tooltipKey);
      }
      updateBadge(btn, count);
    }
  });
}

const MAX_MODIFIER = 99;

function adjustModifier(delta) {
  rollModifier = Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, rollModifier + delta));
  refreshUI();
}

function setRollMode(mode) {
  diceTrayMode = (diceTrayMode === mode) ? "normal" : mode;
  refreshUI();
}

function buildFormula() {
  if (dicePool.length === 0) return "";
  const groups = getDiceGroups();
  const modeSuffix = MODE_CONFIG[diceTrayMode]?.suffix ?? "";
  const sortedFaces = Object.keys(groups).map(Number).sort((a, b) => a - b);
  let formula = sortedFaces.map(f => {
    let suffix = "";
    const mod = keepModifiers[f];
    if (mod && mod.count > 0) {
      suffix += mod.count === 1 ? mod.type : `${mod.type}${mod.count}`;
    }
    suffix += modeSuffix;
    return `${groups[f]}d${f}${suffix}`;
  }).join(" + ");
  if (rollModifier > 0) {
    formula += " + " + rollModifier;
  } else if (rollModifier < 0) {
    formula += " - " + Math.abs(rollModifier);
  }
  return formula;
}

function updateFormulaDisplay() {
  const formula = buildFormula();
  const chat = getChatTextarea();
  if (chat) {
    if (dicePool.length === 0) {
      chat.value = "";
    } else {
      chat.value = "/r " + formula;
    }
  }
}

async function rollDice(e) {
  let formula = buildFormula();

  // Respect any manual edits the user made in the chat bar
  const chat = getChatTextarea();
  if (chat) {
    const chatValue = chat.value.trim();
    const rollMatch = chatValue.match(/^\/r(?:oll)?\s+(.+)$/i);
    if (rollMatch) {
      formula = rollMatch[1].trim();
    }
  }

  if (!formula) {
    ui.notifications.warn(game.i18n.localize("SOGROM_DICETRAY.EmptyPool"));
    return;
  }

  let flavor = game.i18n.localize("SOGROM_DICETRAY.FlavorBase");
  const modeInfo = MODE_CONFIG[diceTrayMode];
  if (modeInfo) {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY." + modeInfo.flavorKey) + ")";
  } else if (Object.values(keepModifiers).some(m => m.type === "kh" && m.count > 0)) {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY.FlavorKeepHighest") + ")";
  } else if (Object.values(keepModifiers).some(m => m.type === "kl" && m.count > 0)) {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY.FlavorKeepLowest") + ")";
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
  rollModifier = 0;
  for (const key of Object.keys(keepModifiers)) delete keepModifiers[key];
  lastDieType = null;
  refreshUI();
}

function applyTheme(theme) {
  forEachTray(tray => {
    tray.classList.remove(...THEME_CLASSES);
    if (theme) tray.classList.add(theme);
  });
  document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(el => {
    el.classList.remove(...THEME_CLASSES);
    if (theme) el.classList.add(theme);
  });
}

// Hook Registrations

Hooks.on("renderChatLog", (app, element) => {
  injectDiceTray(element);
  injectToggleButton(element);
});

Hooks.on("collapseSidebar", () => {
  // Remove all trays and toggle buttons (collapsed/expanded use different DOM contexts)
  document.querySelectorAll(".sogrom-dice-tray").forEach(el => el.remove());
  document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(el => el.remove());
  const element = ui.chat?.element;
  if (element) {
    injectDiceTray(element);
    injectToggleButton(element);
  }
});

Hooks.on("changeSidebarTab", () => {
  const element = ui.chat?.element;
  if (element) injectDiceTray(element);
});

// Reset dice pool when a chat message is submitted
Hooks.on("chatMessage", () => {
  clearPool();
});


