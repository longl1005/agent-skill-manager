import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";

import AgentCard from "./AgentCard";

describe("AgentCard", () => {
  it("links to the Agent workspace with its counts and status", () => {
    render(
      <MemoryRouter>
        <AgentCard
          agent={{
            agent_id: "codex",
            display_name: "Codex",
            detection_status: "Detected",
            roots: Array.from({ length: 2 }, (_, index) => ({
              root_id: `root-${index}`,
              scope: "global",
              display_path: `/skills/${index}`,
            })),
            skills: Array.from({ length: 14 }, (_, index) => ({
              name: `skill-${index}`,
              description: "A test skill",
              license: null,
              location: `/skills/${index}`,
              fingerprint_short: "abc123",
              file_count: 1,
              issues: [],
            })),
            issues: [],
            outcome: "Success",
          }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("link", { name: /Codex/i })).toHaveAttribute("href", "/agents/codex");
    expect(screen.getByText("14 Skills")).toBeVisible();
    expect(screen.getByText("2 Roots")).toBeVisible();
    expect(screen.getByText("Detected")).toBeVisible();
  });
});
