import { describe, expect, it } from "vitest";
import {
  allButtons, buttonImage, buttonText, dieName, isCommand, normaliseButton, normaliseRows, parseDieTerm
} from "../scripts/dice.mjs";

describe("parseDieTerm", () => {
  it("parses plain, counted, Fate, percentile and modified dice", () => {
    expect(parseDieTerm("d6")).toEqual({ count: 1, faces: 6, modifiers: "", key: "d6" });
    expect(parseDieTerm("4dF")).toEqual({ count: 4, faces: "F", modifiers: "", key: "dF" });
    expect(parseDieTerm("4df")).toMatchObject({ key: "dF" });
    expect(parseDieTerm("d%")).toMatchObject({ faces: 100, key: "d100" });
    expect(parseDieTerm("2d10r1")).toEqual({ count: 2, faces: 10, modifiers: "r1", key: "d10r1" });
    expect(parseDieTerm(" d6x ")).toMatchObject({ key: "d6x" });
  });

  it("rejects anything that isn't a single dice term", () => {
    for ( const bad of ["", "6", "d", "d0", "0d6", "2d6+1", "d6 + d8", "/r 1d20", "100d6", null, undefined] ) {
      expect(parseDieTerm(bad), String(bad)).toBeNull();
    }
  });
});

describe("dieName", () => {
  it("names dice for tooltips", () => {
    expect(dieName("d20")).toBe("D20");
    expect(dieName("dF")).toBe("DF");
    expect(dieName("d6x")).toBe("D6x");
  });
});

describe("normaliseButton", () => {
  it("keeps known fields, trims them, and drops the rest", () => {
    expect(normaliseButton({ formula: " d8 ", label: " Eight ", tooltip: "", junk: 1 }))
      .toEqual({ formula: "d8", label: "Eight" });
  });

  it("accepts chat commands", () => {
    expect(isCommand("/dr")).toBe(true);
    expect(normaliseButton({ formula: "/dr", label: "Duality" })).toEqual({ formula: "/dr", label: "Duality" });
  });

  it("rejects buttons with no usable formula", () => {
    expect(normaliseButton({ formula: "2d6+1" })).toBeNull();
    expect(normaliseButton({ label: "x" })).toBeNull();
    expect(normaliseButton("d6")).toBeNull();
  });

  it("allows one level of drawer and cleans it", () => {
    const button = normaliseButton({ formula: "d10", drawer: [{ formula: "d100" }, { formula: "bad" },
      { formula: "d4", drawer: [{ formula: "d6" }] }] });
    expect(button).toEqual({ formula: "d10", drawer: [{ formula: "d100" }, { formula: "d4" }] });
  });
});

describe("normaliseRows", () => {
  it("drops invalid buttons and empty rows", () => {
    expect(normaliseRows([[{ formula: "d6" }, { formula: "?" }], [], [{ formula: "nope" }], "x"]))
      .toEqual([[{ formula: "d6" }]]);
    expect(normaliseRows(null)).toEqual([]);
  });

  it("lists every button including drawers", () => {
    const rows = normaliseRows([[{ formula: "d10", drawer: [{ formula: "d100" }] }], [{ formula: "d6" }]]);
    expect(allButtons(rows).map(b => b.formula)).toEqual(["d10", "d100", "d6"]);
  });
});

describe("button faces", () => {
  it("uses the module icon only for a plain, single standard die", () => {
    expect(buttonImage({ formula: "d20" }, "icons")).toBe("icons/d20-grey.svg");
    expect(buttonImage({ formula: "d9" }, "icons")).toBeNull();
    expect(buttonImage({ formula: "d6x" }, "icons")).toBeNull();
    expect(buttonImage({ formula: "2d6" }, "icons")).toBeNull();
    expect(buttonImage({ formula: "d6", img: "my.png" }, "icons")).toBe("my.png");
  });

  it("falls back to the label, then the formula", () => {
    expect(buttonText({ formula: "4dF", label: "Fate" })).toBe("Fate");
    expect(buttonText({ formula: "4dF" })).toBe("4dF");
  });
});
