import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import type { ScanReport } from "../ipc/types";
import { useScanStore } from "../stores/scanStore";
import Agents from "./Agents";

const agent = (agent_id: string, detection_status: string) => ({
  agent_id,
  display_name: agent_id === "codex" ? "Codex" : "Claude Code",
  detection_status,
  roots: [],
  skills: [],
  issues: [],
  outcome: "Success",
});

const report = (agents: ScanReport["agents"]): ScanReport => ({
  scan_id: "scan-1",
  started_at: 0,
  completed_at: 1,
  agents,
  total_skills: 0,
  total_issues: 0,
});

beforeEach(() => useScanStore.setState({ report: null, scanning: false, error: null }));

describe("Agents", () => {
  it("lists detected and partial Agents in the directory", () => {
    useScanStore.setState({ report: report([agent("codex", "Detected"), agent("claude", "Partial"), agent("other", "Missing")]) });

    render(<MemoryRouter><Agents /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "All Agents" })).toBeVisible();
    expect(screen.getByRole("link", { name: /Codex/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /Claude Code/i })).toBeVisible();
    expect(screen.queryByRole("link", { name: /other/i })).not.toBeInTheDocument();
  });

  it("shows install and rescan recovery guidance for an empty report", () => {
    useScanStore.setState({ report: report([]) });

    render(<MemoryRouter><Agents /></MemoryRouter>);

    expect(screen.getByText(/Install an agent, then rescan/i)).toBeVisible();
  });

  it("shows a busy directory skeleton while the first scan is running", () => {
    useScanStore.setState({ report: null, scanning: true });

    render(<MemoryRouter><Agents /></MemoryRouter>);

    expect(screen.getByRole("region", { busy: true })).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByTestId("agent-directory-skeleton")).toHaveLength(3);
  });

  it("shows scan recovery instead of an empty directory after the initial scan fails", () => {
    const scan = vi.fn().mockResolvedValue(undefined);
    useScanStore.setState({ error: "The scanner is unavailable", report: null, scan });

    render(<MemoryRouter><Agents /></MemoryRouter>);

    expect(screen.getByRole("alert")).toHaveTextContent(/unable to scan agents/i);
    expect(screen.queryByRole("heading", { name: /no agents discovered/i })).not.toBeInTheDocument();

    const retry = screen.getByRole("button", { name: /rescan agents/i });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    expect(scan).toHaveBeenCalledOnce();
  });
});
