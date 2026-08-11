import type { DiagnosticContext } from "./types";
import { usePerformanceDiagnosticsStore } from "../stores/performanceDiagnosticsStore";

type DiagnosticOperation = "scan_agents" | "get_master_skills";

const inFlightCounts = new Map<DiagnosticOperation, number>();

function incrementInFlight(operation: DiagnosticOperation): number {
  const count = getInFlightCount(operation) + 1;
  inFlightCounts.set(operation, count);
  return count;
}

function decrementInFlight(operation: DiagnosticOperation): void {
  const count = getInFlightCount(operation) - 1;
  if (count > 0) {
    inFlightCounts.set(operation, count);
  } else {
    inFlightCounts.delete(operation);
  }
}

export function getInFlightCount(operation: DiagnosticOperation): number {
  return inFlightCounts.get(operation) ?? 0;
}

export async function traceDiagnosticRequest<T>(
  operation: DiagnosticOperation,
  request: (context?: DiagnosticContext) => Promise<T>,
): Promise<T> {
  if (!usePerformanceDiagnosticsStore.getState().enabled) {
    return request(undefined);
  }

  const inFlightSameOperation = incrementInFlight(operation);
  try {
    return await request({ operationId: crypto.randomUUID(), inFlightSameOperation });
  } finally {
    decrementInFlight(operation);
  }
}
