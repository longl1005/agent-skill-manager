import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { useUiStore } from "./stores/uiStore";

const scanMock = vi.fn();
const fetchMasterSkillsMock = vi.fn();
const hydratePerformanceDiagnosticsMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock("./ipc/commands", () => ({
  setTrayLanguage: vi.fn().mockResolvedValue(undefined),
  setTrayStatistics: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./stores/scanStore", () => ({
  useScanStore: (selector?: (s: any) => any) => {
    const store = { scan: scanMock, report: null, scanning: false, error: null };
    return selector ? selector(store) : store;
  },
}));

vi.mock("./stores/masterRepoStore", () => ({
  useMasterRepoStore: (selector?: (s: any) => any) => {
    const store = { fetchMasterSkills: fetchMasterSkillsMock, skills: [], loading: false };
    return selector ? selector(store) : store;
  },
}));

vi.mock("./stores/performanceDiagnosticsStore", () => ({
  usePerformanceDiagnosticsStore: (selector?: (s: any) => any) => {
    const store = { hydrate: hydratePerformanceDiagnosticsMock };
    return selector ? selector(store) : store;
  },
}));

describe("App Launch Auto-Scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ sidebarCollapsed: false });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  it("hydrates performance diagnostics before triggering the launch scan", async () => {
    render(<App />);

    await waitFor(() => expect(hydratePerformanceDiagnosticsMock).toHaveBeenCalled());
    await waitFor(() => expect(scanMock).toHaveBeenCalled());
    expect(fetchMasterSkillsMock).toHaveBeenCalled();
  });

  it("moves the sidebar toggle into the title bar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /收起菜单|Collapse menu/ }));

    expect(document.querySelector(".app-shell")).toHaveClass("sidebar-collapsed");
    expect(screen.getByRole("button", { name: /展开菜单|Expand menu/ })).toBeVisible();
  });
});
