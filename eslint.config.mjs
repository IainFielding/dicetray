import js from "@eslint/js";
import globals from "globals";

/**
 * Flat ESLint config for the Dice Tray.
 *
 * The module is browser ESM running inside Foundry VTT, so on top of the standard browser
 * globals we declare the Foundry globals the code reaches for (`game`, `CONFIG`, `foundry`,
 * `Roll`, `Hooks`, `ui`, …). Tests additionally see Node built-ins.
 */

const foundryGlobals = {
  game: "readonly",
  CONFIG: "readonly",
  CONST: "readonly",
  foundry: "readonly",
  Roll: "readonly",
  Hooks: "readonly",
  ui: "readonly",
  canvas: "readonly",
  ChatMessage: "readonly",
  getDocumentClass: "readonly",
  Handlebars: "readonly",
  FilePicker: "readonly"
};

export default [
  { ignores: ["**/node_modules/**"] },
  js.configs.recommended,
  {
    files: ["scripts/**/*.{js,mjs}", "tools/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...foundryGlobals }
    },
    rules: {
      // Unused args are common in Foundry hook/callback signatures; ignore leading-underscore
      // names and trailing unused args rather than forcing churn on every handler.
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", args: "after-used" }],
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  },
  {
    files: ["test/**/*.mjs", "*.config.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...foundryGlobals }
    }
  }
];
