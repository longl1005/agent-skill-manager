import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/release.yml", "utf8");

describe("release workflow", () => {
  it("pins setup-node to the resolvable v4.0.3 commit", () => {
    expect(workflow).toContain("actions/setup-node@1e60f620b9541d16bece96c5465dc8ee9832be0b");
  });
});
