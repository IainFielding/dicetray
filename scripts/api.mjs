import { MODULE_ID } from "./constants.mjs";
import { parseDieTerm } from "./dice.mjs";
import { currentFormula } from "./formula.mjs";
import { getModes, getRows } from "./layout.mjs";
import { DiceTrayWindow } from "./popout.mjs";
import { rollFormula, rollPool } from "./roll.mjs";
import { refreshLayout } from "./settings.mjs";
import { addDice, clearPool, removeDice, setMode, setModifier, snapshot } from "./state.mjs";
import { registerSystemMap } from "./systems.mjs";

/**
 * The public API, at `game.modules.get("sogrom-dicetray").api`. Documented in docs/API.md; the
 * method names are part of the module's contract with other modules and macros.
 */
export function createApi() {
  return Object.freeze({
    /**
     * Give a game system its own default dice and mode buttons, or replace a built-in map.
     * @param {string} systemId
     * @param {import("./systems.mjs").SystemMap} map
     */
    registerSystem(systemId, map) {
      if ( (typeof systemId !== "string") || !systemId ) throw new Error(`${MODULE_ID} | registerSystem needs a system id`);
      if ( map && (typeof map !== "object") ) throw new Error(`${MODULE_ID} | registerSystem needs a map object`);
      registerSystemMap(systemId, map);
      if ( game.ready ) refreshLayout();
    },

    /** The rows of buttons the tray shows (a copy). */
    getLayout() {
      return foundry.utils.deepClone(getRows());
    },

    /** The mode buttons for this world's system, by id (a copy). */
    getModes() {
      return foundry.utils.deepClone(getModes());
    },

    /** The pool as it stands: { dice: { d6: 2, … }, mode, modifier, keep }. */
    getPool() {
      return snapshot();
    },

    /** The formula the pool would roll right now, or "" when it is empty. */
    getFormula() {
      return currentFormula();
    },

    /**
     * Add dice to the pool, as if a button with this formula were clicked `times` times.
     * @param {string} formula   A dice term: "d6", "4dF", "d6x".
     * @param {number} [times]
     * @returns {boolean} false if the formula isn't a dice term or the per-die limit was reached.
     */
    add(formula, times = 1) {
      const term = parseDieTerm(formula);
      if ( !term || !(times >= 1) ) return false;
      return addDice(term.key, term.count * Math.trunc(times));
    },

    /**
     * Take dice out of the pool.
     * @param {string} formula   A dice term: "d6".
     * @param {number} [times]
     */
    remove(formula, times = 1) {
      const term = parseDieTerm(formula);
      if ( term ) removeDice(term.key, term.count * Math.trunc(times));
    },

    /** Set the flat modifier. */
    setModifier(value) {
      setModifier(Number(value));
    },

    /** Turn on one of the system's modes ("advantage", …), or turn them off with null. */
    setMode(mode) {
      setMode(mode && (mode in getModes()) ? mode : "normal");
    },

    /** Empty the pool. */
    clear() {
      clearPool();
    },

    /**
     * Roll the pool to chat, then empty it.
     * @returns {Promise<ChatMessage|null>}
     */
    roll() {
      return rollPool({ source: "api" });
    },

    /**
     * Roll any formula to chat the way the tray does, including its hooks.
     * @param {string} formula
     * @param {object} [options]
     * @param {string} [options.flavor]
     * @returns {Promise<ChatMessage|null>}
     */
    rollFormula(formula, { flavor } = {}) {
      return rollFormula(formula, { flavor, source: "api" });
    },

    /** Open (true), close (false) or toggle (omitted) the pop-out tray window. */
    toggleWindow(open) {
      return DiceTrayWindow.toggle(open);
    }
  });
}
