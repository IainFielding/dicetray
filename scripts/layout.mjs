import { MODULE_ID } from "./constants.mjs";
import { STANDARD_DICE, diceButtons, normaliseRows } from "./dice.mjs";

/** The normalised layout, cached until the setting behind it changes. */
let cached = null;

/** The layout a world starts with, before the GM changes anything. */
export function defaultRows() {
  return [diceButtons(STANDARD_DICE)];
}

/**
 * The rows of dice buttons every tray shows: the GM's saved layout, or the default when none is
 * saved (or what is saved has nothing usable in it).
 * @returns {import("./dice.mjs").DiceButton[][]}
 */
export function getRows() {
  if ( cached ) return cached;
  const saved = normaliseRows(game.settings.get(MODULE_ID, "diceRows"));
  cached = saved.length ? saved : normaliseRows(defaultRows());
  return cached;
}

/** Forget the cached layout; the next getRows() reads the settings again. */
export function invalidateRows() {
  cached = null;
}
