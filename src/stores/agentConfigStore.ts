import { create } from "zustand";
import { getAgentConfigs, setAgentConfig, setAgentSortOrder } from "../ipc/commands";

export function orderAgents<T extends { id?: string; agent_id?: string }>(agents: T[], orderedIds: string[]): T[] {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...agents].sort((left, right) => {
    const leftId = left.id ?? left.agent_id ?? "";
    const rightId = right.id ?? right.agent_id ?? "";
    return (positions.get(leftId) ?? Number.MAX_SAFE_INTEGER) - (positions.get(rightId) ?? Number.MAX_SAFE_INTEGER);
  });
}

export interface AgentConfigStore {
  customPaths: Record<string, string>;
  disabledAgentIds: string[];
  agentOrder: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setCustomPath: (agentId: string, path: string) => void;
  clearCustomPath: (agentId: string) => void;
  resetAll: () => void;
  setAgentDisabled: (agentId: string, disabled: boolean) => void;
  setAgentOrder: (agentIds: string[]) => void;
}

export const useAgentConfigStore = create<AgentConfigStore>((set, get) => ({
  customPaths: {}, disabledAgentIds: [], agentOrder: [], hydrated: false,
  hydrate: async () => {
    const rows = await getAgentConfigs(); const customPaths: Record<string, string> = {}; const disabledAgentIds: string[] = [];
    rows.forEach((row) => { if (row.custom_path) customPaths[row.agent_id] = row.custom_path; if (row.disabled) disabledAgentIds.push(row.agent_id); });
    set({ customPaths, disabledAgentIds, agentOrder: rows.filter((row) => row.sort_order !== null).sort((left, right) => left.sort_order! - right.sort_order!).map((row) => row.agent_id), hydrated: true });
  },
  setCustomPath: (agentId, path) => { const customPaths = { ...get().customPaths, [agentId]: path.trim() }; set({ customPaths }); void setAgentConfig(agentId, path.trim(), get().disabledAgentIds.includes(agentId)); },
  clearCustomPath: (agentId) => { const customPaths = { ...get().customPaths }; delete customPaths[agentId]; set({ customPaths }); void setAgentConfig(agentId, null, get().disabledAgentIds.includes(agentId)); },
  resetAll: () => { Object.keys(get().customPaths).forEach((id) => void setAgentConfig(id, null, get().disabledAgentIds.includes(id))); set({ customPaths: {} }); },
  setAgentDisabled: (agentId, disabled) => { const disabledAgentIds = disabled ? [...new Set([...get().disabledAgentIds, agentId])] : get().disabledAgentIds.filter((id) => id !== agentId); set({ disabledAgentIds }); void setAgentConfig(agentId, get().customPaths[agentId] ?? null, disabled); },
  setAgentOrder: (agentIds) => { set({ agentOrder: agentIds }); void setAgentSortOrder(agentIds).catch(() => undefined); },
}));
