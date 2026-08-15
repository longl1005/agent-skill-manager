import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(".github/workflows/release.yml", "utf8");

describe("release workflow", () => {
  it("pins setup-node to the resolvable v4.0.3 commit", () => {
    expect(workflow).toContain("actions/setup-node@1e60f620b9541d16bece96c5465dc8ee9832be0b");
  });

  it("uses a supported Intel macOS runner for the x86_64 build", () => {
    expect(workflow).toContain("- os: macos-15-intel");
    expect(workflow).not.toContain("- os: macos-13");
  });

  it("ad-hoc signs macOS builds and verifies user-facing DMG installers", () => {
    expect(workflow).toContain('APPLE_SIGNING_IDENTITY: "-"');
    expect(workflow).toContain("-name '*.dmg'");
    expect(workflow).toContain("-eq 2");
  });

  it("publishes release assets with the runner-provided GitHub CLI", () => {
    expect(workflow).toContain('gh release create "${{ github.ref_name }}"');
    expect(workflow).toContain("release-artifacts/*/*");
    expect(workflow).toContain("release-artifacts/latest.json");
    expect(workflow).not.toContain("softprops/action-gh-release");
  });

  it("uses a version-specific release note when one is provided", () => {
    expect(workflow).toContain('release-notes/${{ github.ref_name }}.md');
    expect(workflow).toContain("--notes-file");
  });
});
