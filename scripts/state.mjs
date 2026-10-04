import { MAX_DICE_PER_TYPE, MAX_MODIFIER } from "./constants.mjs";

/**
 * The dice pool being built. There is one pool per client, shared by every tray on the page
 * (sidebar and popped-out chat), so each tray just re-renders from this object.
 */
export const state = {
  /** Faces of every die added, in the order they were clicked. */
  pool: [],
  /** "normal", or a key of MODE_CONFIG. */
  mode: "normal",
  /** The die type keep-highest/lowest applies to: the last die added. */
  lastDie: null,
  /** Flat modifier added to the formula. */
  modifier: 0,
  /** Keep modifiers per die type: { [faces]: { type: "kh"|"kl", count } } */
  keep: {}
};

const listeners = new Set();

/** Register a callback that runs after every state change. */
export function onStateChange(callback) {
  listeners.add(callback);
}

function changed() {
  for ( const callback of listeners ) callback(state);
}

/** Count of each die type in the pool: { [faces]: count } */
export function getDiceGroups(pool = state.pool) {
  const groups = {};
  for ( const faces of pool ) groups[faces] = (groups[faces] || 0) + 1;
  return groups;
}

/**
 * Add one die to the pool.
 * @returns {boolean} false if the per-type limit was reached and nothing was added.
 */
export function addDie(faces) {
  const count = state.pool.filter(f => f === faces).length;
  if ( count >= MAX_DICE_PER_TYPE ) return false;
  state.pool.push(faces);
  state.lastDie = faces;
  changed();
  return true;
}

export function removeDie(faces) {
  const idx = state.pool.lastIndexOf(faces);
  if ( idx === -1 ) return;
  state.pool.splice(idx, 1);
  changed();
}

/** Keep count of the given type ("kh"/"kl") for the last die added. */
export function getKeepCount(type) {
  if ( !state.lastDie ) return 0;
  const mod = state.keep[state.lastDie];
  if ( !mod || (mod.type !== type) ) return 0;
  return mod.count;
}

export function adjustKeep(type, delta) {
  if ( !state.pool.length || !state.lastDie ) return;
  state.mode = "normal";
  const existing = state.keep[state.lastDie];
  // Switching from kh to kl or vice versa on this die type starts the count again.
  const current = (existing?.type === type) ? existing.count : 0;
  const count = Math.max(0, current + delta);
  if ( count > 0 ) state.keep[state.lastDie] = { type, count };
  else delete state.keep[state.lastDie];
  changed();
}

export function adjustModifier(delta) {
  setModifier(state.modifier + delta);
}

export function setModifier(value) {
  state.modifier = Math.max(-MAX_MODIFIER, Math.min(MAX_MODIFIER, Math.trunc(value) || 0));
  changed();
}

/** Toggle a roll mode: selecting the active mode returns to a normal roll. */
export function toggleMode(mode) {
  state.mode = (state.mode === mode) ? "normal" : mode;
  changed();
}

export function clearPool() {
  state.pool = [];
  state.mode = "normal";
  state.modifier = 0;
  state.keep = {};
  state.lastDie = null;
  changed();
}
