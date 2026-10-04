import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `lang/en.json` and the code agree, in both directions.
 *
 * Every key the module asks for exists: a missing key doesn't throw in Foundry, it shows the raw
 * key string to the player, which is easy to miss in review and obvious on screen. Keys are read
 * from full literals ("SOGROM_DICETRAY.Title") and from the short forms the code builds them from:
 * t("Title"), labelKey/tooltipKey/forKey/flavorKey: "…", and the layout editor's field labels.
 *
 * And every key in the file is still used, so translators don't spend time on dead strings.
 */

const PREFIX = "SOGROM_DICETRAY.";
const lang = JSON.parse(readFileSync("lang/en.json", "utf8"));

function walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap(entry => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
}

const sources = [...walk("scripts"), ...walk("templates")].map(file => ({ file, text: readFileSync(file, "utf8") }));

/** Every key the code refers to, with where. */
function referencedKeys() {
  const refs = [];
  const add = (file, key) => refs.push({ file, key: key.startsWith(PREFIX) ? key : PREFIX + key });
  for ( const { file, text } of sources ) {
    for ( const [key] of text.matchAll(/SOGROM_DICETRAY\.[A-Za-z0-9_.]*[A-Za-z0-9_]/g) ) add(file, key);
    for ( const [, key] of text.matchAll(/\bt\(\s*"(\w+)"/g) ) add(file, key);
    for ( const [, key] of text.matchAll(/\b(?:labelKey|tooltipKey|forKey|flavorKey):\s*"(\w+)"/g) ) add(file, key);
    // The layout editor's dialog: field("name", "LabelKey", input, "HintKey").
    for ( const [, label] of text.matchAll(/\bfield\(\s*"\w+",\s*"(\w+)"/g) ) add(file, label);
    for ( const [, hint] of text.matchAll(/,\s*"(\w+Hint)"\)/g) ) add(file, hint);
  }
  return refs;
}

describe("lang/en.json", () => {
  it("has every key the scripts and templates use", () => {
    const missing = referencedKeys().filter(({ key }) => !(key in lang)).map(({ file, key }) => `${file}: ${key}`);
    expect([...new Set(missing)]).toEqual([]);
  });

  it("has no keys nothing uses", () => {
    const used = new Set(referencedKeys().map(({ key }) => key));
    expect(Object.keys(lang).filter(key => !used.has(key))).toEqual([]);
  });
});
