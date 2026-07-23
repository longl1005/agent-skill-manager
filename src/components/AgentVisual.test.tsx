import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentStatus, agentStatusCopy } from "./AgentVisual";

describe("agentStatusCopy", () => {
  it("normalizes recognized and unrecognized agent statuses", () => {
    expect(agentStatusCopy("Detected")).toBe("Detected");
    expect(agentStatusCopy("Partial")).toBe("Partial");
    expect(agentStatusCopy("Missing")).toBe("Not detected");
  });

  it("renders normalized status text with its modifier class and color", () => {
    render(<AgentStatus status="Missing" />);

    expect(screen.getByText("Not detected")).toHaveClass("agent-status--not-detected");
    expect(screen.getByText("Not detected")).toHaveStyle({ color: "rgb(185, 28, 28)" });
  });
});
