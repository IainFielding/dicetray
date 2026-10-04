import { MODULE_ID } from "./constants.mjs";
import { normaliseRows } from "./dice.mjs";
import { activeSystemId, systemModes, systemRows } from "./systems.mjs";

/** The normalised layout and modes, cached until something they depend on changes. */
let cachedRows = null;
let cachedModes = null;

/** The layout a world starts with, before the GM changes anything: its game system's dice. */
export function defaultRows() {
  return systemRows(activeSystemId());
}

/**
 * The rows of dice buttons every tray shows: the GM's saved layout, or the default when none is
 * saved (or what is saved has nothing usable in it).
 * @returns {import("./dice.mjs").DiceButton[][]}
 */
export function getRows() {
  if ( cachedRows ) return cachedRows;
  const saved = normaliseRows(game.settings.get(MODULE_ID, "diceRows"));
  cachedRows = saved.length ? saved : normaliseRows(defaultRows());
  return cachedRows;
}

/**
 * The mode buttons (advantage and the like) for the world's game system.
 * @returns {Record<string, import("./systems.mjs").RollMode>}
 */
export function getModes() {
  return (cachedModes ??= systemModes(activeSystemId()));
}

/** Forget the cached layout and modes; the next read works them out again. */
export function invalidateLayout() {
  cachedRows = null;
  cachedModes = null;
}
