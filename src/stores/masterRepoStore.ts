import { create } from "zustand";
import { getMasterSkills, toggleAgentSkill, toggleAgentSkillsBatch, unlinkAllAgentSkills, importToMaster, installSkillToMaster, deleteMasterSkill, replaceAgentLocalSkillWithSymlink, deleteAgentSkill } from "../ipc/commands";
import { traceDiagnosticRequest } from "../ipc/performanceTrace";
import type { ImportMode, ImportResult, MasterSkillReport } from "../ipc/types";
import { useAgentConfigStore } from "./agentConfigStore";
import { useScanStore } from "./scanStore";

let inFlightMasterSkillsFetch: Promise<void> | null = null;

export interface MasterRepoState {
  skills: MasterSkillReport[];
  loading: boolean;
  error: string | null;
  fetchMasterSkills: () => Promise<void>;
  toggleAgentSkill: (agentId: string, skillName: string, enable: boolean) => Promise<boolean>;
  toggleAgentSkillsBatch: (agentIds: string[], skillName: string, enable: boolean) => Promise<number>;
  replaceAgentLocalSkillWithSymlink: (agentId: string, skillName: string) => Promise<boolean>;
  deleteAgentSkill: (agentId: string, skillName: string) => Promise<boolean>;
  unlinkAllAgentSkills: (agentId: string) => Promise<number | null>;
  importToMaster: (agentId: string, skillName: string, mode?: ImportMode, sourceLocation?: string) => Promise<ImportResult>;
  installSkillToMaster: (skillName: string, source?: string, sourceSubdir?: string) => Promise<string | null>;
  deleteMasterSkill: (skillName: string) => Promise<string[]>;
}

export const useMasterRepoStore = create<MasterRepoState>((set, get) => ({
  skills: [],
  loading: false,
  error: null,

  fetchMasterSkills: () => {
    if (inFlightMasterSkillsFetch) return inFlightMasterSkillsFetch;

    set({ loading: true, error: null });
    inFlightMasterSkillsFetch = (async () => {
      try {
        const customPaths = useAgentConfigStore.getState().customPaths;
        const skills = await traceDiagnosticRequest("get_master_skills", (diagnosticContext) => getMasterSkills(customPaths, diagnosticContext));
        set({ skills });
      } catch (err) {
        set({ error: String(err) });
      } finally {
        set({ loading: false });
      }
    })().finally(() => {
      inFlightMasterSkillsFetch = null;
    });

    return inFlightMasterSkillsFetch;
  },

  toggleAgentSkill: async (agentId: string, skillName: string, enable: boolean) => {
    set({ error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const result = await toggleAgentSkill(agentId, skillName, enable, customPaths);
      await Promise.all([
        get().fetchMasterSkills(),
        useScanStore.getState().scan(),
      ]);
      return result;
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },
  toggleAgentSkillsBatch: async (agentIds, skillName, enable) => {
    if (agentIds.length === 0) return 0;
    set({ error: null });
    try {
      const result = await toggleAgentSkillsBatch(
        agentIds,
        skillName,
        enable,
        useAgentConfigStore.getState().customPaths,
      );
      await Promise.all([get().fetchMasterSkills(), useScanStore.getState().scan()]);
      return result;
    } catch (err) {
      set({ error: String(err) });
      return 0;
    }
  },
  replaceAgentLocalSkillWithSymlink: async (agentId, skillName) => {
    set({ error: null });
    try {
      const result = await replaceAgentLocalSkillWithSymlink(agentId, skillName, useAgentConfigStore.getState().customPaths);
      if (result) await Promise.all([get().fetchMasterSkills(), useScanStore.getState().scan()]);
      return result;
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },
  deleteAgentSkill: async (agentId, skillName) => {
    set({ error: null });
    try {
      const result = await deleteAgentSkill(agentId, skillName, useAgentConfigStore.getState().customPaths);
      if (result) await Promise.all([
        get().fetchMasterSkills(),
        useScanStore.getState().scan({ fresh: true }),
      ]);
      return result;
    } catch (err) {
      set({ error: String(err) });
      return false;
    }
  },
  unlinkAllAgentSkills: async (agentId) => {
    set({ error: null });
    try {
      const result = await unlinkAllAgentSkills(agentId, useAgentConfigStore.getState().customPaths);
      await get().fetchMasterSkills();
      return result;
    } catch (err) { set({ error: String(err) }); return null; }
  },

  importToMaster: async (agentId: string, skillName: string, mode?: ImportMode, sourceLocation?: string) => {
    set({ error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const result = await importToMaster(agentId, skillName, mode, customPaths, sourceLocation);
      await Promise.all([
        get().fetchMasterSkills(),
        useScanStore.getState().scan(),
      ]);
      return result;
    } catch (err) {
      const message = String(err);
      set({ error: message });
      return { type: "error", message };
    }
  },

  installSkillToMaster: async (skillName: string, source?: string, sourceSubdir?: string) => {
    set({ error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const result = await installSkillToMaster(skillName, source, sourceSubdir, customPaths);
      await Promise.all([
        get().fetchMasterSkills(),
        useScanStore.getState().scan(),
      ]);
      return result;
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  deleteMasterSkill: async (skillName: string) => {
    set({ error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const removedAgents = await deleteMasterSkill(skillName, customPaths);
      await Promise.all([
        get().fetchMasterSkills(),
        useScanStore.getState().scan(),
      ]);
      return removedAgents;
    } catch (err) {
      set({ error: String(err) });
      return [];
    }
  },
}));
