import type { AgentReport } from "./ipc/types";

export function isDiscoveredAgent(agent: Pick<AgentReport, "detection_status">) {
  return agent.detection_status === "Detected" || agent.detection_status === "Partial";
}
