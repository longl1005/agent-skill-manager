import { describe, expect, it } from "vitest";
import { createReleaseManifest } from "./create-release-manifest.mjs";

describe("createReleaseManifest", () => {
  it("creates a complete stable updater manifest with platform-specific URLs", () => {
    const manifest = createReleaseManifest({
      version: "1.2.3",
      tag: "v1.2.3",
      repository: "longl1005/agent-skill-manager",
      pubDate: "2026-08-06T12:00:00.000Z",
      assets: {
        "darwin-aarch64": { name: "Agent-Skill-Manager_1.2.3_darwin-aarch64.app.tar.gz", signature: "arm-signature" },
        "darwin-x86_64": { name: "Agent-Skill-Manager_1.2.3_darwin-x86_64.app.tar.gz", signature: "intel-signature" },
        "windows-x86_64": { name: "Agent-Skill-Manager_1.2.3_windows-x86_64-setup.exe", signature: "windows-signature" },
      },
    });

    expect(manifest).toEqual({
      version: "1.2.3",
      notes: "See the release notes on GitHub.",
      pub_date: "2026-08-06T12:00:00.000Z",
      platforms: {
        "darwin-aarch64": {
          signature: "arm-signature",
          url: "https://github.com/longl1005/agent-skill-manager/releases/download/v1.2.3/Agent-Skill-Manager_1.2.3_darwin-aarch64.app.tar.gz",
        },
        "darwin-x86_64": {
          signature: "intel-signature",
          url: "https://github.com/longl1005/agent-skill-manager/releases/download/v1.2.3/Agent-Skill-Manager_1.2.3_darwin-x86_64.app.tar.gz",
        },
        "windows-x86_64": {
          signature: "windows-signature",
          url: "https://github.com/longl1005/agent-skill-manager/releases/download/v1.2.3/Agent-Skill-Manager_1.2.3_windows-x86_64-setup.exe",
        },
      },
    });
  });
});
