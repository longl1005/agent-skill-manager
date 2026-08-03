import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles/global.css", "utf8");

describe("sidebar scrolling", () => {
  it("hides every visual scrollbar for the Agent list", () => {
    expect(styles).not.toContain(".sidebar-agent-scroll-indicator");
    expect(styles).toContain("scrollbar-width: none");
  });
});

describe("settings layout", () => {
  it("uses the full available content width", () => {
    expect(styles).toContain(".settings-page {\n  width: 100%;\n}");
  });
});

describe("external Skill actions", () => {
  it("keeps the compact master-library import control beside the external-link badge", () => {
    expect(styles).toContain(".agent-detail__skill-external-import-btn--compact");
  });
});
