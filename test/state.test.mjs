import { beforeEach, describe, expect, it } from "vitest";
import { addDie, adjustKeep, clearPool, removeDie, setModifier, state, toggleMode } from "../scripts/state.mjs";
import { MAX_DICE_PER_TYPE, MAX_MODIFIER } from "../scripts/constants.mjs";

beforeEach(() => clearPool());

describe("dice pool state", () => {
  it("targets keep modifiers at the last die added", () => {
    addDie(20); addDie(20); addDie(6);
    adjustKeep("kh", 1);
    expect(state.keep).toEqual({ 6: { type: "kh", count: 1 } });
  });

  it("retargets keep at a remaining die when the last type is removed", () => {
    addDie(20); addDie(20); addDie(6);
    removeDie(6);
    expect(state.lastDie).toBe(20);
    adjustKeep("kh", 1);
    expect(state.keep).toEqual({ 20: { type: "kh", count: 1 } });
  });

  it("drops a keep modifier when its last die is removed", () => {
    addDie(6); addDie(6);
    adjustKeep("kl", 1);
    removeDie(6); removeDie(6);
    expect(state.keep).toEqual({});
    expect(state.lastDie).toBeNull();
  });

  it("caps dice per type and the modifier", () => {
    for ( let i = 0; i < MAX_DICE_PER_TYPE; i++ ) addDie(4);
    expect(addDie(4)).toBe(false);
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
