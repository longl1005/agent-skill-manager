import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ipc/commands", () => ({
  setTrayVisible: vi.fn().mockResolvedValue(undefined),
}));

import { setTrayVisible } from "../ipc/commands";
import { useGeneralSettingsStore } from "./generalSettingsStore";

describe("generalSettingsStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    useGeneralSettingsStore.setState({
      closeAction: "ask",
      showTrayIcon: true,
      fontSize: "medium",
      isCloseConfirmOpen: false,
    });
  });

  it("defaults to ask close action, visible tray icon, and medium font size", () => {
    const state = useGeneralSettingsStore.getState();
    expect(state.closeAction).toBe("ask");
    expect(state.showTrayIcon).toBe(true);
    expect(state.fontSize).toBe("medium");
    expect(state.isCloseConfirmOpen).toBe(false);
  });

  it("updates and persists font size and applies DOM scaling", () => {
    useGeneralSettingsStore.getState().setFontSize("large");
    expect(useGeneralSettingsStore.getState().fontSize).toBe("large");
    expect(localStorage.getItem("asm_font_size")).toBe("large");
    expect(document.documentElement).toHaveAttribute("data-font-size", "large");

    useGeneralSettingsStore.getState().setFontSize("small");
    expect(useGeneralSettingsStore.getState().fontSize).toBe("small");
    expect(localStorage.getItem("asm_font_size")).toBe("small");
    expect(document.documentElement).toHaveAttribute("data-font-size", "small");
  });

  it("updates and persists close action", () => {
    useGeneralSettingsStore.getState().setCloseAction("minimize");
    expect(useGeneralSettingsStore.getState().closeAction).toBe("minimize");
    expect(localStorage.getItem("asm_close_action")).toBe("minimize");

    useGeneralSettingsStore.getState().setCloseAction("quit");
    expect(useGeneralSettingsStore.getState().closeAction).toBe("quit");
    expect(localStorage.getItem("asm_close_action")).toBe("quit");
  });

  it("updates tray visibility and invokes IPC command", () => {
    useGeneralSettingsStore.getState().setShowTrayIcon(false);
    expect(useGeneralSettingsStore.getState().showTrayIcon).toBe(false);
    expect(localStorage.getItem("asm_show_tray_icon")).toBe("false");
    expect(setTrayVisible).toHaveBeenCalledWith(false);

    useGeneralSettingsStore.getState().setShowTrayIcon(true);
    expect(useGeneralSettingsStore.getState().showTrayIcon).toBe(true);
    expect(localStorage.getItem("asm_show_tray_icon")).toBe("true");
    expect(setTrayVisible).toHaveBeenCalledWith(true);
  });

  it("opens and closes the close confirmation dialog", () => {
    useGeneralSettingsStore.getState().openCloseConfirm();
    expect(useGeneralSettingsStore.getState().isCloseConfirmOpen).toBe(true);

    useGeneralSettingsStore.getState().closeCloseConfirm();
    expect(useGeneralSettingsStore.getState().isCloseConfirmOpen).toBe(false);
  });
});
