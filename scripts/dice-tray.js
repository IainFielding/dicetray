const MODULE_ID = "sogrom-dicetray";

// --- Dice Pool State ---
// Tracks the dice added by the user and the currently selected roll modifier.
let dicePool = [];
let rollMode = "normal"; // "normal", "keephighest", "advantage", "disadvantage", "keeplowest"

// --- Settings Registration ---
// Register client-side setting to persist dice tray visibility per user.

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showDiceTray", {
    name: "SOGROM_DICETRAY.SettingShow",
    hint: "SOGROM_DICETRAY.SettingShowHint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

/**
 * Create the dice tray DOM element.
 * Builds the full tray UI: title bar, dice buttons, mode buttons,
 * formula display, and action buttons (clear + roll).
 */
function createDiceTray() {
  const tray = document.createElement("div");
  tray.id = "sogrom-dice-tray";

  // --- Title bar ---
  const titleBar = document.createElement("div");
  titleBar.classList.add("dice-tray-title");
  titleBar.innerHTML = `<i class="fas fa-dice-d20"></i> ${game.i18n.localize("SOGROM_DICETRAY.Title")}`;
  tray.appendChild(titleBar);

  // --- Dice buttons (D4, D6, D8, D10, D12, D20, D100) ---
  // Left-click to add a die, right-click to remove one.
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

  // --- Roll mode row (KH / ADV / DIS / KL) ---
  // These are toggle buttons — click to select, click again to deselect.
  // Only one mode can be active at a time.
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
    if (mode.id === rollMode) btn.classList.add("active");
    btn.innerHTML = `<i class="fas ${mode.icon}"></i> ${mode.label}`;
    btn.addEventListener("click", () => setRollMode(mode.id));
    modeRow.appendChild(btn);
  }
  tray.appendChild(modeRow);

  // --- Formula display ---
  // Shows the computed dice formula based on pool and active mode.
  const formulaDisplay = document.createElement("div");
  formulaDisplay.classList.add("dice-tray-formula");
  formulaDisplay.id = "sogrom-dice-formula";
  formulaDisplay.textContent = game.i18n.localize("SOGROM_DICETRAY.EmptyPool");
  tray.appendChild(formulaDisplay);

  // --- Action row (Clear + Roll) ---
  // Clear resets the pool and mode. Roll evaluates and sends to chat.
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

/**
 * Inject the dice tray into the chat sidebar element.
 * Targets V14 ApplicationV2 DOM structure, with fallbacks for older layouts.
 * Respects the showDiceTray client setting for initial visibility.
 */
function injectDiceTray(element) {
  // Don't duplicate
  if (element.querySelector("#sogrom-dice-tray")) return;

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

/**
 * Inject a D20 toggle button next to the export chat log button in the sidebar header.
 * Clicking it shows/hides the dice tray and persists the preference.
 * Uses a class selector so the button works in both the sidebar and popped-out chat.
 */
function injectToggleButton(element) {
  // Don't duplicate
  if (element.querySelector(".sogrom-dice-tray-toggle")) return;

  // Find the export button by data-action
  const exportBtn = element.querySelector('[data-action="export"]');
  if (!exportBtn) return;

  const visible = game.settings.get(MODULE_ID, "showDiceTray");

  // Create toggle button matching the style of existing header controls
  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.classList.add("sogrom-dice-tray-toggle");
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
    document.querySelectorAll("#sogrom-dice-tray").forEach(tray => {
      tray.classList.toggle("dice-tray-hidden", current);
    });

    // Toggle all toggle button instances (sidebar + popout)
    document.querySelectorAll(".sogrom-dice-tray-toggle").forEach(btn => {
      btn.classList.toggle("toggled-off", current);
    });
  });

  // Insert before the export button
  exportBtn.parentElement.insertBefore(toggleBtn, exportBtn);
}

/**
 * Add a die to the pool by face count and refresh the UI.
 */
function addDie(faces) {
  dicePool.push(faces);
  updateDieButtons();
  updateFormulaDisplay();
}

/**
 * Remove the last occurrence of a die with the given face count from the pool.
 */
function removeDie(faces) {
  const idx = dicePool.lastIndexOf(faces);
  if (idx !== -1) {
    dicePool.splice(idx, 1);
    updateDieButtons();
    updateFormulaDisplay();
  }
}

/**
 * Update die buttons to show an active highlight and a count badge
 * indicating how many of each die type are in the pool.
 */
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

/**
 * Toggle the roll mode. Clicking the already-active mode deselects it
 * (reverts to "normal"). Only one mode can be active at a time.
 */
function setRollMode(mode) {
  // Toggle: clicking the active mode deselects it (back to normal)
  rollMode = (rollMode === mode) ? "normal" : mode;
  // Update button active states
  document.querySelectorAll(".dice-tray-mode-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.mode === rollMode);
  });
  updateFormulaDisplay();
}

/**
 * Build a dice formula string from the current pool and active mode.
 * - keephighest: appends "kh" (keep highest single die)
 * - advantage: doubles dice count and keeps top half
 * - disadvantage: doubles dice count and keeps bottom half
 * - keeplowest: appends "kl" (keep lowest single die)
 * - normal: no modifier
 */
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
    if (rollMode === "keephighest") {
      return `${count}d${faces}kh`;
    } else if (rollMode === "advantage") {
      return `${count}d${faces}adv`;
    } else if (rollMode === "disadvantage") {
      return `${count}d${faces}dis`;
    } else if (rollMode === "keeplowest") {
      return `${count}d${faces}kl`;
    }
    return `${count}d${faces}`;
  });

  return parts.join(" + ");
}

/**
 * Update the formula display element with the current formula,
 * or show the empty pool placeholder if no dice are selected.
 */
function updateFormulaDisplay() {
  const el = document.getElementById("sogrom-dice-formula");
  if (!el) return;

  if (dicePool.length === 0) {
    el.textContent = game.i18n.localize("SOGROM_DICETRAY.EmptyPool");
    el.classList.remove("has-dice");
    return;
  }

  el.textContent = buildFormula();
  el.classList.add("has-dice");
}

/**
 * Evaluate the current dice formula, post the result as a chat message
 * with a flavor label, then clear the pool and mode selection.
 */
async function rollDice() {
  const formula = buildFormula();
  if (!formula) {
    ui.notifications.warn("Add some dice to your pool first!");
    return;
  }

  // Build a flavor label based on the active roll mode
  let flavor = "Dice Tray Roll";
  if (rollMode === "keephighest") {
    flavor += " (Keep Highest)";
  } else if (rollMode === "advantage") {
    flavor += " (Advantage)";
  } else if (rollMode === "disadvantage") {
    flavor += " (Disadvantage)";
  } else if (rollMode === "keeplowest") {
    flavor += " (Keep Lowest)";
  }

  const roll = new Roll(formula);
  await roll.evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker(),
    flavor: flavor
  });

  // Clear the pool after rolling
  clearPool();
}

/**
 * Clear the dice pool, reset the roll mode to normal,
 * update the UI, and deselect all mode buttons.
 */
function clearPool() {
  dicePool = [];
  rollMode = "normal";
  updateDieButtons();
  updateFormulaDisplay();
  // Deselect all mode buttons
  document.querySelectorAll(".dice-tray-mode-btn").forEach(btn => {
    btn.classList.remove("active");
  });
}

// --- Hooks ---

// Inject dice tray and toggle button on each ChatLog render.
// The element passed to the hook is the content area; app.element includes the header.
Hooks.on("renderChatLog", (app, element, context, options) => {
  console.log(`${MODULE_ID} | renderChatLog hook fired`);
  injectDiceTray(element);
  // Try to inject toggle into the app's full element (includes header controls)
  if (app.element) injectToggleButton(app.element);
});

// On first world load, the export button may not be in the DOM when renderChatLog fires.
// A MutationObserver watches the sidebar for the export button to appear, then injects
// the toggle button. Disconnects itself once the button is placed or already exists.
Hooks.once("ready", () => {
  // If already injected (e.g. by renderChatLog), nothing to do
  if (document.querySelector(".sogrom-dice-tray-toggle")) return;

  const target = document.getElementById("sidebar") || document.body;
  const observer = new MutationObserver(() => {
    // Wait until the export button exists AND we haven't injected yet
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
});
