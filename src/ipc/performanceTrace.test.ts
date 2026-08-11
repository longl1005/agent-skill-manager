import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../stores/performanceDiagnosticsStore", () => ({
  usePerformanceDiagnosticsStore: {
    getState: vi.fn(),
  },
}));

import { traceDiagnosticRequest, getInFlightCount } from "./performanceTrace";
import { usePerformanceDiagnosticsStore } from "../stores/performanceDiagnosticsStore";
import type { PerformanceDiagnosticsState } from "../stores/performanceDiagnosticsStore";

function diagnosticState(enabled: boolean): PerformanceDiagnosticsState {
  return {
    enabled,
    summary: null,
    refreshSummary: vi.fn().mockResolvedValue(undefined),
    hydrate: vi.fn(),
    setEnabled: vi.fn(),
    exportReport: vi.fn(),
    clearReports: vi.fn(),
  } as unknown as PerformanceDiagnosticsState;
}

describe("traceDiagnosticRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePerformanceDiagnosticsStore.getState).mockReturnValue(diagnosticState(true));
  });

  it("assigns a unique operation ID and current same-operation count", async () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000001");
    const request = vi.fn().mockResolvedValue("completed");

    await expect(traceDiagnosticRequest("scan_agents", request)).resolves.toBe("completed");

    expect(request).toHaveBeenCalledWith({ operationId: "00000000-0000-4000-8000-000000000001", inFlightSameOperation: 1 });
    expect(getInFlightCount("scan_agents")).toBe(0);
  });

  it("refreshes the diagnostic summary after a traced request completes", async () => {
    const state = diagnosticState(true);
    vi.mocked(usePerformanceDiagnosticsStore.getState).mockReturnValue(state);

    await traceDiagnosticRequest("scan_agents", async () => "completed");

    expect(state.refreshSummary).toHaveBeenCalledOnce();
  });

  it("decrements the in-flight count when the traced request rejects", async () => {
    await expect(traceDiagnosticRequest("scan_agents", async () => Promise.reject(new Error("failed")))).rejects.toThrow("failed");

    expect(getInFlightCount("scan_agents")).toBe(0);
  });

  it("does not attach diagnostic context while diagnostics are disabled", async () => {
    vi.mocked(usePerformanceDiagnosticsStore.getState).mockReturnValue(diagnosticState(false));
    const request = vi.fn().mockResolvedValue("completed");

    await traceDiagnosticRequest("get_master_skills", request);

    expect(request).toHaveBeenCalledWith(undefined);
  });
});
