import { create } from "zustand";
import { setTrayVisible } from "../ipc/commands";

export type CloseAction = "ask" | "minimize" | "quit";
export type FontSize = "small" | "medium" | "large" | "xlarge";

const CLOSE_ACTIONS: readonly CloseAction[] = ["ask", "minimize", "quit"];
const FONT_SIZES: readonly FontSize[] = ["small", "medium", "large", "xlarge"];

export interface GeneralSettingsState {
  closeAction: CloseAction;
  showTrayIcon: boolean;
  fontSize: FontSize;
  isCloseConfirmOpen: boolean;
  setCloseAction: (action: CloseAction) => void;
  setShowTrayIcon: (show: boolean) => void;
  setFontSize: (size: FontSize) => void;
  openCloseConfirm: () => void;
  closeCloseConfirm: () => void;
  initSettings: () => void;
}

function readCloseAction(key: string, fallback: CloseAction): CloseAction {
  const stored = localStorage.getItem(key) as CloseAction | null;
  return stored && CLOSE_ACTIONS.includes(stored) ? stored : fallback;
}

function readFontSize(key: string, fallback: FontSize): FontSize {
  const stored = localStorage.getItem(key) as FontSize | null;
  return stored && FONT_SIZES.includes(stored) ? stored : fallback;
}

function readBoolean(key: string, fallback: boolean): boolean {
  const stored = localStorage.getItem(key);
  if (stored === null) return fallback;
  return stored === "true";
}

export function applyFontSize(size: FontSize) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-font-size", size);
  let zoomLevel = 1.0;
  if (size === "small") {
    zoomLevel = 0.92;
  } else if (size === "medium") {
    zoomLevel = 1.0;
  } else if (size === "large") {
    zoomLevel = 1.08;
  } else if (size === "xlarge") {
    zoomLevel = 1.16;
  }
  document.documentElement.style.setProperty("--app-font-scale", String(zoomLevel));
  (document.documentElement.style as any).zoom = String(zoomLevel);
}

export const useGeneralSettingsStore = create<GeneralSettingsState>((set, get) => ({
  closeAction: readCloseAction("asm_close_action", "ask"),
  showTrayIcon: readBoolean("asm_show_tray_icon", true),
  fontSize: readFontSize("asm_font_size", "medium"),
  isCloseConfirmOpen: false,

  setCloseAction: (action: CloseAction) => {
    localStorage.setItem("asm_close_action", action);
    set({ closeAction: action });
  },

  setShowTrayIcon: (show: boolean) => {
    localStorage.setItem("asm_show_tray_icon", String(show));
    set({ showTrayIcon: show });
    void setTrayVisible(show).catch((error: unknown) => {
      console.error("[tray] Failed to toggle tray visibility", error);
    });
  },

  setFontSize: (size: FontSize) => {
    localStorage.setItem("asm_font_size", size);
    set({ fontSize: size });
    applyFontSize(size);
  },

  openCloseConfirm: () => set({ isCloseConfirmOpen: true }),
  closeCloseConfirm: () => set({ isCloseConfirmOpen: false }),

  initSettings: () => {
    const { showTrayIcon, fontSize } = get();
    applyFontSize(fontSize);
    void setTrayVisible(showTrayIcon).catch(() => undefined);
  },
}));
