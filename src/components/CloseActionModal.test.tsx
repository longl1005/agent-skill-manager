import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { hideMainWindowMock, exitAppMock } = vi.hoisted(() => ({
  hideMainWindowMock: vi.fn().mockResolvedValue(undefined),
  exitAppMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../ipc/commands", () => ({
  hideMainWindow: hideMainWindowMock,
  exitApp: exitAppMock,
  setTrayVisible: vi.fn().mockResolvedValue(undefined),
}));

import { CloseActionModal } from "./CloseActionModal";
import { useGeneralSettingsStore } from "../stores/generalSettingsStore";
import { useI18nStore } from "../stores/i18nStore";

describe("CloseActionModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useI18nStore.setState({ lang: "zh" });
    useGeneralSettingsStore.setState({
      closeAction: "ask",
      isCloseConfirmOpen: false,
    });
  });

  it("does not render when closed", () => {
    render(<CloseActionModal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders when open and closes on cancel", () => {
    useGeneralSettingsStore.setState({ isCloseConfirmOpen: true });
    render(<CloseActionModal />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("关闭应用")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(useGeneralSettingsStore.getState().isCloseConfirmOpen).toBe(false);
  });

  it("minimizes window to tray when minimize option is confirmed", async () => {
    useGeneralSettingsStore.setState({ isCloseConfirmOpen: true });
    render(<CloseActionModal />);

    const minimizeRadio = screen.getByRole("radio", { name: /最小化到系统托盘/i });
    expect(minimizeRadio).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    expect(hideMainWindowMock).toHaveBeenCalled();
    expect(useGeneralSettingsStore.getState().isCloseConfirmOpen).toBe(false);
  });

  it("exits app and remembers choice when quit with remember checkbox is confirmed", async () => {
    useGeneralSettingsStore.setState({ isCloseConfirmOpen: true });
    render(<CloseActionModal />);

    const quitRadio = screen.getByRole("radio", { name: /直接退出应用/i });
    fireEvent.click(quitRadio);
    expect(quitRadio).toBeChecked();

    const rememberCheckbox = screen.getByRole("checkbox", { name: /记住我的选择/i });
    fireEvent.click(rememberCheckbox);
    expect(rememberCheckbox).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "确定" }));
    expect(exitAppMock).toHaveBeenCalled();
    expect(useGeneralSettingsStore.getState().closeAction).toBe("quit");
    expect(useGeneralSettingsStore.getState().isCloseConfirmOpen).toBe(false);
  });
});
