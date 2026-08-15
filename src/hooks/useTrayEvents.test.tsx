import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrayEventBridge } from "./useTrayEvents";
import { useGeneralSettingsStore } from "../stores/generalSettingsStore";

const { listenMock, setTrayLanguageMock, setTrayStatisticsMock, hideMainWindowMock, exitAppMock } = vi.hoisted(() => ({
  listenMock: vi.fn(),
  setTrayLanguageMock: vi.fn(),
  setTrayStatisticsMock: vi.fn(),
  hideMainWindowMock: vi.fn().mockResolvedValue(undefined),
  exitAppMock: vi.fn().mockResolvedValue(undefined),
}));

let trayHandlers: Record<string, () => void> = {};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

vi.mock("../stores/i18nStore", () => ({
  useI18nStore: (selector: (state: { lang: "zh" | "en" }) => unknown) => selector({ lang: "en" }),
}));

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: (selector: (state: { skills: Array<{ name: string }> }) => unknown) =>
    selector({ skills: [{ name: "skill-a" }, { name: "skill-b" }] }),
}));

vi.mock("../stores/scanStore", () => ({
  useScanStore: (selector: (state: { report: { agents: Array<{ agent_id: string; detection_status: string }> } }) => unknown) =>
    selector({
      report: {
        agents: [
          { agent_id: "codex", detection_status: "Detected" },
          { agent_id: "disabled", detection_status: "Partial" },
          { agent_id: "missing", detection_status: "NotDetected" },
        ],
      },
    }),
}));

vi.mock("../stores/agentConfigStore", () => ({
  useAgentConfigStore: (selector: (state: { disabledAgentIds: string[] }) => unknown) =>
    selector({ disabledAgentIds: ["disabled"] }),
}));

vi.mock("../ipc/commands", () => ({
  setTrayLanguage: setTrayLanguageMock,
  setTrayStatistics: setTrayStatisticsMock,
  hideMainWindow: hideMainWindowMock,
  exitApp: exitAppMock,
}));

function renderBridge() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <TrayEventBridge />
      <Routes>
        <Route path="/" element={<p>Dashboard</p>} />
        <Route path="/library" element={<p>Master Skill Library</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TrayEventBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    trayHandlers = {};
    setTrayLanguageMock.mockResolvedValue(undefined);
    setTrayStatisticsMock.mockResolvedValue(undefined);
    listenMock.mockImplementation((eventName: string, handler: () => void) => {
      trayHandlers[eventName] = handler;
      return Promise.resolve(vi.fn());
    });
  });

  it("opens the master skill library when the tray requests it", async () => {
    renderBridge();

    await waitFor(() => expect(trayHandlers["tray:open-library"]).toBeDefined());
    trayHandlers["tray:open-library"]();

    expect(await screen.findByText("Master Skill Library")).toBeVisible();
  });

  it("synchronizes the English menu labels when English is active", async () => {
    renderBridge();

    await waitFor(() => expect(setTrayLanguageMock).toHaveBeenCalledWith("en"));
  });

  it("synchronizes master skill and connected agent counts to the tray", async () => {
    renderBridge();

    await waitFor(() => expect(setTrayStatisticsMock).toHaveBeenCalledWith("en", 2, 1));
  });

  it("cleans a listener that resolves after unmount without waiting for another registration", async () => {
    const libraryRegistration = createDeferred<() => void>();
    const stopLibrary = vi.fn();
    listenMock.mockImplementationOnce(() => libraryRegistration.promise);

    const { unmount } = renderBridge();
    unmount();

    libraryRegistration.resolve(stopLibrary);
    await waitFor(() => expect(stopLibrary).toHaveBeenCalledOnce());
  });

  it("reports tray language synchronization failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const languageError = new Error("language sync failed");
    setTrayLanguageMock.mockRejectedValueOnce(languageError);
    renderBridge();

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(
        "[tray] Failed to synchronize tray language",
        languageError
      )
    );
    consoleError.mockRestore();
  });

  it("handles window:close-requested by opening confirmation when closeAction is ask", async () => {
    useGeneralSettingsStore.setState({ closeAction: "ask", isCloseConfirmOpen: false });
    renderBridge();

    await waitFor(() => expect(trayHandlers["window:close-requested"]).toBeDefined());
    trayHandlers["window:close-requested"]();

    expect(useGeneralSettingsStore.getState().isCloseConfirmOpen).toBe(true);
  });

  it("handles window:close-requested by minimizing when closeAction is minimize", async () => {
    useGeneralSettingsStore.setState({ closeAction: "minimize", isCloseConfirmOpen: false });
    renderBridge();

    await waitFor(() => expect(trayHandlers["window:close-requested"]).toBeDefined());
    trayHandlers["window:close-requested"]();

    expect(hideMainWindowMock).toHaveBeenCalled();
  });

  it("handles window:close-requested by exiting when closeAction is quit", async () => {
    useGeneralSettingsStore.setState({ closeAction: "quit", isCloseConfirmOpen: false });
    renderBridge();

    await waitFor(() => expect(trayHandlers["window:close-requested"]).toBeDefined());
    trayHandlers["window:close-requested"]();

    expect(exitAppMock).toHaveBeenCalled();
  });
});

