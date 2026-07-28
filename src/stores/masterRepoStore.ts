import { create } from "zustand";
import { getMasterSkills, toggleAgentSkill, importToMaster, installSkillToMaster, deleteMasterSkill } from "../ipc/commands";
import type { ImportMode, ImportResult, MasterSkillReport } from "../ipc/types";
import { useAgentConfigStore } from "./agentConfigStore";
import { useScanStore } from "./scanStore";

export interface MasterRepoState {
  skills: MasterSkillReport[];
  loading: boolean;
  error: string | null;
  fetchMasterSkills: () => Promise<void>;
  toggleAgentSkill: (agentId: string, skillName: string, enable: boolean) => Promise<boolean>;
  importToMaster: (agentId: string, skillName: string, mode?: ImportMode) => Promise<ImportResult>;
  installSkillToMaster: (skillName: string, source?: string) => Promise<string | null>;
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

  installSkillToMaster: async (skillName: string, source?: string) => {
    set({ error: null });
    try {
      const customPaths = useAgentConfigStore.getState().customPaths;
      const result = await installSkillToMaster(skillName, source, customPaths);
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
