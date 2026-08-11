import { create } from "zustand";
import { scanAgents } from "../ipc/commands";
import { traceDiagnosticRequest } from "../ipc/performanceTrace";
import type { ScanReport } from "../ipc/types";
import { useAgentConfigStore } from "./agentConfigStore";

let inFlightScan: Promise<void> | null = null;

interface ScanState {
  report: ScanReport | null;
  scanning: boolean;
  error: string | null;
  scan: () => Promise<void>;
}

export const useScanStore = create<ScanState>((set) => ({
  report: null,
  scanning: false,
  error: null,
  scan: () => {
    if (inFlightScan) return inFlightScan;

    set({ scanning: true, error: null });
    inFlightScan = (async () => {
      try {
        const customPaths = useAgentConfigStore.getState().customPaths;
        set({ report: await traceDiagnosticRequest("scan_agents", (diagnosticContext) => scanAgents(customPaths, diagnosticContext)) });
      } catch (error) {
        set({ error: String(error) });
      } finally {
        set({ scanning: false });
      }
    })().finally(() => {
      inFlightScan = null;
    });

    return inFlightScan;
  },
}));
