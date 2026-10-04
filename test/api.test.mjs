import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { HOOKS } from "../scripts/constants.mjs";

/**
 * The hooks and API methods are a contract with other modules and macros. The hook names are
 * asserted literally on purpose: if this fails because one was renamed, the test is right and the
 * rename is a breaking change. Everything public must also be documented in docs/API.md.
 */

const docs = readFileSync("docs/API.md", "utf8");
const apiSource = readFileSync("scripts/api.mjs", "utf8");
const methods = [...apiSource.matchAll(/^ {4}(\w+)\(/gm)].map(([, name]) => name);

describe("public hooks", () => {
  it("keep their names", () => {
    expect(HOOKS).toEqual({
      init: "sogrom-dicetray.init",
      ready: "sogrom-dicetray.ready",
      preRoll: "sogrom-dicetray.preRoll",
      roll: "sogrom-dicetray.roll",
      poolChanged: "sogrom-dicetray.poolChanged"
    });
  });

  it("are all documented", () => {
    for ( const hook of Object.values(HOOKS) ) expect(docs, hook).toContain(`\`${hook}\``);
  });
});

describe("public API", () => {
  it("keeps its methods", () => {
    expect(methods).toEqual([
      "registerSystem", "getLayout", "getModes", "getPool", "getFormula", "add", "remove", "setModifier",
      "setMode", "clear", "roll", "rollFormula", "toggleWindow"
    ]);
  });

  it("documents every method", () => {
    for ( const name of methods ) expect(docs, name).toContain(`\`${name}(`);
  });
});
