import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { inspectGitSkills, scanAgents } from "./commands";

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

describe("performance diagnostic command context", () => {
  it("adds an operation ID and in-flight count to a traced scan request", async () => {
    const scanReport = {
      scan_id: "scan-1",
      started_at: 1,
      completed_at: 2,
      agents: [],
      total_skills: 0,
      total_issues: 0,
    };
    vi.mocked(invoke).mockResolvedValueOnce(scanReport);

    await expect(scanAgents({}, { operationId: "op-1", inFlightSameOperation: 2 })).resolves.toEqual(scanReport);

    expect(invoke).toHaveBeenCalledWith("scan_agents", {
      customPaths: {},
      diagnosticContext: { operationId: "op-1", inFlightSameOperation: 2 },
    });
  });

  it("sends a null diagnostic context when a scan is not traced", async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      scan_id: "scan-2",
      started_at: 1,
      completed_at: 2,
      agents: [],
      total_skills: 0,
      total_issues: 0,
    });

    await scanAgents();

    expect(invoke).toHaveBeenLastCalledWith("scan_agents", {
      customPaths: null,
      diagnosticContext: null,
    });
  });
});
