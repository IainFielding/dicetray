import { afterEach, describe, expect, it } from "vitest";
import { allButtons, normaliseRows } from "../scripts/dice.mjs";
import {
  GENERIC_MODES, SYSTEM_ALIASES, SYSTEM_MAPS, registerSystemMap, systemMap, systemModes, systemRows, unregisterSystemMap
} from "../scripts/systems.mjs";

describe("built-in system maps", () => {
  for ( const id of Object.keys(SYSTEM_MAPS) ) {
    it(`${id}: every default button is valid`, () => {
      const rows = systemRows(id);
      // Normalising drops invalid buttons, so a typo in a map would show up as a shorter list.
      expect(allButtons(normaliseRows(rows)).length).toBe(allButtons(rows).length);
      expect(rows.length).toBeGreaterThan(0);
    });

    it(`${id}: every mode is complete`, () => {
      for ( const mode of Object.values(systemModes(id)) ) {
        expect(mode).toHaveProperty("label");
        expect(mode).toHaveProperty("tooltip");
        expect(mode).toHaveProperty("flavor");
        expect(mode).toHaveProperty("icon");
        expect(["repeat", "extraDie", "wildDie"]).toContain(mode.style);
        if ( mode.style === "repeat" ) expect(["kh", "kl"]).toContain(mode.keep);
        else expect(mode.die).toMatch(/^\d+d\w+$/);
        if ( mode.style === "extraDie" ) expect(["+", "-"]).toContain(mode.op);
      }
    });
  }

  it("points every alias at a real map", () => {
    for ( const target of Object.values(SYSTEM_ALIASES) ) expect(SYSTEM_MAPS).toHaveProperty(target);
  });
});

describe("system modes", () => {
  afterEach(() => ["dcc", "test-null", "test-partial"].forEach(unregisterSystemMap));

  it("gives unknown systems the standard dice and generic advantage", () => {
    expect(systemRows("some-new-system")).toEqual([[
      { formula: "d4" }, { formula: "d6" }, { formula: "d8" }, { formula: "d10" }, { formula: "d12" }, { formula: "d20" },
      { formula: "d100" }
    ]]);
    expect(systemModes("some-new-system")).toBe(GENERIC_MODES);
  });

  it("merges a system's overrides over the generic modes", () => {
    const modes = systemModes("pf2e");
    expect(modes.advantage).toMatchObject({ style: "repeat", keep: "kh", label: "SOGROM_DICETRAY.Pf2eFortune" });
    expect(systemModes("sf2e")).toEqual(modes);
  });

  it("hides the modes for systems without them", () => {
    expect(systemModes("fate-core-official")).toEqual({});
    expect(systemModes("dcc")).toEqual({});
  });

  it("keeps generic modes a map doesn't mention", () => {
    registerSystemMap("test-partial", { modes: { advantage: { label: "X.Edge" }, boost: { style: "extraDie", die: "1d4", op: "+" } } });
    const modes = systemModes("test-partial");
    expect(Object.keys(modes)).toEqual(["advantage", "disadvantage", "boost"]);
    expect(modes.advantage.label).toBe("X.Edge");
    expect(modes.disadvantage).toEqual(GENERIC_MODES.disadvantage);
  });

  it("gives SWADE only its wild die", () => {
    expect(Object.keys(systemModes("swade"))).toEqual(["wild"]);
  });

  it("treats modes: undefined as leaving the modes out", () => {
    registerSystemMap("test-null", { modes: undefined });
    expect(systemModes("test-null")).toBe(GENERIC_MODES);
  });

  it("drops a mode set to null and keeps the rest", () => {
    registerSystemMap("test-null", { modes: { advantage: {}, disadvantage: null } });
    expect(Object.keys(systemModes("test-null"))).toEqual(["advantage"]);
  });

  it("lets a registered map replace a built-in one", () => {
    registerSystemMap("dcc", { rows: () => [[{ formula: "d20" }]] });
    expect(systemRows("dcc")).toEqual([[{ formula: "d20" }]]);
    expect(systemModes("dcc")).toBe(GENERIC_MODES);
    expect(systemMap("dcc")).not.toBe(SYSTEM_MAPS.dcc);
    unregisterSystemMap("dcc");
    expect(systemMap("dcc")).toBe(SYSTEM_MAPS.dcc);
  });
});
