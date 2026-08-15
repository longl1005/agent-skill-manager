import { create } from "zustand";
import { getNetworkProxy, setNetworkProxy } from "../ipc/commands";

export interface ProxyState {
  proxy: string;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetchProxy: () => Promise<void>;
  saveProxy: (proxy: string) => Promise<void>;
}

export const useProxyStore = create<ProxyState>((set) => ({
  proxy: "",
  loading: false,
  saving: false,
  error: null,

  fetchProxy: async () => {
    set({ loading: true, error: null });
    try {
      const value = await getNetworkProxy();
      set({ proxy: value ?? "", loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  saveProxy: async (proxy: string) => {
    set({ saving: true, error: null });
    try {
      const trimmed = proxy.trim();
      await setNetworkProxy(trimmed.length > 0 ? trimmed : null);
      set({ proxy: trimmed, saving: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), saving: false });
      throw err;
    }
  },
}));
