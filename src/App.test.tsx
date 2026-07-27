import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const scanMock = vi.fn();
const fetchMasterSkillsMock = vi.fn();

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

describe("App Launch Auto-Scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("triggers scan and fetchMasterSkills on mount", () => {
    render(<App />);

    expect(scanMock).toHaveBeenCalled();
    expect(fetchMasterSkillsMock).toHaveBeenCalled();
  });
});
