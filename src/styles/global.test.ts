import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles/global.css", "utf8").replace(/\r\n/g, "\n");

describe("sidebar scrolling", () => {
  it("hides every visual scrollbar for the Agent list", () => {
    expect(styles).not.toContain(".sidebar-agent-scroll-indicator");
    expect(styles).toContain("scrollbar-width: none");
  });
});

describe("settings layout", () => {
  it("uses the full available content width", () => {
    expect(styles).toMatch(/\.settings-page\s*\{[^}]*width:\s*100%;/s);
  });

  it("stacks preference rows and expands selects by 760px", () => {
    const responsiveSettingsRule = styles.match(
      /@media \(max-width:\s*(\d+)px\)\s*\{\s*\.settings-content-panel\s*\{[^}]*padding:\s*20px;[^}]*\}\s*\.settings-row,[\s\S]*?flex-direction:\s*column;[\s\S]*?\.settings-select\s*\{[^}]*width:\s*100%;/,
    );

    expect(responsiveSettingsRule).not.toBeNull();
    expect(Number(responsiveSettingsRule?.[1])).toBeGreaterThanOrEqual(760);
  });
});

describe("external Skill actions", () => {
  it("keeps the compact master-library import control beside the external-link badge", () => {
    expect(styles).toContain(".agent-detail__skill-external-import-btn--compact");
  });
});

describe("Git URL input focus styling", () => {
  it("uses its focused border without the global focus-visible outline", () => {
    expect(styles).toContain("input.install-url-input:focus-visible {\n  outline: none;\n  outline-offset: 0;\n}");
  });
});

describe("skill library list coverage", () => {
  it("keeps linked Agent icons visually separated instead of overlapping", () => {
    expect(styles).toContain(".skill-list-linked-agents {\n  align-items: center;\n  display: flex;\n  gap: 6px;");
    expect(styles).not.toContain(".skill-list-linked-agent {\n  align-items: center;\n  background: var(--surface);\n  border: 2px solid var(--surface);\n  border-radius: 8px;\n  display: inline-flex;\n  height: 26px;\n  justify-content: center;\n  margin-left: -4px;");
  });
});
