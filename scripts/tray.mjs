import { ICON_PATH, MAX_DICE_PER_TYPE, MODULE_ID, THEME_CLASSES } from "./constants.mjs";
import { buttonImage, buttonText, dieName, isCommand, parseDieTerm } from "./dice.mjs";
import { getModes, getRows } from "./layout.mjs";
import {
  addDice, adjustKeep, adjustModifier, getDiceGroups, getKeepCount, onStateChange, removeDice, setModifier, state,
  toggleMode
} from "./state.mjs";
import { currentFormula, formulaForDie } from "./formula.mjs";
import { DRAG_TYPE, rollFormula, rollPool } from "./roll.mjs";
import { DiceStatsWindow } from "./apps/stats-window.mjs";
import { getChatInput } from "./chat-input.mjs";
import { createOddsLine, scheduleOdds, setTarget } from "./odds-display.mjs";

const KEEP_BUTTONS = [
  { type: "kh", icon: "fa-arrow-up", labelKey: "KeepHighest", tooltipKey: "TooltipKeepHighest", forKey: "TooltipKeepHighestFor" },
  { type: "kl", icon: "fa-arrow-down", labelKey: "KeepLowest", tooltipKey: "TooltipKeepLowest", forKey: "TooltipKeepLowestFor" }
];

/** Trays currently on the page. Detached trays are pruned on the next refresh. */
const trays = new Set();

/** How long a button with a drawer is held before the drawer opens. */
const DRAWER_HOLD_MS = 300;

/**
 * Per-tray press-and-hold state: the pending hold timer, and the button whose click should be
 * ignored because the press opened its drawer. Weakly held, so it goes with the tray.
 * @type {WeakMap<HTMLElement, {timer: number|null, opened: HTMLElement|null}>}
 */
const holds = new WeakMap();

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

/**
 * A button from the layout. Dice buttons carry the die's pool key and how many one click adds;
 * command buttons carry the chat command they run.
 * @param {import("./dice.mjs").DiceButton} def
 */
function createDieButton(def) {
  let btn;
  if ( isCommand(def.formula) ) {
    btn = button(["dice-tray-die-btn", "dice-tray-command-btn"], { action: "command", formula: def.formula });
    btn.title = game.i18n.localize(def.tooltip || def.label || def.formula);
  } else {
    const { key, count } = parseDieTerm(def.formula);
    btn = button(["dice-tray-die-btn"], { action: "die", key, count });
    btn.draggable = true;
    // Tooltips and labels from a system map are lang keys; a GM's own are plain text, which
    // localize() hands back unchanged.
    btn.title = def.tooltip ? game.i18n.localize(def.tooltip)
      : game.i18n.format("SOGROM_DICETRAY.TooltipAddDie", { die: def.label ? game.i18n.localize(def.label) : dieName(key) });
  }
  btn.append(buttonFace(def));
  if ( !def.drawer?.length ) {
    btn.setAttribute("aria-label", btn.title);
    return [btn];
  }

  // A drawer: more buttons that open above this one when it is held. It is a popover, so it shows
  // in the top layer where no sidebar or window can clip it, and it stays inside the tray, so its
  // buttons use the tray's own listeners. It is a manual popover: an automatic one would close as
  // soon as the press that opened it is released, since that release lands outside it.
  const drawer = document.createElement("div");
  drawer.classList.add("dice-tray-drawer");
  drawer.popover = "manual";
  drawer.setAttribute("role", "group");
  drawer.append(...def.drawer.flatMap(createDieButton));
  btn.classList.add("has-drawer");
  btn.title += ` ${t("DrawerHint")}`;
  btn.setAttribute("aria-label", btn.title);
  btn.setAttribute("aria-haspopup", "true");
  btn.setAttribute("aria-expanded", "false");
  drawer.addEventListener("toggle", event => btn.setAttribute("aria-expanded", String(event.newState === "open")));
  return [btn, drawer];
}

/** Open the drawer that belongs to a button, just above it (below it if there's no room). */
function openDrawer(btn) {
  const drawer = btn.nextElementSibling;
  if ( !drawer?.classList.contains("dice-tray-drawer") ) return;
  if ( !drawer.matches(":popover-open") ) {
    for ( const open of document.querySelectorAll(".dice-tray-drawer:popover-open") ) open.hidePopover();
    drawer.showPopover();
    dismissOnOutsideInput(drawer, btn);
  }
  const anchor = btn.getBoundingClientRect();
  const { width, height } = drawer.getBoundingClientRect();
  const margin = 4;
  const left = Math.min(Math.max(anchor.left + (anchor.width / 2) - (width / 2), margin), window.innerWidth - width - margin);
  const above = anchor.top - height - margin;
  drawer.style.left = `${left}px`;
  drawer.style.top = `${(above >= margin) ? above : anchor.bottom + margin}px`;
}

/**
 * Close an open drawer when the player presses anywhere outside it (other than its own button,
 * which stays usable) or presses Escape. The two document listeners exist only while the drawer is
 * open, and are removed together as soon as it closes, however it closes.
 */
function dismissOnOutsideInput(drawer, owner) {
  const controller = new AbortController();
  const { signal } = controller;
  const close = () => {
    if ( drawer.isConnected && drawer.matches(":popover-open") ) drawer.hidePopover();
    controller.abort();
  };
  document.addEventListener("pointerdown", event => {
    if ( !drawer.isConnected ) return close();
    if ( !drawer.contains(event.target) && !owner.contains(event.target) ) close();
  }, { capture: true, signal });
  document.addEventListener("keydown", event => {
    if ( (event.key === "Escape") || !drawer.isConnected ) close();
  }, { capture: true, signal });
  drawer.addEventListener("toggle", event => {
    if ( event.newState === "closed" ) controller.abort();
  }, { signal });
}

function holdState(tray) {
  let hold = holds.get(tray);
  if ( !hold ) holds.set(tray, hold = { timer: null, opened: null });
  return hold;
}

function cancelHold(tray) {
  const hold = holds.get(tray);
  if ( hold?.timer ) {
    clearTimeout(hold.timer);
    hold.timer = null;
  }
}

function onTrayPointerDown(event) {
  const btn = event.target.closest?.(".has-drawer");
  if ( !btn || (event.button !== 0) ) return;
  const tray = event.currentTarget;
  const hold = holdState(tray);
  cancelHold(tray);
  hold.timer = setTimeout(() => {
    hold.timer = null;
    hold.opened = btn;
    openDrawer(btn);
  }, DRAWER_HOLD_MS);
}

function onTrayPointerEnd(event) {
  // pointerout bubbles for every child crossed; only leaving the held button itself counts.
  if ( (event.type === "pointerout") && event.target.closest?.(".has-drawer")?.contains(event.relatedTarget) ) return;
  cancelHold(event.currentTarget);
}

/** Whether this click is the end of the press that opened a drawer, and should do nothing else. */
function consumeHoldClick(tray, btn) {
  const hold = holds.get(tray);
  if ( !hold?.opened || (hold.opened !== btn) ) return false;
  hold.opened = null;
  return true;
}

/** What a button shows: its image (tinted when it has a colour), or else its text. */
function buttonFace(def) {
  const src = buttonImage(def, ICON_PATH);
  const text = () => {
    const span = document.createElement("span");
    span.classList.add("dice-tray-die-fallback");
    span.textContent = game.i18n.localize(buttonText(def));
    if ( def.color ) span.style.color = def.color;
    return span;
  };
  if ( !src ) return text();
  if ( def.color ) {
    // Tint the image's shape with the colour: the image becomes a mask over a solid fill.
    const tinted = document.createElement("span");
    tinted.classList.add("dice-tray-die-icon", "dice-tray-die-tinted");
    // Set inline, so a relative path resolves against the page like an <img> src would; inside a
    // stylesheet it would resolve against the stylesheet's folder instead.
    const mask = `url("${encodeURI(src)}")`;
    tinted.style.maskImage = mask;
    tinted.style.webkitMaskImage = mask;
    tinted.style.backgroundColor = def.color;
    return tinted;
  }
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  img.classList.add("dice-tray-die-icon");
  img.draggable = false;
  img.addEventListener("error", () => img.replaceWith(text()), { once: true });
  return img;
}

/** Sidebar trays only — not the one in the pop-out window. */
const SIDEBAR_TRAY = ".sogrom-dice-tray:not(.dice-tray-popout)";

/**
 * Build a tray. It registers itself for state updates and is dropped again once it leaves the page.
 * @param {object} [options]
 * @param {boolean} [options.popout]  For the pop-out window: adds a formula preview, since the chat
 *                                    bar that normally shows the formula may not be on screen.
 * @returns {HTMLElement}
 */
export function createDiceTray({ popout = false } = {}) {
  const tray = document.createElement("div");
  tray.classList.add("sogrom-dice-tray");
  if ( popout ) tray.classList.add("dice-tray-popout");
  const theme = game.settings.get(MODULE_ID, "theme");
  if ( theme ) tray.classList.add(theme);

  const rows = getRows().map(dice => {
    const row = document.createElement("div");
    row.classList.add("dice-tray-dice-row");
    row.style.gridTemplateColumns = `repeat(${dice.length}, 1fr)`;
    row.append(...dice.flatMap(createDieButton));
    return row;
  });

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

  const modeButtons = Object.entries(getModes()).map(([mode, cfg]) => {
    const btn = button(["dice-tray-mode-btn"], { action: "mode", mode });
    btn.title = game.i18n.localize(cfg.tooltip);
    btn.innerHTML = `<i class="fas ${cfg.icon}"></i> ${game.i18n.localize(cfg.label)}`;
    return btn;
  });

  const roll = button(["dice-tray-controls-roll-btn"], { action: "roll" });
  roll.title = t("ButtonRoll");
  roll.textContent = t("ButtonRoll");

  const controlsRow = document.createElement("div");
  controlsRow.classList.add("dice-tray-controls-row");
  const columns = [modifierGroup, stackedPair(...keepButtons)];
  // Systems without advantage-style modes (Fate, DCC, …) get no mode column at all.
  if ( modeButtons.length ) columns.push(stackedPair(...modeButtons));
  columns.push(roll);
  controlsRow.append(...columns);
  controlsRow.style.gridTemplateColumns = `repeat(${columns.length}, 1fr)`;

  const titleBar = document.createElement("div");
  titleBar.classList.add("dice-tray-title");
  const version = game.modules.get(MODULE_ID)?.version ?? "";
  titleBar.innerHTML = `<i class="fas fa-dice-d20"></i> ${t("Title")} <span class="dice-tray-version">v${version}</span>`;
  const statsButton = document.createElement("button");
  statsButton.type = "button";
  statsButton.classList.add("dice-tray-stats-btn");
  statsButton.dataset.action = "stats";
  statsButton.dataset.tooltip = t("StatsTitle");
  statsButton.setAttribute("aria-label", t("StatsTitle"));
  statsButton.innerHTML = '<i class="fas fa-chart-column"></i>';
  titleBar.append(statsButton);

  if ( popout ) {
    const preview = document.createElement("div");
    preview.classList.add("dice-tray-formula");
    preview.setAttribute("aria-live", "polite");
    tray.append(preview);
  }
  tray.append(...rows, controlsRow, createOddsLine(), titleBar);

  // One delegated listener per event type for the whole tray, rather than one per button.
  tray.addEventListener("click", onTrayClick);
  tray.addEventListener("contextmenu", onTrayContextMenu);
  tray.addEventListener("input", onTrayInput);
  tray.addEventListener("change", onTrayChange);
  tray.addEventListener("keydown", onTrayKeyDown);
  tray.addEventListener("dragstart", onTrayDragStart);
  tray.addEventListener("pointerdown", onTrayPointerDown);
  for ( const type of ["pointerup", "pointercancel", "pointerout", "dragstart"] ) {
    tray.addEventListener(type, onTrayPointerEnd);
  }

  trays.add(tray);
  refreshTray(tray);
  scheduleOdds();
  return tray;
}

/* -------------------------------------------- */
/*  Events                                      */
/* -------------------------------------------- */

function onTrayClick(event) {
  const btn = event.target.closest("button[data-action]");
  if ( !btn || consumeHoldClick(event.currentTarget, btn) ) return;
  switch ( btn.dataset.action ) {
    case "die": {
      const key = btn.dataset.key;
      if ( !addDice(key, Number(btn.dataset.count)) ) warnMaxDice(key);
      break;
    }
    case "command": return runCommand(btn.dataset.formula);
    case "modifier": return adjustModifier(Number(btn.dataset.delta));
    case "keep": return adjustKeep(btn.dataset.keep, 1);
    case "mode": return toggleMode(btn.dataset.mode);
    case "roll": return rollPool();
    case "stats": return DiceStatsWindow.open();
  }
}

function onTrayContextMenu(event) {
  const btn = event.target.closest("button[data-action]");
  if ( !btn ) return;
  // On touch screens a long press also fires contextmenu; if that press opened a drawer, that's all.
  if ( holds.get(event.currentTarget)?.opened === btn ) {
    event.preventDefault();
    return;
  }
  switch ( btn.dataset.action ) {
    case "die": {
      event.preventDefault();
      const { key, count } = btn.dataset;
      if ( game.settings.get(MODULE_ID, "rightClick") === "roll" ) {
        return rollFormula(`${count}${key}`, { flavor: t("FlavorBase"), source: "rightClick" });
      }
      return removeDice(key, Number(count));
    }
    case "keep":
      event.preventDefault();
      return adjustKeep(btn.dataset.keep, -1);
  }
}

function onTrayDragStart(event) {
  const btn = event.target.closest?.('.dice-tray-die-btn[data-action="die"]');
  if ( !btn ) return;
  const { key, count } = btn.dataset;
  const { formula, fromPool } = formulaForDie(key, Number(count));
  event.dataTransfer.setData("text/plain", JSON.stringify({ type: DRAG_TYPE, formula, fromPool, key }));
  event.dataTransfer.effectAllowed = "copy";
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
  if ( event.target.matches(".dice-tray-target") ) return setTarget(event.target.value);
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
  // The keyboard way into a drawer: arrow up (or down) on its button.
  if ( event.target.matches?.(".has-drawer") && ["ArrowUp", "ArrowDown"].includes(event.key) ) {
    event.preventDefault();
    openDrawer(event.target);
    event.target.nextElementSibling?.querySelector("button")?.focus();
    return;
  }
  if ( event.target.matches(".dice-tray-target") && (event.key === "Enter") ) {
    event.preventDefault();
    return rollPool();
  }
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

function warnMaxDice(key) {
  ui.notifications.warn(game.i18n.format("SOGROM_DICETRAY.MaxDiceReached", {
    max: MAX_DICE_PER_TYPE, die: dieName(key)
  }));
}

/** Run a command button's chat command ("/dr", …) as if it had been typed into the chat bar. */
function runCommand(command) {
  Promise.resolve(ui.chat.processMessage(command)).catch(err => {
    console.error(`${MODULE_ID} | Command error:`, err);
    ui.notifications.error(game.i18n.format("SOGROM_DICETRAY.CommandError", { command }));
  });
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
  const preview = tray.querySelector(".dice-tray-formula");
  if ( preview ) {
    const formula = currentFormula();
    preview.textContent = formula || t("FormulaEmpty");
    preview.classList.toggle("empty", !formula);
  }

  const groups = getDiceGroups();
  for ( const btn of tray.querySelectorAll('.dice-tray-die-btn[data-action="die"]') ) {
    const key = btn.dataset.key;
    const count = groups[key] || 0;
    btn.classList.toggle("active", count > 0);
    setBadge(btn, count);
    const mod = (count > 0) ? state.keep[key] : null;
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
    const die = state.lastDie ? dieName(state.lastDie) : "";
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
  scheduleOdds();
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
    chatMessage.parentElement?.querySelector(SIDEBAR_TRAY)?.remove();
    const tray = createDiceTray();
    if ( !game.settings.get(MODULE_ID, "showDiceTray") ) tray.classList.add("dice-tray-hidden");
    tray.style.flex = "0 0";
    tray.style.pointerEvents = "all";
    tray.style.order = "999";
    chatMessage.after(tray);
    return true;
  }, () => {
    if ( !root.querySelector(SIDEBAR_TRAY) ) {
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

function onToggleClick(event) {
  event.preventDefault();
  event.stopPropagation();
  toggleTrayVisible();
}

/** Show or hide the tray (flips it when `visible` is omitted), remembering the choice for this client. */
export async function toggleTrayVisible(visible = !game.settings.get(MODULE_ID, "showDiceTray")) {
  await game.settings.set(MODULE_ID, "showDiceTray", visible);

  // If the tray was removed while hidden, put a fresh one back.
  if ( visible && !document.querySelector(SIDEBAR_TRAY) && ui.chat?.element ) injectDiceTray(ui.chat.element);

  for ( const tray of document.querySelectorAll(SIDEBAR_TRAY) ) tray.classList.toggle("dice-tray-hidden", !visible);
  for ( const btn of document.querySelectorAll(".sogrom-dice-tray-toggle") ) {
    btn.classList.toggle("toggled-off", !visible);
    btn.classList.toggle("tray-visible", visible);
  }
}

/** Rebuild every tray from scratch, e.g. after a setting changed which buttons it shows. */
export function rebuildTrays() {
  removeAll();
  const element = ui.chat?.element;
  if ( !element ) return;
  injectDiceTray(element);
  injectToggleButton(element);
}

/** Remove every tray and toggle from the page, e.g. before the sidebar re-renders. */
export function removeAll() {
  for ( const cancel of pending.values() ) cancel();
  pending.clear();
  // The pop-out window's tray belongs to the window and stays.
  for ( const el of document.querySelectorAll(`${SIDEBAR_TRAY}, .sogrom-dice-tray-toggle`) ) el.remove();
}

export function applyTheme(theme) {
  for ( const el of document.querySelectorAll(".sogrom-dice-tray, .sogrom-dice-tray-toggle") ) {
    el.classList.remove(...THEME_CLASSES);
    if ( theme ) el.classList.add(theme);
  }
}
