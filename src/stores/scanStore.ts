import { create } from "zustand";
import { scanAgents } from "../ipc/commands";
import type { ScanReport } from "../ipc/types";

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
  scan: async () => {
    set({ scanning: true, error: null });
    try {
      set({ report: await scanAgents() });
    } catch (error) {
      set({ error: String(error) });
    } finally {
      set({ scanning: false });
    }
  },
}));
