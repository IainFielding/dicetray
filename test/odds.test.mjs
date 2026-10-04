import { describe, expect, it } from "vitest";
import {
  convolve, dieDistribution, explodingDistribution, extreme, keepDistribution, negate, poolDistribution, sumOf, summarise
} from "../scripts/odds.mjs";
import { GENERIC_MODES } from "../scripts/systems.mjs";

const pool = (overrides = {}) => ({ pool: [], mode: "normal", modifier: 0, keep: {}, ...overrides });
const odds = (state, target = null, modes = GENERIC_MODES) => summarise(poolDistribution(pool(state), { modes }), target);
const total = d => d.p.reduce((a, b) => a + b, 0);

describe("distributions", () => {
  it("sums dice exactly", () => {
    const twoD6 = sumOf(dieDistribution(6), 2);
    expect(twoD6.min).toBe(2);
    expect(twoD6.p[7 - 2]).toBeCloseTo(6 / 36, 12);
    expect(total(sumOf(dieDistribution(10), 7))).toBeCloseTo(1, 12);
  });

  it("takes the larger or smaller of two rolls", () => {
    const d20 = dieDistribution(20);
    const adv = extreme(d20, d20, true);
    expect(adv.p[20 - 1]).toBeCloseTo(39 / 400, 12);
    expect(extreme(d20, d20, false).p[0]).toBeCloseTo(39 / 400, 12);
  });

  it("keeps the highest or lowest dice exactly", () => {
    expect(summarise(keepDistribution(6, 4, 3, true)).mean).toBeCloseTo(15869 / 1296, 9);
    const d20 = dieDistribution(20);
    const kh = keepDistribution(20, 2, 1, true);
    const adv = extreme(d20, d20, true);
    expect(kh.min).toBe(adv.min);
    expect(Array.from(kh.p)).toEqual(Array.from(adv.p, v => expect.closeTo(v, 12)));
    expect(total(keepDistribution(8, 5, 2, false))).toBeCloseTo(1, 12);
  });

  it("follows exploding dice until the rest is negligible", () => {
    const d6x = explodingDistribution(6);
    expect(total(d6x)).toBeCloseTo(1, 9);
    expect(summarise(d6x).mean).toBeCloseTo(4.2, 4);
    expect(d6x.p[6 - 1]).toBe(0);
    expect(d6x.unbounded).toBe(true);
  });

  it("negates and convolves", () => {
    const d = convolve(dieDistribution(20), negate(dieDistribution(6)));
    expect(d.min).toBe(-5);
    expect(summarise(d).mean).toBeCloseTo(7, 12);
  });
});

describe("pool odds", () => {
  it("covers a plain d20 against a DC", () => {
    expect(odds({ pool: ["d20"], modifier: 0 }, 15)).toMatchObject({ min: 1, max: 20, mean: 10.5, approximate: false });
    expect(odds({ pool: ["d20"] }, 15).chance).toBeCloseTo(0.3, 12);
    expect(odds({ pool: ["d20"], modifier: 5 }, 15).chance).toBeCloseTo(0.55, 12);
  });

  it("covers advantage, disadvantage and keep modifiers", () => {
    expect(odds({ pool: ["d20"], mode: "advantage" }, 11).chance).toBeCloseTo(0.75, 12);
    expect(odds({ pool: ["d20"], mode: "advantage" }).mean).toBeCloseTo(13.825, 9);
    expect(odds({ pool: ["d20"], mode: "disadvantage" }).mean).toBeCloseTo(7.175, 9);
    expect(odds({ pool: ["d6", "d6", "d6", "d6"], keep: { d6: { type: "kh", count: 3 } } }).mean).toBeCloseTo(12.2446, 3);
  });

  it("covers Fate dice", () => {
    expect(odds({ pool: ["dF", "dF", "dF", "dF"] })).toMatchObject({ min: -4, max: 4 });
    expect(odds({ pool: ["dF", "dF", "dF", "dF"] }).mean).toBeCloseTo(0, 12);
  });

  it("covers extra-die and wild-die modes", () => {
    const modes = {
      plus: { style: "extraDie", die: "1d6", op: "+" },
      minus: { style: "extraDie", die: "1d6", op: "-" },
      wild: { style: "wildDie", die: "1dw" }
    };
    expect(odds({ pool: ["d20"], mode: "plus" }, null, modes).mean).toBeCloseTo(14, 12);
    expect(odds({ pool: ["d20"], mode: "minus" }, null, modes).mean).toBeCloseTo(7, 12);
    const wild = odds({ pool: ["d4x"], mode: "wild" }, 4, modes);
    expect(wild.unbounded).toBe(true);
    // Fail to reach 4 only if both the d4 and the wild d6 come up short: (3/4)·(3/6).
    expect(wild.chance).toBeCloseTo(1 - (0.75 * 0.5), 6);
  });

  it("simulates what is too costly to work out, the same way every time", () => {
    const state = { pool: Array(6).fill("d6x"), keep: { d6x: { type: "kh", count: 3 } } };
    const first = odds(state, 15);
    expect(first.approximate).toBe(true);
    expect(odds(state, 15)).toEqual(first);
    expect(first.mean).toBeGreaterThan(14);
  });

  it("gives up on dice it can't cover", () => {
    expect(poolDistribution(pool({ pool: ["dp"] }))).toBeNull();
    expect(poolDistribution(pool({ pool: ["d10r1"] }))).toBeNull();
    expect(poolDistribution(pool())).toBeNull();
  });
});
