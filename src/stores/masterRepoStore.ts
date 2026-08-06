import { create } from "zustand";
import { getMasterSkills, toggleAgentSkill, toggleAgentSkillsBatch, unlinkAllAgentSkills, importToMaster, installSkillToMaster, deleteMasterSkill, replaceAgentLocalSkillWithSymlink, deleteAgentSkill } from "../ipc/commands";
import type { ImportMode, ImportResult, MasterSkillReport } from "../ipc/types";
import { useAgentConfigStore } from "./agentConfigStore";
import { useScanStore } from "./scanStore";

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
  importToMaster: (agentId: string, skillName: string, mode?: ImportMode) => Promise<ImportResult>;
  installSkillToMaster: (skillName: string, source?: string, sourceSubdir?: string) => Promise<string | null>;
  deleteMasterSkill: (skillName: string) => Promise<string[]>;
}

export const useMasterRepoStore = create<MasterRepoState>((set, get) => ({
  skills: [],
  loading: false,
  error: null,

  fetchMasterSkills: async () => {
    set({ loading: true, error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const skills = await getMasterSkills(customPaths);
      set({ skills });
    } catch (err) {
      set({ error: String(err) });
    } finally {
      set({ loading: false });
    }
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
      if (result) await Promise.all([get().fetchMasterSkills(), useScanStore.getState().scan()]);
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
      await Promise.all([get().fetchMasterSkills(), useScanStore.getState().scan()]);
      return result;
    } catch (err) { set({ error: String(err) }); return null; }
  },

  importToMaster: async (agentId: string, skillName: string, mode?: ImportMode) => {
    set({ error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const result = await importToMaster(agentId, skillName, mode, customPaths);
      await Promise.all([
        get().fetchMasterSkills(),
        useScanStore.getState().scan(),
      ]);
      return result;
    } catch (err) {
      set({ error: String(err) });
      return { type: "conflict", skill_name: skillName, existing_fingerprint: "", incoming_fingerprint: "" };
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
      return null;
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
