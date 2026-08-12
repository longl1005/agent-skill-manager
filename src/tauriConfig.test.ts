import { describe, expect, it } from "vitest";
import tauriConfig from "../src-tauri/tauri.conf.json";
import defaultCapabilities from "../src-tauri/capabilities/default.json";

describe("Tauri updater configuration", () => {
  it("points signed updates at the stable GitHub Release manifest", () => {
    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins.updater.endpoints).toEqual([
      "https://github.com/longl1005/agent-skill-manager/releases/latest/download/latest.json",
    ]);
    expect(tauriConfig.plugins.updater.pubkey).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("does not grant custom window dragging after removing the custom title bar", () => {
    expect(defaultCapabilities.permissions).not.toContain("core:window:allow-start-dragging");
  });
});
