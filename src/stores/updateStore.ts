import { create } from "zustand";
import {
  findAvailableUpdate,
  installAvailableUpdate,
  type AvailableUpdate,
  type UpdateProgress,
} from "../services/updateService";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "installing" | "upToDate" | "error";

type UpdateStore = {
  status: UpdateStatus;
  update: AvailableUpdate | null;
  progress: UpdateProgress | null;
  error: string | null;
  checkForUpdates: (silent: boolean) => Promise<void>;
  dismissUpdate: () => void;
  installUpdate: () => Promise<void>;
};

const messageFor = (error: unknown) => error instanceof Error ? error.message : String(error);

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: "idle",
  update: null,
  progress: null,
  error: null,
  checkForUpdates: async (silent) => {
    if (["checking", "downloading", "installing"].includes(get().status)) return;
    set({ status: "checking", error: null });
    try {
      const update = await findAvailableUpdate();
      set(update ? { status: "available", update } : { status: "upToDate", update: null });
    } catch (error) {
      set(silent ? { status: "idle", error: null } : { status: "error", error: messageFor(error) });
    }
  },
  dismissUpdate: () => set({ status: "idle", update: null, progress: null, error: null }),
  installUpdate: async () => {
    const update = get().update;
    if (!update || ["downloading", "installing"].includes(get().status)) return;
    set({ status: "downloading", progress: { phase: "downloading", downloaded: 0, total: null }, error: null });
    try {
      await installAvailableUpdate(update, (progress) => set({ status: progress.phase, progress }));
    } catch (error) {
      set({ status: "error", error: messageFor(error) });
    }
  },
}));
