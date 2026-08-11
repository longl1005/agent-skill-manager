import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../ipc/commands", () => ({
  scanAgents: vi.fn(),
}));

vi.mock("../ipc/performanceTrace", () => ({
  traceDiagnosticRequest: (_operation: string, request: (context?: undefined) => Promise<unknown>) => request(undefined),
}));

import * as commands from "../ipc/commands";
import { useAgentConfigStore } from "./agentConfigStore";
import { useScanStore } from "./scanStore";

const report = {
  scan_id: "scan-1",
  started_at: 1,
  completed_at: 2,
  total_skills: 0,
  total_issues: 0,
  agents: [],
};

describe("scanStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentConfigStore.setState({ customPaths: {} });
    useScanStore.setState({ report: null, scanning: false, error: null });
  });

  it("shares an in-flight scan to avoid rescanning the same Agent directories", async () => {
    let resolveScan: ((value: typeof report) => void) | undefined;
    vi.mocked(commands.scanAgents).mockImplementationOnce(
      () => new Promise((resolve) => { resolveScan = resolve; }),
    );

    const firstRequest = useScanStore.getState().scan();
    const secondRequest = useScanStore.getState().scan();

    expect(commands.scanAgents).toHaveBeenCalledTimes(1);

    resolveScan?.(report);
    await Promise.all([firstRequest, secondRequest]);
    expect(useScanStore.getState().report).toEqual(report);
  });
});
