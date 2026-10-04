import { describe, expect, it } from "vitest";
import { buildFormula, parseRollCommand } from "../scripts/formula.mjs";

const pool = (overrides = {}) => ({ pool: [], mode: "normal", modifier: 0, keep: {}, ...overrides });

describe("buildFormula", () => {
  it("is empty for an empty pool", () => {
    expect(buildFormula(pool({ modifier: 3 }))).toBe("");
  });

  it("groups dice by type, smallest first", () => {
    expect(buildFormula(pool({ pool: [20, 6, 6, 4] }))).toBe("1d4 + 2d6 + 1d20");
  });

  it("adds a positive or negative modifier", () => {
    expect(buildFormula(pool({ pool: [20], modifier: 5 }))).toBe("1d20 + 5");
    expect(buildFormula(pool({ pool: [20], modifier: -2 }))).toBe("1d20 - 2");
  });

  it("applies keep highest/lowest per die type", () => {
    expect(buildFormula(pool({ pool: [20, 20], keep: { 20: { type: "kh", count: 1 } } }))).toBe("2d20kh");
    expect(buildFormula(pool({ pool: [6, 6, 6, 6], keep: { 6: { type: "kh", count: 3 } } }))).toBe("4d6kh3");
    expect(buildFormula(pool({ pool: [8, 20, 20], keep: { 20: { type: "kl", count: 1 } } }))).toBe("1d8 + 2d20kl");
  });

  it("uses the system's adv/dis modifiers when its dice support them", () => {
    const native = { nativeAdvantage: true };
    expect(buildFormula(pool({ pool: [20], mode: "advantage" }), native)).toBe("1d20adv");
    expect(buildFormula(pool({ pool: [20, 4], mode: "disadvantage" }), native)).toBe("1d4dis + 1d20dis");
  });

  it("writes advantage with core dice pools for other systems", () => {
    expect(buildFormula(pool({ pool: [20], mode: "advantage", modifier: 2 }))).toBe("2d20kh + 2");
    expect(buildFormula(pool({ pool: [20], mode: "disadvantage" }))).toBe("2d20kl");
    expect(buildFormula(pool({ pool: [6, 6, 6], mode: "advantage" }))).toBe("{3d6,3d6}kh");
    expect(buildFormula(pool({ pool: [20, 20], mode: "advantage", keep: { 20: { type: "kh", count: 1 } } })))
      .toBe("{2d20kh,2d20kh}kh");
  });
});

describe("parseRollCommand", () => {
  it("extracts the formula from /r and /roll", () => {
    expect(parseRollCommand("/r 2d6 + 1")).toBe("2d6 + 1");
    expect(parseRollCommand("  /ROLL 1d20kh ")).toBe("1d20kh");
  });

  it("ignores anything that isn't a roll command", () => {
    expect(parseRollCommand("hello")).toBeNull();
    expect(parseRollCommand("/gmr 1d20")).toBeNull();
    expect(parseRollCommand("")).toBeNull();
  });
});
