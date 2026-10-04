/**
 * Dice button definitions: what each button in the tray adds to the pool, and how it looks.
 *
 * Pure: nothing here touches Foundry, so the parsing and normalising can be unit-tested.
 *
 * @typedef {object} DiceButton
 * @property {string} formula     What one click adds. A dice term — "d6", "4dF", "d6x", "d10r1" —
 *                                or a chat command starting with "/" that runs straight away.
 * @property {string} [label]     Text shown on the button when there is no image.
 * @property {string} [img]       Image path. Defaults to the module's icon for standard dice.
 * @property {string} [tooltip]   Hover text. Defaults to "Add a <die>".
 * @property {string} [color]     Hex colour ("#3fa7ff") the image is tinted with.
 * @property {DiceButton[]} [drawer]  Further buttons that open from this one.
 */

/** Dice the module ships an icon for. */
export const ICON_FACES = new Set([2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 30, 100]);

/** The dice every tray shows by default. */
export const STANDARD_DICE = [4, 6, 8, 10, 12, 20, 100];

/** Less common dice, for an optional second row. */
export const EXTRA_DICE = [2, 3, 5, 7, 14, 16, 24, 30];

/** Most dice one button may add per click. Foundry rejects terms over 999 dice. */
const MAX_COUNT_PER_CLICK = 99;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** A dice term: count, "d", faces (a number, %, or a system's letter such as F or p), modifiers. */
const TERM = /^(\d*)d(\d+|%|[a-z])(\S*)$/i;

/**
 * Modifiers a button's die may carry: per-die ones Foundry understands (x, xo, r, rr, min, max, cs,
 * …) with a target. Keep and drop (k, kh, kl, d, dh, dl) aren't allowed: they act on a whole group,
 * and clicks merge into one group, so "4d6kh3" clicked twice would become "8d6kh3". The tray's own
 * KH/KL buttons cover keeping.
 */
const MODIFIERS = /^(?:(?:xo?|rr?|min|max|even|odd|c[sf]|df|sf|ms)(?:[<>]=?|=)?\d*)*$/i;

/**
 * Parse a dice term as written on a button.
 * @param {string} formula  e.g. "d6", "4dF", "d6x", "2d10r1", "dp" (a system's own die)
 * @returns {{count: number, faces: number|string, modifiers: string, key: string}|null}
 *   `key` identifies the kind of die in the pool ("d6", "dF", "d6x"), so two buttons for the same
 *   die share one group. null when it isn't a single dice term.
 */
export function parseDieTerm(formula) {
  const match = String(formula ?? "").trim().match(TERM);
  if ( !match ) return null;
  const count = match[1] ? Number(match[1]) : 1;
  if ( (count < 1) || (count > MAX_COUNT_PER_CLICK) ) return null;
  let faces = match[2];
  if ( faces === "%" ) faces = 100;
  else if ( /^\d+$/.test(faces) ) faces = Number(faces);
  // Letters are a system's own dice. Fate dice are written dF by convention; the rest lower case.
  else faces = (faces.toLowerCase() === "f") ? "F" : faces.toLowerCase();
  if ( faces === 0 ) return null;
  const modifiers = match[3];
  if ( !MODIFIERS.test(modifiers) ) return null;
  return { count, faces, modifiers, key: `d${faces}${modifiers}` };
}

/** Whether a button runs a chat command rather than adding dice. */
export const isCommand = formula => String(formula ?? "").trim().startsWith("/");

/** The numeric faces of a pool key, or NaN for dice such as dF. */
export const facesOf = key => Number.parseInt(String(key).slice(1), 10);

/** How a die is named in tooltips and labels: "D20", "DF", "D6x". */
export function dieName(key) {
  const term = parseDieTerm(key);
  if ( !term ) return String(key);
  return `D${term.faces}${term.modifiers}`;
}

/**
 * Clean up one button definition, as stored in settings or supplied by a system or another
 * module. Unknown properties are dropped and invalid buttons rejected, so a hand-edited or stale
 * setting can't break the tray.
 * @param {object} data
 * @param {object} [options]
 * @param {boolean} [options.allowDrawer]  Whether this button may hold a drawer (one level deep).
 * @returns {DiceButton|null}
 */
export function normaliseButton(data, { allowDrawer = true } = {}) {
  if ( !data || (typeof data !== "object") ) return null;
  const formula = String(data.formula ?? "").trim();
  if ( !formula || (!isCommand(formula) && !parseDieTerm(formula)) ) return null;
  const button = { formula };
  for ( const key of ["label", "img", "tooltip"] ) {
    const value = (typeof data[key] === "string") ? data[key].trim() : "";
    if ( value ) button[key] = value;
  }
  // Colours end up in inline styles, so only plain hex colours are accepted.
  const color = (typeof data.color === "string") ? data.color.trim() : "";
  if ( HEX_COLOR.test(color) ) button.color = color;
  if ( allowDrawer && Array.isArray(data.drawer) ) {
    const drawer = data.drawer.map(d => normaliseButton(d, { allowDrawer: false })).filter(Boolean);
    if ( drawer.length ) button.drawer = drawer;
  }
  return button;
}

/**
 * Clean up a whole tray layout: an array of rows, each an array of buttons.
 * @returns {DiceButton[][]} Empty rows are dropped.
 */
export function normaliseRows(rows) {
  if ( !Array.isArray(rows) ) return [];
  return rows
    .map(row => (Array.isArray(row) ? row.map(b => normaliseButton(b)).filter(Boolean) : []))
    .filter(row => row.length);
}

/** Buttons for a list of standard dice faces. */
export const diceButtons = faces => faces.map(f => ({ formula: `d${f}` }));

/**
 * The image a button shows: its own, or the module's icon for a plain standard die.
 * @param {DiceButton} button
 * @param {string} iconPath  Folder of the module's die icons.
 * @returns {string|null}
 */
export function buttonImage(button, iconPath) {
  if ( button.img ) return button.img;
  const term = parseDieTerm(button.formula);
  if ( term && !term.modifiers && (term.count === 1) && ICON_FACES.has(term.faces) ) {
    return `${iconPath}/d${term.faces}-grey.svg`;
  }
  return null;
}

/**
 * An image path made safe to put inside CSS url("…"): quotes, backslashes, brackets and spaces are
 * escaped, and nothing else is touched, so an already percent-encoded path isn't encoded twice.
 */
export const cssUrl = path => String(path)
  .replace(/["'\\()\s]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`);

/** Text a button shows when it has no image: its label, or the formula itself. */
export const buttonText = button => button.label || button.formula;
