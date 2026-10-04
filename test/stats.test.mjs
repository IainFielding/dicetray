import { describe, expect, it } from "vitest";
import {
  DAYS_KEPT, combineStats, dayKey, diceFromRolls, emptyStats, mergeStats, normaliseStats, recordRoll, summariseStats
} from "../scripts/stats.mjs";

const d20 = (...results) => ({ faces: 20, results });

describe("recording rolls", () => {
  it("tallies each die size, face by face, overall and per day", () => {
    const s = emptyStats();
    recordRoll(s, [d20(20, 7), { faces: 6, results: [3] }], "2026-10-04");
    recordRoll(s, [d20(1)], "2026-10-05");
    expect(s.rolls).toBe(2);
    expect(s.dice[20]).toMatchObject({ count: 3, sum: 28 });
    expect(s.dice[20].faces[19]).toBe(1);
    expect(s.dice[20].faces[0]).toBe(1);
    expect(s.days["2026-10-04"].dice[6].count).toBe(1);
    expect(s.days["2026-10-05"].rolls).toBe(1);
  });

  it("ignores rolls with no countable dice, and impossible results", () => {
    const s = emptyStats();
    recordRoll(s, [{ faces: "F", results: [1] }, { faces: 1000, results: [5] }, d20(0, 21)], "2026-10-04");
    expect(s).toEqual(emptyStats());
  });

  it("reads dice out of Foundry rolls", () => {
    const rolls = [{ dice: [{ denomination: "d", faces: 20, results: [{ result: 12 }, { result: 3, discarded: true }] },
      { denomination: "f", faces: 3, results: [{ result: -1 }, { result: 1 }] },
      { denomination: "c", faces: 2, results: [{ result: 0 }] }] }, { dice: [] }];
    expect(diceFromRolls(rolls)).toEqual([d20(12, 3)]);
  });

  it("tells numbered dice by their class, as Foundry's terms report denomination with the faces", () => {
    class Die { static DENOMINATION = "d"; denomination = "d20"; faces = 20; results = [{ result: 7 }]; }
    class FateDie { static DENOMINATION = "f"; denomination = "df"; faces = 3; results = [{ result: 1 }]; }
    expect(diceFromRolls([{ dice: [new Die(), new FateDie()] }])).toEqual([d20(7)]);
  });

  it("files rolls by UTC day", () => {
    expect(dayKey(new Date(Date.UTC(2026, 0, 5, 23, 30)))).toBe("2026-01-05");
  });
});

describe("merging and summarising", () => {
  it("adds unsaved rolls to saved ones without changing either", () => {
    const saved = recordRoll(emptyStats(), [d20(10)], "2026-10-04");
    const delta = recordRoll(emptyStats(), [d20(20)], "2026-10-04");
    const merged = mergeStats(saved, delta);
    expect(merged.dice[20]).toMatchObject({ count: 2, sum: 30 });
    expect(saved.dice[20].count).toBe(1);
    expect(delta.dice[20].count).toBe(1);
  });

  it(`keeps only the last ${DAYS_KEPT} days`, () => {
    const delta = emptyStats();
    for ( let day = 1; day <= DAYS_KEPT + 5; day++ ) recordRoll(delta, [d20(5)], dayKey(new Date(Date.UTC(2026, 0, day))));
    const merged = mergeStats(emptyStats(), delta);
    expect(Object.keys(merged.days)).toHaveLength(DAYS_KEPT);
    expect(merged.days["2026-01-01"]).toBeUndefined();
    expect(merged.rolls).toBe(DAYS_KEPT + 5);
  });

  it("combines players and summarises d20 luck", () => {
    const a = recordRoll(emptyStats(), [d20(20, 20, 1)], "2026-10-04");
    const b = recordRoll(emptyStats(), [d20(15), { faces: 8, results: [8, 2] }], "2026-10-05");
    const all = summariseStats(combineStats([a, b]));
    expect(all.d20).toMatchObject({ count: 4, mean: 14, nat20: 2, nat1: 1 });
    expect(all.dice.map(d => d.faces)).toEqual([8, 20]);
    expect(all.dice[0]).toMatchObject({ count: 2, mean: 5, expected: 4.5 });
    expect(summariseStats(combineStats([a, b]), "2026-10-05").d20.count).toBe(1);
    expect(summariseStats(emptyStats()).d20.mean).toBeNull();
  });

  it("treats malformed stored data as empty", () => {
    expect(normaliseStats(null)).toEqual(emptyStats());
    expect(normaliseStats({ version: 99 })).toEqual(emptyStats());
    const cleaned = normaliseStats({ version: 1, rolls: 3, dice: { 20: { count: 1, sum: 5, faces: [1] }, x: {} }, days: { bad: {} } });
    expect(cleaned).toEqual({ version: 1, rolls: 3, dice: {}, days: {} });
  });
});
