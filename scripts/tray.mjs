import { DICE_TYPES, MAX_DICE_PER_TYPE, MODE_CONFIG, MODULE_ID, THEME_CLASSES } from "./constants.mjs";
import {
  addDie, adjustKeep, adjustModifier, getDiceGroups, getKeepCount, onStateChange, removeDie, setModifier, state,
  toggleMode
} from "./state.mjs";
import { currentFormula } from "./formula.mjs";
import { rollFormula, rollPool } from "./roll.mjs";
import { getChatInput } from "./chat-input.mjs";

const KEEP_BUTTONS = [
  { type: "kh", icon: "fa-arrow-up", labelKey: "KeepHighest", tooltipKey: "TooltipKeepHighest", forKey: "TooltipKeepHighestFor" },
  { type: "kl", icon: "fa-arrow-down", labelKey: "KeepLowest", tooltipKey: "TooltipKeepLowest", forKey: "TooltipKeepLowestFor" }
];

/** Trays currently on the page. Detached trays are pruned on the next refresh. */
const trays = new Set();

/** How long to wait for the chat input to appear before giving up. */
const INJECT_TIMEOUT_MS = 15000;

/** Pending wait-for-element observers, keyed by what they inject, so a new attempt cancels the old. */
const pending = new Map();

const t = key => game.i18n.localize(`SOGROM_DICETRAY.${key}`);

function forEachTray(callback) {
  for ( const tray of trays ) {
    if ( !tray.isConnected ) { trays.delete(tray); continue; }
    callback(tray);
  }
}

/* -------------------------------------------- */
/*  Building                                    */
/* -------------------------------------------- */

function button(classes, attrs = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.classList.add("dice-tray-btn", ...classes);
  for ( const [key, value] of Object.entries(attrs) ) btn.dataset[key] = value;
  return btn;
}

function stackedPair(...buttons) {
  const pair = document.createElement("div");
  pair.classList.add("dice-tray-stacked-pair");
  pair.append(...buttons);
  return pair;
}

function createDieButton(faces) {
  const btn = button(["dice-tray-die-btn"], { action: "die", faces });
  btn.title = game.i18n.format("SOGROM_DICETRAY.TooltipAddDie", { die: `D${faces}` });
  const img = document.createElement("img");
  img.src = `modules/${MODULE_ID}/assets/icons/d${faces}-grey.svg`;
  img.alt = `D${faces}`;
  img.classList.add("dice-tray-die-icon");
  img.addEventListener("error", () => {
    const fallback = document.createElement("span");
    fallback.classList.add("dice-tray-die-fallback");
    fallback.textContent = `D${faces}`;
    img.replaceWith(fallback);
  }, { once: true });
  btn.append(img);
  return btn;
}

function createDiceTray() {
  const tray = document.createElement("div");
  tray.classList.add("sogrom-dice-tray");
  const theme = game.settings.get(MODULE_ID, "theme");
  if ( theme ) tray.classList.add(theme);

  const diceRow = document.createElement("div");
  diceRow.classList.add("dice-tray-dice-row");
  diceRow.append(...DICE_TYPES.map(createDieButton));

  const plus = button(["dice-tray-modifier-btn"], { action: "modifier", delta: "1" });
  plus.title = t("TooltipModifierPlus");
  plus.innerHTML = '<i class="fas fa-plus"></i>';
  const minus = button(["dice-tray-modifier-btn"], { action: "modifier", delta: "-1" });
  minus.title = t("TooltipModifierMinus");
  minus.innerHTML = '<i class="fas fa-minus"></i>';

  const modInput = document.createElement("input");
  modInput.type = "text";
  modInput.inputMode = "numeric";
  modInput.autocomplete = "off";
  modInput.classList.add("dice-tray-modifier-input");
  modInput.title = t("TooltipModifierInput");
  modInput.setAttribute("aria-label", t("TooltipModifierInput"));

  const modifierGroup = document.createElement("div");
  modifierGroup.classList.add("dice-tray-modifier-group");
  modifierGroup.append(modInput, stackedPair(plus, minus));
  // Scrolling over the modifier changes it. Not passive, so the chat log doesn't scroll as well;
  // attached to this group only, so scrolling anywhere else stays passive.
  modifierGroup.addEventListener("wheel", onModifierWheel, { passive: false });

  const keepButtons = KEEP_BUTTONS.map(cfg => {
    const btn = button(["dice-tray-keep-btn"], { action: "keep", keep: cfg.type });
    btn.innerHTML = `<i class="fas ${cfg.icon}"></i> <span class="dice-tray-label"></span>`;
    return btn;
  });

  const modeButtons = Object.entries(MODE_CONFIG).map(([mode, cfg]) => {
    const btn = button(["dice-tray-mode-btn"], { action: "mode", mode });
    btn.title = t(cfg.tooltipKey);
    btn.innerHTML = `<i class="fas ${cfg.icon}"></i> ${t(cfg.labelKey)}`;
    return btn;
  });

  const roll = button(["dice-tray-controls-roll-btn"], { action: "roll" });
  roll.title = t("ButtonRoll");
  roll.textContent = t("ButtonRoll");

  const controlsRow = document.createElement("div");
  controlsRow.classList.add("dice-tray-controls-row");
  controlsRow.append(modifierGroup, stackedPair(...keepButtons), stackedPair(...modeButtons), roll);

  const titleBar = document.createElement("div");
  titleBar.classList.add("dice-tray-title");
  const version = game.modules.get(MODULE_ID)?.version ?? "";
  titleBar.innerHTML = `<i class="fas fa-dice-d20"></i> ${t("Title")} <span class="dice-tray-version">v${version}</span>`;

  tray.append(diceRow, controlsRow, titleBar);

  // One delegated listener per event type for the whole tray, rather than one per button.
  tray.addEventListener("click", onTrayClick);
  tray.addEventListener("contextmenu", onTrayContextMenu);
  tray.addEventListener("input", onTrayInput);
  tray.addEventListener("change", onTrayChange);
  tray.addEventListener("keydown", onTrayKeyDown);

  trays.add(tray);
  refreshTray(tray);
  return tray;
}

/* -------------------------------------------- */
/*  Events                                      */
/* -------------------------------------------- */

function onTrayClick(event) {
  const btn = event.target.closest("button[data-action]");
  if ( !btn ) return;
  switch ( btn.dataset.action ) {
    case "die": {
      const faces = Number(btn.dataset.faces);
      if ( !addDie(faces) ) warnMaxDice(faces);
      break;
    }
    case "modifier": return adjustModifier(Number(btn.dataset.delta));
    case "keep": return adjustKeep(btn.dataset.keep, 1);
    case "mode": return toggleMode(btn.dataset.mode);
    case "roll": return rollPool();
  }
}

function onTrayContextMenu(event) {
  const btn = event.target.closest("button[data-action]");
  if ( !btn ) return;
  switch ( btn.dataset.action ) {
    case "die": {
      event.preventDefault();
      const faces = Number(btn.dataset.faces);
      if ( game.settings.get(MODULE_ID, "rightClick") === "roll" ) return rollFormula(`1d${faces}`, { flavor: t("FlavorBase") });
      return removeDie(faces);
    }
    case "keep":
      event.preventDefault();
      return adjustKeep(btn.dataset.keep, -1);
  }
}

function onModifierWheel(event) {
  if ( !event.deltaY ) return;
  event.preventDefault();
  adjustModifier(event.deltaY < 0 ? 1 : -1);
}

/** Parse what was typed into the modifier field: "+3", "-2", "4". */
function parseModifier(text) {
  const value = Number(String(text).replace(/\s+/g, ""));
  return Number.isFinite(value) ? value : null;
}

function onTrayInput(event) {
  if ( !event.target.matches(".dice-tray-modifier-input") ) return;
  // Apply as the user types, but leave the field's text alone until they finish ("-" on its own
  // is a valid step towards "-2").
  const value = parseModifier(event.target.value);
  if ( value !== null ) setModifier(value);
}

function onTrayChange(event) {
  if ( !event.target.matches(".dice-tray-modifier-input") ) return;
  setModifier(parseModifier(event.target.value) ?? 0);
  event.target.value = formatModifier(state.modifier);
}

function onTrayKeyDown(event) {
  if ( !event.target.matches(".dice-tray-modifier-input") ) return;
  switch ( event.key ) {
    case "ArrowUp":
      event.preventDefault();
      return adjustModifier(1);
    case "ArrowDown":
      event.preventDefault();
      return adjustModifier(-1);
    case "Enter":
      event.preventDefault();
      setModifier(parseModifier(event.target.value) ?? 0);
      return rollPool();
  }
}

const formatModifier = value => ((value > 0) ? `+${value}` : String(value));

function warnMaxDice(faces) {
  ui.notifications.warn(game.i18n.format("SOGROM_DICETRAY.MaxDiceReached", {
    max: MAX_DICE_PER_TYPE, die: `D${faces}`
  }));
}

/* -------------------------------------------- */
/*  Rendering                                   */
/* -------------------------------------------- */

function setBadge(btn, count, className = "dice-tray-badge") {
  let badge = btn.querySelector(`.${className}`);
  if ( count > 0 ) {
    if ( !badge ) {
      badge = document.createElement("span");
      badge.classList.add(className);
      btn.append(badge);
    }
    badge.textContent = count;
  } else badge?.remove();
}

/** Bring one tray's buttons in line with the shared state. Only touches what differs. */
function refreshTray(tray) {
  const groups = getDiceGroups();
  for ( const btn of tray.querySelectorAll(".dice-tray-die-btn") ) {
    const faces = Number(btn.dataset.faces);
    const count = groups[faces] || 0;
    btn.classList.toggle("active", count > 0);
    setBadge(btn, count);
    const mod = (count > 0) ? state.keep[faces] : null;
    let indicator = btn.querySelector(".dice-tray-keep-indicator");
    if ( mod ) {
      if ( !indicator ) {
        indicator = document.createElement("span");
        indicator.classList.add("dice-tray-keep-indicator");
        btn.append(indicator);
      }
      indicator.textContent = mod.type.toUpperCase();
      indicator.dataset.type = mod.type;
    } else indicator?.remove();
  }

  for ( const btn of tray.querySelectorAll(".dice-tray-mode-btn") ) {
    btn.classList.toggle("active", btn.dataset.mode === state.mode);
  }

  const modInput = tray.querySelector(".dice-tray-modifier-input");
  if ( modInput ) {
    // Don't rewrite the field under the user's cursor while what they're typing already says the
    // same thing, or is half-typed ("-" on its way to "-2"). Anything else, such as the pool being
    // cleared by a roll, is shown even while the field has focus.
    const text = formatModifier(state.modifier);
    const typed = parseModifier(modInput.value);
    const typing = (document.activeElement === modInput) && ((typed === null) || (typed === state.modifier));
    if ( !typing && (modInput.value !== text) ) modInput.value = text;
    modInput.classList.toggle("active", state.modifier !== 0);
  }

  for ( const btn of tray.querySelectorAll(".dice-tray-keep-btn") ) {
    const cfg = KEEP_BUTTONS.find(k => k.type === btn.dataset.keep);
    const count = getKeepCount(cfg.type);
    const die = `D${state.lastDie}`;
    btn.classList.toggle("active", count > 0);
    btn.querySelector(".dice-tray-label").textContent = (count > 0) ? `${t(cfg.labelKey)} ${die}` : t(cfg.labelKey);
    btn.title = (count > 0) ? game.i18n.format(`SOGROM_DICETRAY.${cfg.forKey}`, { die }) : t(cfg.tooltipKey);
    setBadge(btn, count);
  }
}

/** Mirror the pool into the chat bar as a /r command, so it can be edited before rolling. */
function updateChatInput() {
  const chat = getChatInput();
  if ( !chat ) return;
  const formula = currentFormula();
  const value = formula ? `/r ${formula}` : "";
  if ( chat.value !== value ) chat.value = value;
}

function refreshAll() {
  forEachTray(refreshTray);
  updateChatInput();
}

onStateChange(refreshAll);

/* -------------------------------------------- */
/*  Injection                                   */
/* -------------------------------------------- */

/**
 * Run `attempt` now, and if it can't find what it needs yet, again whenever `root` changes,
 * for up to INJECT_TIMEOUT_MS. Starting a new wait for the same `key` cancels the previous one,
 * so repeated renders never stack observers.
 */
function whenReady(key, root, attempt, onTimeout) {
  pending.get(key)?.();
  pending.delete(key);
  if ( attempt() ) return;
  const observer = new MutationObserver(() => {
    if ( attempt() ) cancel();
  });
  const timer = setTimeout(() => {
    cancel();
    onTimeout?.();
  }, INJECT_TIMEOUT_MS);
  function cancel() {
    observer.disconnect();
    clearTimeout(timer);
    if ( pending.get(key) === cancel ) pending.delete(key);
  }
  observer.observe(root, { childList: true, subtree: true });
  pending.set(key, cancel);
}

export function injectDiceTray(root) {
  whenReady("tray", root, () => {
    const chatMessage = root.querySelector("#chat-message") ?? document.getElementById("chat-message");
    if ( !chatMessage ) return false;
    // Replace any existing tray rather than stacking a second one beside it.
    chatMessage.parentElement?.querySelector(".sogrom-dice-tray")?.remove();
    const tray = createDiceTray();
    if ( !game.settings.get(MODULE_ID, "showDiceTray") ) tray.classList.add("dice-tray-hidden");
    tray.style.flex = "0 0";
    tray.style.pointerEvents = "all";
    tray.style.order = "999";
    chatMessage.after(tray);
    return true;
  }, () => {
    if ( !root.querySelector(".sogrom-dice-tray") ) {
      console.warn(`${MODULE_ID} | Dice tray injection timed out — #chat-message not found`);
    }
  });
}

export function injectToggleButton(root) {
  if ( document.querySelector(".sogrom-dice-tray-toggle") ) return;
  whenReady("toggle", root, () => {
    const modes = root.querySelector("#message-modes") ?? document.getElementById("message-modes");
    const last = modes?.querySelector("button:last-of-type");
    if ( !last ) return false;

    const visible = game.settings.get(MODULE_ID, "showDiceTray");
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.classList.add("sogrom-dice-tray-toggle");
    const theme = game.settings.get(MODULE_ID, "theme");
    if ( theme ) toggle.classList.add(theme);
    toggle.dataset.action = "toggleDiceTray";
    toggle.dataset.tooltip = t("ToggleTray");
    toggle.setAttribute("aria-label", t("ToggleTray"));
    toggle.innerHTML = '<i class="fas fa-dice-d20"></i>';
    toggle.classList.toggle("toggled-off", !visible);
    toggle.classList.toggle("tray-visible", visible);
    toggle.style.pointerEvents = "all";
    toggle.addEventListener("click", onToggleClick);
    last.after(toggle);
    return true;
  });
}

async function onToggleClick(event) {
  event.preventDefault();
  event.stopPropagation();
  const visible = !game.settings.get(MODULE_ID, "showDiceTray");
  await game.settings.set(MODULE_ID, "showDiceTray", visible);

  // If the tray was removed while hidden, put a fresh one back.
  if ( visible && !document.querySelector(".sogrom-dice-tray") && ui.chat?.element ) injectDiceTray(ui.chat.element);

  forEachTray(tray => tray.classList.toggle("dice-tray-hidden", !visible));
  for ( const btn of document.querySelectorAll(".sogrom-dice-tray-toggle") ) {
    btn.classList.toggle("toggled-off", !visible);
    btn.classList.toggle("tray-visible", visible);
  }
}

/** Remove every tray and toggle from the page, e.g. before the sidebar re-renders. */
export function removeAll() {
  for ( const cancel of pending.values() ) cancel();
  pending.clear();
  for ( const el of document.querySelectorAll(".sogrom-dice-tray, .sogrom-dice-tray-toggle") ) el.remove();
  trays.clear();
}

export function applyTheme(theme) {
  for ( const el of document.querySelectorAll(".sogrom-dice-tray, .sogrom-dice-tray-toggle") ) {
    el.classList.remove(...THEME_CLASSES);
    if ( theme ) el.classList.add(theme);
  }
}
