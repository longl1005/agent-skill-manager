import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useScanStore } from "../stores/scanStore";
import AppSidebar from "./AppSidebar";

const reportFixture = {
  scan_id: "scan-1", started_at: 0, completed_at: 1, total_skills: 14, total_issues: 0,
  agents: [{ agent_id: "codex", display_name: "Codex", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "Success" }],
};

beforeEach(() => useScanStore.setState({ report: reportFixture, scanning: false, error: null }));

describe("AppSidebar", () => {
  it("selects only the matching detected Agent on its detail route", () => {
    render(
      <MemoryRouter initialEntries={["/agents/codex"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link", { name: /^Agents$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Codex/i })).toHaveClass("is-selected");
    expect(screen.getByRole("link", { name: /All Agents/i })).not.toHaveClass("is-selected");
  });

  it("selects All Agents on the agents index route", () => {
    render(
      <MemoryRouter initialEntries={["/agents"]}>
        <AppSidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /All Agents/i })).toHaveClass("is-selected");
  });
});
