import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import SkillLibrary from "./SkillLibrary";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

const mockMasterSkills = [
  {
    name: "web-search-pro",
    description: "Advanced web searching skill",
    path: "~/.asm/skills/web-search-pro",
    linked_agents: {
      "claude-code": true,
      codex: false,
      antigravity: true,
      "pi-agent": false,
    },
  },
  {
    name: "code-analyzer",
    description: "Deep static analysis tool",
    path: "~/.asm/skills/code-analyzer",
    linked_agents: {
      "claude-code": false,
      codex: false,
      antigravity: false,
      "pi-agent": false,
    },
  },
];

describe("SkillLibrary Route", () => {
  let fetchMasterSkillsMock: ReturnType<typeof vi.fn>;
  let toggleAgentSkillMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useI18nStore.setState({ lang: "en" });

    fetchMasterSkillsMock = vi.fn();
    toggleAgentSkillMock = vi.fn().mockResolvedValue(true);

    vi.mocked(useMasterRepoStore).mockReturnValue({
      skills: mockMasterSkills,
      loading: false,
      error: null,
      fetchMasterSkills: fetchMasterSkillsMock,
      toggleAgentSkill: toggleAgentSkillMock,
      importToMaster: vi.fn(),
    });
  });

  it("fetches master skills on mount and renders master skill cards", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    expect(fetchMasterSkillsMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Master Skill Repository" })).toBeInTheDocument();
    expect(screen.getByText("web-search-pro")).toBeInTheDocument();
    expect(screen.getByText("code-analyzer")).toBeInTheDocument();
    expect(screen.getByText("~/.asm/skills/web-search-pro")).toBeInTheDocument();
    expect(screen.getByText("Advanced web searching skill")).toBeInTheDocument();
  });

  it("renders agent link distribution matrix badges with correct states", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    const webSearchCard = screen.getByTestId("skill-card-web-search-pro");
    expect(webSearchCard).toBeInTheDocument();

    const claudeBadge = screen.getByTestId("agent-badge-web-search-pro-claude-code");
    const codexBadge = screen.getByTestId("agent-badge-web-search-pro-codex");

    expect(claudeBadge).toHaveTextContent("Claude Code");
    expect(claudeBadge).toHaveTextContent("Linked");
    expect(codexBadge).toHaveTextContent("Codex");
    expect(codexBadge).toHaveTextContent("Unlinked");
  });

  it("toggles agent link when clicking an agent badge", async () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    const codexBadge = screen.getByTestId("agent-badge-web-search-pro-codex");
    fireEvent.click(codexBadge);

    expect(toggleAgentSkillMock).toHaveBeenCalledWith("codex", "web-search-pro", true);
  });

  it("filters skills by search query", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    const searchInput = screen.getByRole("textbox", { name: /search master skills/i });
    fireEvent.change(searchInput, { target: { value: "analyzer" } });

    expect(screen.queryByText("web-search-pro")).not.toBeInTheDocument();
    expect(screen.getByText("code-analyzer")).toBeInTheDocument();
  });

  it("filters skills by status (Linked / Unlinked)", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    const linkedFilterBtn = screen.getByRole("button", { name: "Linked" });
    fireEvent.click(linkedFilterBtn);

    expect(screen.getByText("web-search-pro")).toBeInTheDocument();
    expect(screen.queryByText("code-analyzer")).not.toBeInTheDocument();

    const unlinkedFilterBtn = screen.getByRole("button", { name: "Unlinked" });
    fireEvent.click(unlinkedFilterBtn);

    expect(screen.queryByText("web-search-pro")).not.toBeInTheDocument();
    expect(screen.getByText("code-analyzer")).toBeInTheDocument();
  });

  it("copies skill path when clicking copy button", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    const copyBtn = screen.getByRole("button", { name: "Copy path for web-search-pro" });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("~/.asm/skills/web-search-pro");
    await waitFor(() => {
      expect(screen.getByText("Copied!")).toBeInTheDocument();
    });
  });
});
