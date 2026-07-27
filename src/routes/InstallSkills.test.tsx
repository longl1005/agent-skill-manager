import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InstallSkills from "./InstallSkills";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";
import { searchOnlineSkills } from "../api/onlineSkillsApi";

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

vi.mock("../stores/scanStore", () => ({
  useScanStore: vi.fn(),
}));

vi.mock("../api/onlineSkillsApi", () => ({
  searchOnlineSkills: vi.fn(),
}));

describe("InstallSkills Route", () => {
  const mockToggleAgentSkill = vi.fn().mockResolvedValue(true);
  const mockImportToMaster = vi.fn().mockResolvedValue({ type: "success" });

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(searchOnlineSkills).mockResolvedValue([
      {
        id: "101",
        name: "react-agent",
        ownerRepo: "facebook/react-agent",
        description: "React agent helper skill",
        stars: 1250,
        repoUrl: "https://github.com/facebook/react-agent",
        installsText: "★ 1.3K",
      },
    ]);
    vi.mocked(useMasterRepoStore).mockReturnValue({
      skills: [
        {
          name: "frontend-design",
          description: "Visual design guide",
          path: "/tmp/skills/frontend-design",
          linked_agents: { "claude-code": true },
        },
      ],
      fetchMasterSkills: vi.fn(),
      toggleAgentSkill: mockToggleAgentSkill,
      importToMaster: mockImportToMaster,
    } as any);

    vi.mocked(useScanStore).mockReturnValue({
      report: {
        agents: [
          { agent_id: "claude-code", display_name: "Claude Code" },
          { agent_id: "cursor", display_name: "Cursor" },
        ],
      },
      scanning: false,
      error: null,
      scan: vi.fn(),
    } as any);
  });

  it("renders Install Skills header and tab navigation", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /安装技能|Install Skills/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /热门技能市场|Marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Git \/ GitHub|Git \/ URL/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /本地目录|Local Import/i })).toBeInTheDocument();
  });

  it("renders installsText and ownerRepo on featured skills cards", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    expect(screen.getByText(/2\.7M installs/i)).toBeInTheDocument();
    expect(screen.getByText("vercel-labs/skills")).toBeInTheDocument();
    expect(screen.getAllByText("skills.sh Verified").length).toBeGreaterThan(0);
  });

  it("displays installed badge for skills present in master library", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    // 'frontend-design' is in masterSkills mock
    expect(screen.getByTestId("installed-badge-frontend-design")).toBeInTheDocument();

    // 'ui-ux-pro-max' is NOT in masterSkills mock, should have install button
    expect(screen.getByTestId("install-btn-ui-ux-pro-max")).toBeInTheDocument();
  });

  it("filters marketplace cards by category", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const searchFilterBtn = screen.getByText(/工具与搜索|Search & Tools/i);
    fireEvent.click(searchFilterBtn);

    // free-search is category 'search', should be rendered
    expect(screen.getByTestId("featured-card-free-search")).toBeInTheDocument();
    // frontend-design is category 'ui', should NOT be rendered
    expect(screen.queryByTestId("featured-card-frontend-design")).not.toBeInTheDocument();
  });

  it("switches to URL import tab and submits repo URL to open modal", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const urlTabBtn = screen.getByRole("tab", { name: /Git \/ GitHub|Git \/ URL/i });
    fireEvent.click(urlTabBtn);

    const input = screen.getByPlaceholderText(/Git \/ GitHub/i);
    fireEvent.change(input, { target: { value: "https://github.com/user/custom-skill" } });

    const submitBtn = screen.getByText(/解析并安装|Fetch & Install/i);
    fireEvent.click(submitBtn);

    expect(screen.getByTestId("target-agent-modal")).toBeInTheDocument();
    expect(screen.getByText("custom-skill")).toBeInTheDocument();
  });

  it("parses shorthand input like anthropics/skills and triggers skill installation", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const urlTabBtn = screen.getByRole("tab", { name: /Git \/ GitHub|Git \/ URL/i });
    fireEvent.click(urlTabBtn);

    const input = screen.getByPlaceholderText(/Git \/ GitHub/i);
    fireEvent.change(input, { target: { value: "anthropics/skills" } });

    const submitBtn = screen.getByText(/解析并安装|Fetch & Install/i);
    fireEvent.click(submitBtn);

    expect(screen.getByTestId("target-agent-modal")).toBeInTheDocument();
    expect(screen.getByText("skills")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-install-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockImportToMaster).toHaveBeenCalledWith(
        "claude-code",
        "https://github.com/anthropics/skills"
      );
      expect(mockToggleAgentSkill).toHaveBeenCalledWith("claude-code", "skills", true);
    });
  });

  it("switches to Local import tab and handles drag/click prompt", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const localTabBtn = screen.getByRole("tab", { name: /本地目录|Local Import/i });
    fireEvent.click(localTabBtn);

    expect(screen.getByTestId("local-content")).toBeInTheDocument();
  });

  it("opens target agent modal when clicking install button on card and confirms distribution", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const installBtn = screen.getByTestId("install-btn-ui-ux-pro-max");
    fireEvent.click(installBtn);

    expect(screen.getByTestId("target-agent-modal")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-install-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToggleAgentSkill).toHaveBeenCalledWith("claude-code", "ui-ux-pro-max", true);
      expect(mockToggleAgentSkill).toHaveBeenCalledWith("cursor", "ui-ux-pro-max", true);
    });
  });

  it("switches to online search tab and renders online search results", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const onlineTabBtn = screen.getByRole("tab", { name: /全网 11,000\+ 技能检索|Live Online Search/i });
    fireEvent.click(onlineTabBtn);

    expect(screen.getByTestId("online-content")).toBeInTheDocument();

    await waitFor(() => {
      expect(searchOnlineSkills).toHaveBeenCalledWith("");
      expect(screen.getByText("react-agent")).toBeInTheDocument();
      expect(screen.getByText("facebook/react-agent")).toBeInTheDocument();
      expect(screen.getByText("★ 1.3K")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/输入关键词搜索全网|Search 11,000\+/i);
    fireEvent.change(searchInput, { target: { value: "python" } });

    await waitFor(() => {
      expect(searchOnlineSkills).toHaveBeenCalledWith("python");
    });
  });
});
