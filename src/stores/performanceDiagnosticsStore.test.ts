import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ipc/commands", () => ({
  getPerformanceDiagnosticsEnabled: vi.fn(),
  setPerformanceDiagnosticsEnabled: vi.fn(),
  getPerformanceDiagnosticsSummary: vi.fn(),
  exportPerformanceDiagnostics: vi.fn(),
  clearPerformanceDiagnostics: vi.fn(),
}));

import * as commands from "../ipc/commands";
import { usePerformanceDiagnosticsStore } from "./performanceDiagnosticsStore";

const disabledSummary = {
  enabled: false,
  report_count: 0,
  newest_event_at_ms: null,
  report_directory_label: "~/.asm/diagnostics",
};

const enabledSummary = {
  enabled: true,
  report_count: 2,
  newest_event_at_ms: 42,
  report_directory_label: "~/.asm/diagnostics",
};

describe("performanceDiagnosticsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePerformanceDiagnosticsStore.setState({ enabled: false, summary: null });
  });

  it("hydrates the persisted enabled state before loading the report summary", async () => {
    vi.mocked(commands.getPerformanceDiagnosticsEnabled).mockResolvedValueOnce(true);
    vi.mocked(commands.getPerformanceDiagnosticsSummary).mockResolvedValueOnce(enabledSummary);

    await usePerformanceDiagnosticsStore.getState().hydrate();

    expect(vi.mocked(commands.getPerformanceDiagnosticsEnabled).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(commands.getPerformanceDiagnosticsSummary).mock.invocationCallOrder[0]);
    expect(usePerformanceDiagnosticsStore.getState()).toMatchObject({ enabled: true, summary: enabledSummary });
  });

  it("refreshes the summary after enabling diagnostics", async () => {
    vi.mocked(commands.setPerformanceDiagnosticsEnabled).mockResolvedValueOnce(undefined);
    vi.mocked(commands.getPerformanceDiagnosticsSummary).mockResolvedValueOnce(enabledSummary);

    await usePerformanceDiagnosticsStore.getState().setEnabled(true);

    expect(commands.setPerformanceDiagnosticsEnabled).toHaveBeenCalledWith(true);
    expect(usePerformanceDiagnosticsStore.getState()).toMatchObject({ enabled: true, summary: enabledSummary });
  });

  it("refreshes the summary after exporting a report", async () => {
    vi.mocked(commands.exportPerformanceDiagnostics).mockResolvedValueOnce(undefined);
    vi.mocked(commands.getPerformanceDiagnosticsSummary).mockResolvedValueOnce(disabledSummary);

    await usePerformanceDiagnosticsStore.getState().exportReport("/tmp/diagnostics.jsonl");

    expect(commands.exportPerformanceDiagnostics).toHaveBeenCalledWith("/tmp/diagnostics.jsonl");
    expect(usePerformanceDiagnosticsStore.getState().summary).toEqual(disabledSummary);
  });

  it("refreshes the summary after clearing reports", async () => {
    vi.mocked(commands.clearPerformanceDiagnostics).mockResolvedValueOnce(undefined);
    vi.mocked(commands.getPerformanceDiagnosticsSummary).mockResolvedValueOnce(disabledSummary);

    await usePerformanceDiagnosticsStore.getState().clearReports();

    expect(commands.clearPerformanceDiagnostics).toHaveBeenCalled();
    expect(usePerformanceDiagnosticsStore.getState().summary).toEqual(disabledSummary);
  });
});
