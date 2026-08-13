import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMasterRepoStore } from "./masterRepoStore";
import { useAgentConfigStore } from "./agentConfigStore";
import { useScanStore } from "./scanStore";
import * as commands from "../ipc/commands";

vi.mock("../ipc/commands", () => ({
  getMasterSkills: vi.fn(),
  toggleAgentSkill: vi.fn(),
  toggleAgentSkillsBatch: vi.fn(),
  unlinkAllAgentSkills: vi.fn(),
  importToMaster: vi.fn(),
  installSkillToMaster: vi.fn(),
  deleteAgentSkill: vi.fn(),
}));

vi.mock("./scanStore", () => {
  const scanFn = vi.fn().mockResolvedValue(undefined);
  return {
    useScanStore: {
      getState: () => ({
        scan: scanFn,
      }),
    },
  };
});

describe("masterRepoStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMasterRepoStore.setState({ skills: [], loading: false, error: null });
    useAgentConfigStore.setState({ customPaths: {} });
  });

  it("initializes with default state", () => {
    const state = useMasterRepoStore.getState();
    expect(state.skills).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("fetches master skills successfully using customPaths", async () => {
    const mockSkills = [
      {
        name: "test-skill",
        description: "A test skill",
        path: "/home/user/.asm/skills/test-skill",
        linked_agents: { claude_code: true, codex: false },
      },
    ];
    useAgentConfigStore.setState({ customPaths: { claude_code: "/custom/path" } });
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce(mockSkills);

    await useMasterRepoStore.getState().fetchMasterSkills();

    expect(commands.getMasterSkills).toHaveBeenCalledWith({ claude_code: "/custom/path" }, undefined);
    const state = useMasterRepoStore.getState();
    expect(state.skills).toEqual(mockSkills);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("shares an in-flight master skills request to avoid duplicate native synchronization", async () => {
    let resolveSkills: ((skills: any[]) => void) | undefined;
    vi.mocked(commands.getMasterSkills).mockImplementationOnce(
      () => new Promise((resolve) => { resolveSkills = resolve; }),
    );

    const firstRequest = useMasterRepoStore.getState().fetchMasterSkills();
    const secondRequest = useMasterRepoStore.getState().fetchMasterSkills();

    expect(commands.getMasterSkills).toHaveBeenCalledTimes(1);

    resolveSkills?.([]);
    await Promise.all([firstRequest, secondRequest]);
  });

  it("handles fetchMasterSkills failure", async () => {
    vi.mocked(commands.getMasterSkills).mockRejectedValueOnce(new Error("Failed to fetch"));

    await useMasterRepoStore.getState().fetchMasterSkills();

    const state = useMasterRepoStore.getState();
    expect(state.skills).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBe("Error: Failed to fetch");
  });

  it("toggles agent skill and triggers refresh and scan", async () => {
    vi.mocked(commands.toggleAgentSkill).mockResolvedValueOnce(true);
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce([]);

    const result = await useMasterRepoStore.getState().toggleAgentSkill("claude_code", "test-skill", true);

    expect(result).toBe(true);
    expect(commands.toggleAgentSkill).toHaveBeenCalledWith("claude_code", "test-skill", true, {});
    expect(commands.getMasterSkills).toHaveBeenCalled();
    expect(useScanStore.getState().scan).toHaveBeenCalled();
  });

  it("handles toggleAgentSkill failure", async () => {
    vi.mocked(commands.toggleAgentSkill).mockRejectedValueOnce(new Error("Symlink failed"));

    const result = await useMasterRepoStore.getState().toggleAgentSkill("claude_code", "test-skill", true);

    expect(result).toBe(false);
    expect(useMasterRepoStore.getState().error).toBe("Error: Symlink failed");
  });

  it("batch toggles agent skills with one command and one refresh cycle", async () => {
    vi.mocked(commands.toggleAgentSkillsBatch).mockResolvedValueOnce(2);
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce([]);

    const result = await useMasterRepoStore.getState()
      .toggleAgentSkillsBatch(["claude-code", "codex"], "test-skill", true);

    expect(result).toBe(2);
    expect(commands.toggleAgentSkillsBatch).toHaveBeenCalledWith(
      ["claude-code", "codex"], "test-skill", true, {},
    );
    expect(commands.getMasterSkills).toHaveBeenCalledTimes(1);
    expect(useScanStore.getState().scan).toHaveBeenCalledTimes(1);
  });

  it("unlinks an Agent without starting a full Agent scan", async () => {
    vi.mocked(commands.unlinkAllAgentSkills).mockResolvedValueOnce(3);
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce([]);

    const result = await useMasterRepoStore.getState().unlinkAllAgentSkills("codex");

    expect(result).toBe(3);
    expect(commands.unlinkAllAgentSkills).toHaveBeenCalledWith("codex", {});
    expect(commands.getMasterSkills).toHaveBeenCalledTimes(1);
    expect(useScanStore.getState().scan).not.toHaveBeenCalled();
  });

  it("imports skill to master and triggers refresh and scan", async () => {
    vi.mocked(commands.importToMaster).mockResolvedValueOnce({ type: "success" });
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce([]);

    const importFromLocation = useMasterRepoStore.getState().importToMaster as (
      agentId: string,
      skillName: string,
      mode?: undefined,
      sourceLocation?: string,
    ) => Promise<{ type: "success" }>;
    const result = await importFromLocation(
      "claude_code",
      "test-skill",
      undefined,
      "C:\\Users\\tester\\.claude\\skills\\folder-name",
    );

    expect(result).toEqual({ type: "success" });
    expect(commands.importToMaster).toHaveBeenCalledWith(
      "claude_code",
      "test-skill",
      undefined,
      {},
      "C:\\Users\\tester\\.claude\\skills\\folder-name",
    );
    expect(commands.getMasterSkills).toHaveBeenCalled();
    expect(useScanStore.getState().scan).toHaveBeenCalled();
  });

  it("preserves the native import error instead of reporting a false content conflict", async () => {
    vi.mocked(commands.importToMaster).mockRejectedValueOnce(new Error("Import failed"));

    const result = await useMasterRepoStore.getState().importToMaster("claude_code", "test-skill");

    expect(result).toEqual({ type: "error", message: "Error: Import failed" });
    expect(useMasterRepoStore.getState().error).toBe("Error: Import failed");
  });

  it("rethrows the native install error so the UI can show its actual cause", async () => {
    vi.mocked(commands.installSkillToMaster).mockRejectedValueOnce(
      new Error("Git executable was not found"),
    );

    await expect(
      useMasterRepoStore.getState().installSkillToMaster("find-skills", "vercel-labs/skills"),
    ).rejects.toThrow("Git executable was not found");
    expect(useMasterRepoStore.getState().error).toBe("Error: Git executable was not found");
  });

  it("deletes an Agent skill and requests a fresh post-mutation scan", async () => {
    vi.mocked(commands.deleteAgentSkill).mockResolvedValueOnce(true);
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce([]);

    const result = await useMasterRepoStore.getState().deleteAgentSkill("codex", "test-skill");

    expect(result).toBe(true);
    expect(commands.deleteAgentSkill).toHaveBeenCalledWith("codex", "test-skill", {});
    expect(commands.getMasterSkills).toHaveBeenCalledTimes(1);
    expect(useScanStore.getState().scan).toHaveBeenCalledWith({ fresh: true });
  });
});
