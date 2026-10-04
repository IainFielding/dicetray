import { MAX_DICE_PER_TYPE, MAX_MODIFIER } from "./constants.mjs";

/**
 * The dice pool being built. There is one pool per client, shared by every tray on the page
 * (sidebar and popped-out chat), so each tray just re-renders from this object.
 */
export const state = {
  /** Key of every die added ("d6", "dF", "d6x"), in the order they were added. */
  pool: [],
  /** "normal", or the id of one of the system's modes (see systems.mjs). */
  mode: "normal",
  /** The key of the die type keep-highest/lowest applies to: the last die added. */
  lastDie: null,
  /** Flat modifier added to the formula. */
  modifier: 0,
  /** Keep modifiers per die type: { [key]: { type: "kh"|"kl", count } } */
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

/** Count of each die type in the pool, in the order each type was first added: { [key]: count } */
export function getDiceGroups(pool = state.pool) {
  const groups = {};
  for ( const key of pool ) groups[key] = (groups[key] || 0) + 1;
  return groups;
}

/** How many of one die type are in the pool. */
export function countOf(key) {
  let count = 0;
  for ( const k of state.pool ) if ( k === key ) count++;
  return count;
}

/**
 * Add dice of one type to the pool.
 * @param {string} key      The die type, e.g. "d6".
 * @param {number} [count]  How many to add.
 * @returns {boolean} false if that would pass the per-type limit, in which case nothing is added.
 */
export function addDice(key, count = 1) {
  if ( countOf(key) + count > MAX_DICE_PER_TYPE ) return false;
  for ( let i = 0; i < count; i++ ) state.pool.push(key);
  state.lastDie = key;
  changed();
  return true;
}

/** Take dice of one type back out of the pool, most recently added first. */
export function removeDice(key, count = 1) {
  let removed = 0;
  for ( let i = state.pool.length - 1; (i >= 0) && (removed < count); i-- ) {
    if ( state.pool[i] !== key ) continue;
    state.pool.splice(i, 1);
    removed++;
  }
  if ( !removed ) return;
  if ( !state.pool.includes(key) ) forget(key);
  changed();
}

/**
 * The last die of a type has left the pool: drop its keep modifier, and point keep-highest/lowest
 * at the most recently added die that is still there.
 */
function forget(key) {
  delete state.keep[key];
  if ( state.lastDie === key ) state.lastDie = state.pool.at(-1) ?? null;
}

/** Take every die of one type out of the pool, e.g. after that group was rolled on its own. */
export function removeAllOf(key) {
  if ( !state.pool.includes(key) ) return;
  state.pool = state.pool.filter(k => k !== key);
  forget(key);
  if ( !state.pool.length ) {
    state.mode = "normal";
    state.modifier = 0;
  }
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

/** Set the roll mode outright: "normal", or a mode id. */
export function setMode(mode) {
  state.mode = mode || "normal";
  changed();
}

/** A copy of the pool for other code to read: { dice: { d6: 2, … }, mode, modifier, keep }. */
export function snapshot() {
  return {
    dice: getDiceGroups(),
    mode: state.mode,
    modifier: state.modifier,
    keep: Object.fromEntries(Object.entries(state.keep).map(([key, mod]) => [key, { ...mod }]))
  };
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
