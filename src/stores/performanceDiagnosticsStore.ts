import { create } from "zustand";
import {
  clearPerformanceDiagnostics,
  exportPerformanceDiagnostics,
  getPerformanceDiagnosticsEnabled,
  getPerformanceDiagnosticsSummary,
  setPerformanceDiagnosticsEnabled,
} from "../ipc/commands";
import type { PerformanceDiagnosticsSummary } from "../ipc/types";

export interface PerformanceDiagnosticsState {
  enabled: boolean;
  summary: PerformanceDiagnosticsSummary | null;
  refreshSummary: () => Promise<void>;
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  exportReport: (destination: string) => Promise<void>;
  clearReports: () => Promise<void>;
}

export const usePerformanceDiagnosticsStore = create<PerformanceDiagnosticsState>((set, get) => ({
  enabled: false,
  summary: null,
  refreshSummary: async () => {
    const summary = await getPerformanceDiagnosticsSummary();
    set({ summary });
  },
  hydrate: async () => {
    const enabled = await getPerformanceDiagnosticsEnabled();
    set({ enabled });
    await get().refreshSummary();
  },
  setEnabled: async (enabled) => {
    await setPerformanceDiagnosticsEnabled(enabled);
    set({ enabled });
    await get().refreshSummary();
  },
  exportReport: async (destination) => {
    await exportPerformanceDiagnostics(destination);
    await get().refreshSummary();
  },
  clearReports: async () => {
    await clearPerformanceDiagnostics();
    await get().refreshSummary();
  },
}));
