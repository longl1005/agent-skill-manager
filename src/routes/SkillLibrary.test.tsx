import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import SkillLibrary from "./SkillLibrary";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";
import { useScanStore } from "../stores/scanStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { openSkillDirectory } from "../ipc/commands";

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="location-display">{location.pathname}</output>;
}

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

vi.mock("../ipc/commands", () => ({
  exportMasterSkillZip: vi.fn(),
  openSkillDirectory: vi.fn(),
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
  let toggleAgentSkillsBatchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useI18nStore.setState({ lang: "en" });
    useAgentConfigStore.setState({ disabledAgentIds: [] });
    useScanStore.setState({
      report: {
        scan_id: "test-scan", started_at: 0, completed_at: 0, total_skills: 0, total_issues: 0,
        agents: [
          { agent_id: "claude-code", display_name: "Claude Code", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "Completed" },
          { agent_id: "codex", display_name: "Codex", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "Completed" },
        ],
      },
    });

    fetchMasterSkillsMock = vi.fn();
    toggleAgentSkillMock = vi.fn().mockResolvedValue(true);
    toggleAgentSkillsBatchMock = vi.fn().mockResolvedValue(1);

    vi.mocked(useMasterRepoStore).mockReturnValue({
      skills: mockMasterSkills,
      loading: false,
      error: null,
      fetchMasterSkills: fetchMasterSkillsMock,
      toggleAgentSkill: toggleAgentSkillMock,
      toggleAgentSkillsBatch: toggleAgentSkillsBatchMock,
      importToMaster: vi.fn(),
    });
  });

  it("omits disabled Agents from the distribution matrix", () => {
    useAgentConfigStore.setState({ disabledAgentIds: ["codex"] });
    render(<MemoryRouter><SkillLibrary /></MemoryRouter>);
    expect(screen.queryByTestId("agent-badge-web-search-pro-codex")).not.toBeInTheDocument();
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

  it("shows the total number of master skills beside the library title", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    expect(screen.getByText("2 skills")).toBeVisible();
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

    expect(claudeBadge).toHaveAttribute("title", expect.stringContaining("Claude Code"));
    expect(claudeBadge).toHaveTextContent("Linked");
    expect(codexBadge).toHaveAttribute("title", expect.stringContaining("Codex"));
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

  it("uses one batch operation when linking every discovered Agent", () => {
    render(<MemoryRouter><SkillLibrary /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: "Link all Agents for code-analyzer" }));

    expect(toggleAgentSkillsBatchMock).toHaveBeenCalledWith(
      ["claude-code", "codex"], "code-analyzer", true,
    );
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

  it("keeps link state in the matrix instead of offering redundant link filters", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    expect(screen.getByText("web-search-pro")).toBeInTheDocument();
    expect(screen.getByText("code-analyzer")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Linked" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlinked" })).not.toBeInTheDocument();
  });

  it("opens the skill directory when clicking the folder button", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: "Open directory for web-search-pro" }));
    expect(openSkillDirectory).toHaveBeenCalledWith("~/.asm/skills/web-search-pro");
  });

  it("opens skill detail when clicking a master skill card", () => {
    render(
      <MemoryRouter>
        <SkillLibrary />
        <LocationDisplay />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("skill-card-web-search-pro"));

    expect(screen.getByTestId("location-display")).toHaveTextContent("/library/skills/web-search-pro");
    expect(screen.getByText("web-search-pro").closest("a")).toBeNull();
  });
});
