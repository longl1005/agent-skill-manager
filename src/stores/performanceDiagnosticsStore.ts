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
  hydrate: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  exportReport: (destination: string) => Promise<void>;
  clearReports: () => Promise<void>;
}

export const usePerformanceDiagnosticsStore = create<PerformanceDiagnosticsState>((set) => ({
  enabled: false,
  summary: null,
  hydrate: async () => {
    const enabled = await getPerformanceDiagnosticsEnabled();
    const summary = await getPerformanceDiagnosticsSummary();
    set({ enabled, summary });
  },
  setEnabled: async (enabled) => {
    await setPerformanceDiagnosticsEnabled(enabled);
    const summary = await getPerformanceDiagnosticsSummary();
    set({ enabled, summary });
  },
  exportReport: async (destination) => {
    await exportPerformanceDiagnostics(destination);
    const summary = await getPerformanceDiagnosticsSummary();
    set({ summary });
  },
  clearReports: async () => {
    await clearPerformanceDiagnostics();
    const summary = await getPerformanceDiagnosticsSummary();
    set({ summary });
  },
}));
