import { beforeEach, describe, expect, it } from "vitest";
import {
  addDice, adjustKeep, clearPool, consume, removeDice, setModifier, state, toggleMode
} from "../scripts/state.mjs";
import { MAX_DICE_PER_TYPE, MAX_MODIFIER } from "../scripts/constants.mjs";

beforeEach(() => clearPool());

describe("dice pool state", () => {
  it("targets keep modifiers at the last die added", () => {
    addDice("d20"); addDice("d20"); addDice("d6");
    adjustKeep("kh", 1);
    expect(state.keep).toEqual({ d6: { type: "kh", count: 1 } });
  });

  it("retargets keep at a remaining die when the last type is removed", () => {
    addDice("d20"); addDice("d20"); addDice("d6");
    removeDice("d6");
    expect(state.lastDie).toBe("d20");
    adjustKeep("kh", 1);
    expect(state.keep).toEqual({ d20: { type: "kh", count: 1 } });
  });

  it("drops a keep modifier when its last die is removed", () => {
    addDice("d6"); addDice("d6");
    adjustKeep("kl", 1);
    removeDice("d6"); removeDice("d6");
    expect(state.keep).toEqual({});
    expect(state.lastDie).toBeNull();
  });

  it("uses up the dice a roll took, keeping the rest of the pool and its modifier", () => {
    addDice("d6"); addDice("d6"); addDice("d20");
    setModifier(2);
    adjustKeep("kh", 1);
    consume({ d6: 2 });
    expect(state.pool).toEqual(["d20"]);
    expect(state.modifier).toBe(2);
    expect(state.keep).toEqual({ d20: { type: "kh", count: 1 } });
    consume({ d20: 1 }, { withModifiers: true });
    expect(state.modifier).toBe(0);
  });

  it("leaves dice added while a roll was in flight", () => {
    addDice("d6", 2);
    const rolled = { d6: 2 };
    addDice("d6", 2);
    consume(rolled, { withModifiers: true });
    expect(state.pool).toEqual(["d6", "d6"]);
  });

  it("ignores lowering the other kind of keep", () => {
    addDice("d6", 4);
    adjustKeep("kh", 1); adjustKeep("kh", 1);
    adjustKeep("kl", -1);
    expect(state.keep).toEqual({ d6: { type: "kh", count: 2 } });
  });

  it("adds and removes several dice per click", () => {
    addDice("dF", 4);
    expect(state.pool).toEqual(["dF", "dF", "dF", "dF"]);
    removeDice("dF", 4);
    expect(state.pool).toEqual([]);
    expect(state.lastDie).toBeNull();
  });

  it("caps dice per type and the modifier", () => {
    for ( let i = 0; i < MAX_DICE_PER_TYPE; i++ ) addDice("d4");
    expect(addDice("d4")).toBe(false);
    clearPool();
    expect(addDice("d6", MAX_DICE_PER_TYPE + 1)).toBe(false);
    expect(state.pool).toEqual([]);
    setModifier(1000);
    expect(state.modifier).toBe(MAX_MODIFIER);
    setModifier(-1000);
    expect(state.modifier).toBe(-MAX_MODIFIER);
  });

  it("toggles a roll mode off when selected again", () => {
    toggleMode("advantage");
    expect(state.mode).toBe("advantage");
    toggleMode("advantage");
    expect(state.mode).toBe("normal");
  });
});
