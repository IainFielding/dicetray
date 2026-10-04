import { describe, expect, it } from "vitest";
import { buildFormula, parseRollCommand } from "../scripts/formula.mjs";

const pool = (overrides = {}) => ({ pool: [], mode: "normal", modifier: 0, keep: {}, ...overrides });

describe("buildFormula", () => {
  it("is empty for an empty pool", () => {
    expect(buildFormula(pool({ modifier: 3 }))).toBe("");
  });

  it("groups dice by type, smallest first", () => {
    expect(buildFormula(pool({ pool: ["d20", "d6", "d6", "d4"] }))).toBe("1d4 + 2d6 + 1d20");
  });

  it("adds a positive or negative modifier", () => {
    expect(buildFormula(pool({ pool: ["d20"], modifier: 5 }))).toBe("1d20 + 5");
    expect(buildFormula(pool({ pool: ["d20"], modifier: -2 }))).toBe("1d20 - 2");
  });

  it("applies keep highest/lowest per die type", () => {
    expect(buildFormula(pool({ pool: ["d20", "d20"], keep: { d20: { type: "kh", count: 1 } } }))).toBe("2d20kh");
    expect(buildFormula(pool({ pool: ["d6", "d6", "d6", "d6"], keep: { d6: { type: "kh", count: 3 } } }))).toBe("4d6kh3");
    expect(buildFormula(pool({ pool: ["d8", "d20", "d20"], keep: { d20: { type: "kl", count: 1 } } }))).toBe("1d8 + 2d20kl");
  });

  it("uses the system's adv/dis modifiers when its dice support them", () => {
    const native = { nativeAdvantage: true };
    expect(buildFormula(pool({ pool: ["d20"], mode: "advantage" }), native)).toBe("1d20adv");
    expect(buildFormula(pool({ pool: ["d20", "d4"], mode: "disadvantage" }), native)).toBe("1d4dis + 1d20dis");
  });

  it("writes advantage with core dice pools for other systems", () => {
    expect(buildFormula(pool({ pool: ["d20"], mode: "advantage", modifier: 2 }))).toBe("2d20kh + 2");
    expect(buildFormula(pool({ pool: ["d20"], mode: "disadvantage" }))).toBe("2d20kl");
    expect(buildFormula(pool({ pool: ["d6", "d6", "d6"], mode: "advantage" }))).toBe("{3d6,3d6}kh");
    expect(buildFormula(pool({ pool: ["d20", "d20"], mode: "advantage", keep: { d20: { type: "kh", count: 1 } } })))
      .toBe("{2d20kh,2d20kh}kh");
  });
});

describe("buildFormula with non-numeric and modified dice", () => {
  it("puts numbered dice first, then others in the order added", () => {
    expect(buildFormula(pool({ pool: ["dF", "dF", "d20", "d6x"] }))).toBe("1d6x + 1d20 + 2dF");
  });

  it("writes advantage on modified or Fate dice as a pool", () => {
    expect(buildFormula(pool({ pool: ["d6x"], mode: "advantage" }))).toBe("{1d6x,1d6x}kh");
    expect(buildFormula(pool({ pool: ["dF", "dF"], mode: "disadvantage" }))).toBe("{2dF,2dF}kl");
    expect(buildFormula(pool({ pool: ["dF", "d20"], mode: "advantage" }), { nativeAdvantage: true }))
      .toBe("1d20adv + {1dF,1dF}kh");
    expect(buildFormula(pool({ pool: ["d6", "d6", "d6"], mode: "advantage", keep: { d6: { type: "kh", count: 2 } } }),
      { nativeAdvantage: true })).toBe("{3d6kh2,3d6kh2}kh");
  });
});

describe("buildFormula with a system's own modes", () => {
  const modes = {
    hope: { style: "extraDie", die: "1d6", op: "+" },
    fear: { style: "extraDie", die: "1d6", op: "-" },
    wild: { style: "wildDie", die: "1dw" }
  };

  it("adds or subtracts an extra die once", () => {
    expect(buildFormula(pool({ pool: ["d12", "d12"], mode: "hope", modifier: 2 }), { modes })).toBe("2d12 + 1d6 + 2");
    expect(buildFormula(pool({ pool: ["d20"], mode: "fear" }), { modes })).toBe("1d20 - 1d6");
  });

  it("rolls the wild die alongside each group", () => {
    expect(buildFormula(pool({ pool: ["d8x"], mode: "wild" }), { modes })).toBe("{1d8x,1dw}kh");
  });

  it("ignores a mode the system doesn't have", () => {
    expect(buildFormula(pool({ pool: ["d20"], mode: "advantage" }), { modes })).toBe("1d20");
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
