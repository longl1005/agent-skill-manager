import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMasterRepoStore } from "./masterRepoStore";
import { useAgentConfigStore } from "./agentConfigStore";
import { useScanStore } from "./scanStore";
import * as commands from "../ipc/commands";

vi.mock("../ipc/commands", () => ({
  getMasterSkills: vi.fn(),
  toggleAgentSkill: vi.fn(),
  importToMaster: vi.fn(),
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

    expect(commands.getMasterSkills).toHaveBeenCalledWith({ claude_code: "/custom/path" });
    const state = useMasterRepoStore.getState();
    expect(state.skills).toEqual(mockSkills);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
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

  it("imports skill to master and triggers refresh and scan", async () => {
    vi.mocked(commands.importToMaster).mockResolvedValueOnce(true);
    vi.mocked(commands.getMasterSkills).mockResolvedValueOnce([]);

    const result = await useMasterRepoStore.getState().importToMaster("claude_code", "test-skill");

    expect(result).toBe(true);
    expect(commands.importToMaster).toHaveBeenCalledWith("claude_code", "test-skill", {});
    expect(commands.getMasterSkills).toHaveBeenCalled();
    expect(useScanStore.getState().scan).toHaveBeenCalled();
  });

  it("handles importToMaster failure", async () => {
    vi.mocked(commands.importToMaster).mockRejectedValueOnce(new Error("Import failed"));

    const result = await useMasterRepoStore.getState().importToMaster("claude_code", "test-skill");

    expect(result).toBe(false);
    expect(useMasterRepoStore.getState().error).toBe("Error: Import failed");
  });
});
