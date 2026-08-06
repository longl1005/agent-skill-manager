import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { inspectGitSkills } from "./commands";

describe("Git Skill commands", () => {
  it("requests Git Skill candidates from Tauri", async () => {
    const candidates = [{ name: "dashi-ppt", description: "Slides", relative_path: "skills/dashi-ppt" }];
    vi.mocked(invoke).mockResolvedValueOnce(candidates);

    await expect(inspectGitSkills("https://github.com/chuspeeism/dashi-ppt-skill")).resolves.toEqual(candidates);
    expect(invoke).toHaveBeenCalledWith("inspect_git_skills", {
      source: "https://github.com/chuspeeism/dashi-ppt-skill",
    });
  });
});
