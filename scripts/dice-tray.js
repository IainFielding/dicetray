import { MODULE_ID } from "./settings.js";

// Tracks the dice added by the user and the currently selected roll modifier.
let dicePool = [];
let diceTrayMode = "normal"; // "normal", "keephighest", "advantage", "disadvantage", "keeplowest"

function createDiceTray() {
  const tray = document.createElement("div");
  tray.classList.add("sogrom-dice-tray");

  // Apply current theme
  const theme = game.settings.get(MODULE_ID, "theme");
  if (theme) tray.classList.add(theme);

  // Title bar
  const titleBar = document.createElement("div");
  titleBar.classList.add("dice-tray-title");
  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "";
  titleBar.innerHTML = `<i class="fas fa-dice-d20"></i> ${game.i18n.localize("SOGROM_DICETRAY.Title")} <span class="dice-tray-version">v${moduleVersion}</span>`;
  tray.appendChild(titleBar);

  // Dice buttons 
  const diceRow = document.createElement("div");
  diceRow.classList.add("dice-tray-dice-row");

  const diceTypes = [4, 6, 8, 10, 12, 20, 100];
  for (const faces of diceTypes) {
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

  // Roll mode 
  const modeRow = document.createElement("div");
  modeRow.classList.add("dice-tray-mode-row");

  const modes = [
    { id: "keephighest", label: game.i18n.localize("SOGROM_DICETRAY.KeepHighest"), icon: "fa-arrow-up" },
    { id: "advantage", label: game.i18n.localize("SOGROM_DICETRAY.Advantage"), icon: "fa-angle-double-up" },
    { id: "disadvantage", label: game.i18n.localize("SOGROM_DICETRAY.Disadvantage"), icon: "fa-angle-double-down" },
    { id: "keeplowest", label: game.i18n.localize("SOGROM_DICETRAY.KeepLowest"), icon: "fa-arrow-down" }
  ];

  for (const mode of modes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.classList.add("dice-tray-btn", "dice-tray-mode-btn");
    btn.dataset.mode = mode.id;
    if (mode.id === diceTrayMode) btn.classList.add("active");
    btn.innerHTML = `<i class="fas ${mode.icon}"></i> ${mode.label}`;
    btn.addEventListener("click", () => setRollMode(mode.id));
    modeRow.appendChild(btn);
  }
  tray.appendChild(modeRow);

  // Display
  const formulaDisplay = document.createElement("input");
  formulaDisplay.type = "text";
  formulaDisplay.classList.add("dice-tray-formula");
  formulaDisplay.placeholder = game.i18n.localize("SOGROM_DICETRAY.FormulaPlaceholder");
  formulaDisplay.spellcheck = false;
  formulaDisplay.autocomplete = "off";
  formulaDisplay.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      rollDice();
    }
  });
  tray.appendChild(formulaDisplay);

  // Clear or Roll
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
  return tray;
}

// Dice Tray into ChatBar
export function injectDiceTray(element) {
  // Don't duplicate
  if (element.querySelector(".sogrom-dice-tray")) return;

  const tray = createDiceTray();

  // Apply visibility from setting
  const visible = game.settings.get(MODULE_ID, "showDiceTray");
  if (!visible) tray.classList.add("dice-tray-hidden");

  // V14 ApplicationV2: find the input part
  const inputPart = element.querySelector('[data-application-part="input"]');
  if (inputPart) {
    inputPart.insertBefore(tray, inputPart.firstChild);
    return;
  }

  // Fallback: look for a form element
  const form = element.querySelector("form");
  if (form) {
    form.parentElement.insertBefore(tray, form);
    return;
  }

  // Last resort: append to the element itself
  element.appendChild(tray);
}

// Toggle Button
export function injectToggleButton(element) {
  // Don't duplicate
  if (element.querySelector(".sogrom-dice-tray-toggle")) return;

  // Find the export button by data-action
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

    // Toggle all dice tray instances (sidebar + popout)
    document.querySelectorAll(".sogrom-dice-tray").forEach(tray => {
      tray.classList.toggle("dice-tray-hidden", current);
    });

    document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(btn => {
      btn.classList.toggle("toggled-off", current);
    });
  });

  // Insert before the export button
  exportBtn.parentElement.insertBefore(toggleBtn, exportBtn);
}

// Add Dice
function addDie(faces) {
  dicePool.push(faces);
  updateDieButtons();
  updateFormulaDisplay();
}

// Remove Dice
function removeDie(faces) {
  const idx = dicePool.lastIndexOf(faces);
  if (idx !== -1) {
    dicePool.splice(idx, 1);
    updateDieButtons();
    updateFormulaDisplay();
  }
}

// Show how many dice in the stack 
function updateDieButtons() {
  const groups = {};
  for (const faces of dicePool) {
    groups[faces] = (groups[faces] || 0) + 1;
  }
  document.querySelectorAll(".dice-tray-die-btn").forEach(btn => {
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
  });
}

// Update all mode buttons to reflect the current diceTrayMode.
function updateModeButtons() {
  document.querySelectorAll(".dice-tray-mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === diceTrayMode);
  });
}

// Set roll mode
function setRollMode(mode) {
  // Toggle: clicking the active mode deselects it (back to normal)
  diceTrayMode = (diceTrayMode === mode) ? "normal" : mode;
  updateModeButtons();
  updateFormulaDisplay();
}


// Build a dice formula string from the current pool and active mode.
function buildFormula() {
  if (dicePool.length === 0) return "";

  // Group dice by face count
  const groups = {};
  for (const faces of dicePool) {
    groups[faces] = (groups[faces] || 0) + 1;
  }

  // Build formula parts, sorting by die size
  const sortedFaces = Object.keys(groups).map(Number).sort((a, b) => a - b);
  const parts = sortedFaces.map(faces => {
    const count = groups[faces];
    if (diceTrayMode === "keephighest") {
      return `${count}d${faces}kh`;
    } else if (diceTrayMode === "advantage") {
      return `${count}d${faces}adv`;
    } else if (diceTrayMode === "disadvantage") {
      return `${count}d${faces}dis`;
    } else if (diceTrayMode === "keeplowest") {
      return `${count}d${faces}kl`;
    }
    return `${count}d${faces}`;
  });

  return parts.join(" + ");
}

// Update the formula display input with the current formula.
function updateFormulaDisplay() {
  const formula = buildFormula();
  document.querySelectorAll(".dice-tray-formula").forEach(el => {
    if (dicePool.length === 0) {
      el.value = "";
      el.classList.remove("has-dice");
    } else {
      el.value = formula;
      el.classList.add("has-dice");
    }
  });
}

// Roll Dice
async function rollDice() {
  // Find the formula input closest to the clicked context; fall back to first available
  const allInputs = document.querySelectorAll(".dice-tray-formula");
  let el = null;
  for (const input of allInputs) {
    if (input.closest(".sogrom-dice-tray") && document.activeElement?.closest(".sogrom-dice-tray") === input.closest(".sogrom-dice-tray")) {
      el = input;
      break;
    }
  }
  if (!el) el = allInputs[0] || null;
  const formula = el ? el.value.trim() : buildFormula();
  if (!formula) {
    ui.notifications.warn(game.i18n.localize("SOGROM_DICETRAY.EmptyPool"));
    return;
  }

  // Build a flavor label based on the active roll mode
  let flavor = game.i18n.localize("SOGROM_DICETRAY.FlavorBase");
  if (diceTrayMode === "keephighest") {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY.FlavorKeepHighest") + ")";
  } else if (diceTrayMode === "advantage") {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY.FlavorAdvantage") + ")";
  } else if (diceTrayMode === "disadvantage") {
    flavor += " (" + game.i18n.localize("SOGROM_DICETRAY.FlavorDisadvantage") + ")";
  } else if (diceTrayMode === "keeplowest") {
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

  // Clear the pool after rolling
  clearPool();
}

// Clear pool and reset mode
function clearPool() {
  dicePool = [];
  diceTrayMode = "normal";
  updateDieButtons();
  updateModeButtons();
  updateFormulaDisplay();
}

