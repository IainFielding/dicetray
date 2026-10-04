import { MODULE_ID } from "./constants.mjs";
import { getModes } from "./layout.mjs";
import { poolDistribution, summarise } from "./odds.mjs";
import { state } from "./state.mjs";

/** Wait this long after the last change before working the odds out, so quick clicking costs nothing. */
const DELAY_MS = 120;

/** The total the player wants to reach (a DC), shared by every tray; null for none. */
let target = null;

let timer = null;

/** The last pool worked out, and its distribution, so re-showing it (or changing the DC) is free. */
let cache = { key: null, distribution: null };

const t = key => game.i18n.localize(`SOGROM_DICETRAY.${key}`);

/** The odds line: average and range, a box for a DC, and the chance of reaching it. */
export function createOddsLine() {
  const line = document.createElement("div");
  line.classList.add("dice-tray-odds");
  line.hidden = true;
  line.title = t("OddsHint");

  const summary = document.createElement("span");
  summary.classList.add("dice-tray-odds-summary");

  const label = document.createElement("label");
  label.classList.add("dice-tray-odds-target");
  const input = document.createElement("input");
  input.type = "text";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.placeholder = t("OddsTarget");
  input.classList.add("dice-tray-target");
  input.setAttribute("aria-label", t("OddsTargetHint"));
  input.value = target ?? "";
  label.append("≥", input);

  const chance = document.createElement("span");
  chance.classList.add("dice-tray-odds-chance");
  chance.setAttribute("aria-live", "polite");

  line.append(summary, label, chance);
  return line;
}

/** Set the DC from what was typed, and show its chance straight away. */
export function setTarget(text) {
  const value = Number.parseInt(String(text).trim(), 10);
  target = Number.isFinite(value) ? value : null;
  for ( const input of document.querySelectorAll(".dice-tray-target") ) {
    if ( document.activeElement !== input ) input.value = target ?? "";
  }
  updateOdds();
}

/** Work the odds out again shortly; called on every pool change. */
export function scheduleOdds() {
  if ( timer ) clearTimeout(timer);
  timer = setTimeout(updateOdds, DELAY_MS);
}

function updateOdds() {
  timer = null;
  const lines = document.querySelectorAll(".sogrom-dice-tray .dice-tray-odds");
  if ( !lines.length ) return;
  if ( !game.settings.get(MODULE_ID, "showOdds") ) {
    for ( const line of lines ) line.hidden = true;
    return;
  }

  const key = JSON.stringify([state.pool, state.mode, state.modifier, state.keep, game.system.id]);
  if ( key !== cache.key ) cache = { key, distribution: poolDistribution(state, { modes: getModes() }) };
  const { distribution } = cache;

  const odds = distribution && summarise(distribution, target);
  for ( const line of lines ) {
    line.hidden = !odds;
    if ( !odds ) continue;
    const prefix = odds.approximate ? "≈" : "";
    const max = odds.unbounded ? `${odds.min}+` : `${odds.min}–${odds.max}`;
    line.querySelector(".dice-tray-odds-summary").textContent = game.i18n.format("SOGROM_DICETRAY.OddsSummary", {
      mean: `${prefix}${odds.mean.toFixed(1)}`, range: (odds.min === odds.max) ? `${odds.min}` : max
    });
    const chance = line.querySelector(".dice-tray-odds-chance");
    chance.textContent = (odds.chance === null) ? "" : `${prefix}${formatChance(odds.chance)}`;
    chance.dataset.band = (odds.chance === null) ? "" : (odds.chance >= 0.65) ? "good" : (odds.chance >= 0.35) ? "even" : "poor";
  }
}

/** "75%", but never a misleading "0%" or "100%" for something merely unlikely or likely. */
function formatChance(p) {
  if ( (p > 0) && (p < 0.005) ) return "<1%";
  if ( (p < 1) && (p > 0.995) ) return ">99%";
  return `${Math.round(p * 100)}%`;
}
