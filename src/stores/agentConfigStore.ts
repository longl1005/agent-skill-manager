import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AgentConfigStore {
  customPaths: Record<string, string>;
  setCustomPath: (agentId: string, path: string) => void;
  clearCustomPath: (agentId: string) => void;
  resetAll: () => void;
}

export const useAgentConfigStore = create<AgentConfigStore>()(
  persist(
    (set) => ({
      customPaths: {},
      setCustomPath: (agentId: string, path: string) =>
        set((state) => ({
          customPaths: {
            ...state.customPaths,
            [agentId]: path.trim(),
          },
        })),
      clearCustomPath: (agentId: string) =>
        set((state) => {
          const next = { ...state.customPaths };
          delete next[agentId];
          return { customPaths: next };
        }),
      resetAll: () => set({ customPaths: {} }),
    }),
    {
      name: "asm_agent_custom_paths",
    }
  )
);
