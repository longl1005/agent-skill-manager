import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SkillDetail from "./SkillDetail";

const { readSkillContentMock } = vi.hoisted(() => ({
  readSkillContentMock: vi.fn().mockResolvedValue("# Remotion skill"),
}));

vi.mock("../ipc/commands", () => ({
  readSkillContent: readSkillContentMock,
}));

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: () => ({
    skills: [
      {
        name: "remotion-best-practices",
        description: "Best practices for Remotion",
        path: "/Users/example/.asm/skills/remotion",
        linked_agents: {},
      },
    ],
  }),
}));

vi.mock("../stores/scanStore", () => ({
  useScanStore: () => ({ report: null }),
}));

describe("SkillDetail", () => {
  it("resolves a master skill by its directory name when its frontmatter name differs", async () => {
    render(
      <MemoryRouter initialEntries={["/library/skills/remotion"]}>
        <Routes>
          <Route path="/library/skills/:skillName" element={<SkillDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "remotion-best-practices" })).toBeVisible();
    expect(readSkillContentMock).toHaveBeenCalledWith("/Users/example/.asm/skills/remotion");
  });
});
