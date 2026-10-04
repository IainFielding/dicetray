import { defineConfig } from "vitest/config";

// The pure logic (formula building, dice configuration, odds) runs in plain Node — no DOM
// and no Foundry globals needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.mjs"]
  }
});
