import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `lang/en.json` and the code agree: every `SOGROM_DICETRAY.*` key the scripts or templates
 * ask for literally exists. A missing key doesn't throw in Foundry — it shows the raw key string
 * to the player, which is easy to miss in review and obvious on screen.
 */

const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
}

describe("lang/en.json", () => {
  it("has every key the scripts and templates use literally", () => {
    const missing = [];
    for ( const file of [...walk("scripts"), ...walk("templates")] ) {
      for ( const [key] of readFileSync(file, "utf8").matchAll(/SOGROM_DICETRAY\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g) ) {
        if ( !(key in lang) ) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
