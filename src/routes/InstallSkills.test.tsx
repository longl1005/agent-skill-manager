import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import InstallSkills from "./InstallSkills";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { searchGlobalSkills } from "../api/globalSkillsSearch";
import { inspectGitSkills } from "../ipc/commands";

function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="location-display">{location.pathname}</output>;
}

const { openDialogMock, inspectGitSkillsMock } = vi.hoisted(() => ({
  openDialogMock: vi.fn(),
  inspectGitSkillsMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: openDialogMock,
}));

vi.mock("../ipc/commands", () => ({
  inspectGitSkills: inspectGitSkillsMock,
}));

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

vi.mock("../stores/scanStore", () => ({
  useScanStore: vi.fn(),
}));

vi.mock("../api/globalSkillsSearch", () => ({
  searchGlobalSkills: vi.fn(),
  getOnlineSkillDetailPath: (skill: { id: string }) => `/install/skills/${encodeURIComponent(skill.id)}`,
}));

describe("InstallSkills Route", () => {
  const mockToggleAgentSkill = vi.fn().mockResolvedValue(true);
  const mockImportToMaster = vi.fn().mockResolvedValue({ type: "success" });
  const mockInstallSkillToMaster = vi.fn().mockResolvedValue("/tmp/skills/mock");

  beforeEach(() => {
    vi.clearAllMocks();
    openDialogMock.mockResolvedValue(null);
    vi.mocked(inspectGitSkills).mockResolvedValue([
      { name: "custom-skill", description: "Custom skill", relative_path: "." },
    ]);
    useAgentConfigStore.setState({ disabledAgentIds: [] });

    vi.mocked(searchGlobalSkills).mockResolvedValue({
      items: [
        {
          id: "facebook/react-agent/react-agent",
          name: "react-agent",
          ownerRepo: "facebook/react-agent",
          description: "React agent helper skill",
          installsText: "⚡ 709.5K",
          fileCount: 3,
          repoUrl: "https://github.com/facebook/react-agent",
          skillsShUrl: "https://skills.sh/facebook/react-agent/react-agent",
          isVerifiedSkillsSh: true,
        },
      ],
      totalCount: 45,
      page: 1,
      pageSize: 20,
    });

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
      installSkillToMaster: mockInstallSkillToMaster,
    } as any);

    const scanState = {
      report: {
        agents: [
          { agent_id: "claude-code", display_name: "Claude Code", detection_status: "Detected" },
          { agent_id: "cursor", display_name: "Cursor", detection_status: "Detected" },
        ],
      },
      scanning: false,
      error: null,
      scan: vi.fn(),
    };
    vi.mocked(useScanStore).mockImplementation((selector: any) => selector(scanState));
  });

  it("renders Install Skills header and tab navigation", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /安装技能|Install Skills/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /热门技能市场|Marketplace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /全网技能库|Global Registry/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Git \/ GitHub|Git \/ URL/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /本地导入|Local Import/i })).toBeInTheDocument();
  });

  it("uses the fetched online total in the registry tab label", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /全网技能库|Global Registry/i }));

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /全网 45 技能库|Global 45 Registry/i })).toBeInTheDocument();
    });
  });

  it("renders installsText and ownerRepo on featured skills cards", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    expect(screen.getByText(/2\.7M installs/i)).toBeInTheDocument();
    expect(screen.getByText("vercel-labs/skills")).toBeInTheDocument();
    expect(screen.getAllByText(/来自 skills\.sh|From skills\.sh/i).length).toBeGreaterThan(0);
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

  it("switches to URL import tab and submits a single-skill repo to open modal", async () => {
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

    await waitFor(() => expect(inspectGitSkills).toHaveBeenCalledWith("https://github.com/user/custom-skill"));
    expect(await screen.findByTestId("target-agent-modal")).toBeInTheDocument();
    expect(screen.getByText("custom-skill")).toBeInTheDocument();
  });

  it("parses shorthand input like anthropics/skills and triggers skill installation", async () => {
    vi.mocked(inspectGitSkills).mockResolvedValueOnce([
      { name: "skills", description: "Skill collection", relative_path: "." },
    ]);
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

    expect(await screen.findByTestId("target-agent-modal")).toBeInTheDocument();
    expect(screen.getByText("skills")).toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-install-btn");
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockInstallSkillToMaster).toHaveBeenCalledWith(
        "skills",
        "https://github.com/anthropics/skills",
        "."
      );
      expect(mockToggleAgentSkill).toHaveBeenCalledWith("claude-code", "skills", true);
    });
  });

  it("offers multiple Git Skills for selection before opening Agent distribution", async () => {
    vi.mocked(inspectGitSkills).mockResolvedValueOnce([
      { name: "dashi-ppt", description: "Create presentation slides", relative_path: "skills/dashi-ppt" },
      { name: "dashi-doc", description: "Create documents", relative_path: "skills/dashi-doc" },
    ]);

    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /Git \/ GitHub|Git \/ URL/i }));
    fireEvent.change(screen.getByPlaceholderText(/Git \/ GitHub/i), {
      target: { value: "https://github.com/chuspeeism/dashi-ppt-skill" },
    });
    fireEvent.click(screen.getByText(/解析并安装|Fetch & Install/i));

    expect(await screen.findByTestId("git-skill-picker")).toBeInTheDocument();
    expect(screen.queryByTestId("target-agent-modal")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dashi-ppt/i }));
    expect(screen.getByTestId("target-agent-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("confirm-install-btn"));
    await waitFor(() => {
      expect(mockInstallSkillToMaster).toHaveBeenCalledWith(
        "dashi-ppt",
        "https://github.com/chuspeeism/dashi-ppt-skill",
        "skills/dashi-ppt",
      );
    });
  });

  it("switches to Local import tab and handles drag/click prompt", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const localTabBtn = screen.getByRole("tab", { name: /本地导入|Local Import/i });
    fireEvent.click(localTabBtn);

    expect(screen.getByTestId("local-content")).toBeInTheDocument();
  });

  it("opens a native folder picker and prepares the selected local skill for installation", async () => {
    openDialogMock.mockResolvedValue("/Users/example/skills/my-local-skill");
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /本地导入|Local Import/i }));
    fireEvent.click(screen.getByRole("button", { name: /选择文件夹|Choose Folder/i }));

    await waitFor(() => {
      expect(openDialogMock).toHaveBeenCalledWith({ directory: true, multiple: false });
      expect(screen.getByTestId("target-agent-modal")).toBeInTheDocument();
      expect(screen.getByText("my-local-skill")).toBeInTheDocument();
    });
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
    expect(screen.getByRole("checkbox", { name: /Claude Code/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Cursor/i })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^TRAE,/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /^TRAE CN,/i })).not.toBeInTheDocument();

    const confirmBtn = screen.getByTestId("confirm-install-btn");
    expect(confirmBtn).toHaveTextContent(/分发至 \d+ 个 Agent|Distribute to \d+ Agents/i);
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToggleAgentSkill).toHaveBeenCalledWith("claude-code", "ui-ux-pro-max", true);
      expect(mockToggleAgentSkill).toHaveBeenCalledWith("cursor", "ui-ux-pro-max", true);
    });
  });

  it("switches to online search tab and renders online search results from mega search engine", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const onlineTabBtn = screen.getByRole("tab", { name: /全网技能库|Global Registry/i });
    fireEvent.click(onlineTabBtn);

    expect(screen.getByTestId("online-content")).toBeInTheDocument();

    await waitFor(() => {
      expect(searchGlobalSkills).toHaveBeenCalledWith({ query: "", page: 1, pageSize: 18, sortBy: "stars" });
      expect(screen.getByText("react-agent")).toBeInTheDocument();
      expect(screen.getByText("facebook/react-agent")).toBeInTheDocument();
      expect(screen.getByText("⚡ 709.5K")).toBeInTheDocument();
      expect(screen.getByText(/来自 skills\.sh|From skills\.sh/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/搜索全网技能|Search global agent skills/i);
    fireEvent.change(searchInput, { target: { value: "python" } });

    await waitFor(() => {
      expect(searchGlobalSkills).toHaveBeenCalledWith({ query: "python", page: 1, pageSize: 18, sortBy: "stars" });
    });
  });

  it("opens an online skill detail page when its card is clicked", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
        <LocationDisplay />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /全网技能库|Global Registry/i }));

    fireEvent.click(await screen.findByTestId("online-card-react-agent"));

    expect(screen.getByTestId("location-display")).toHaveTextContent("/install/skills/facebook%2Freact-agent%2Freact-agent");
    expect(screen.getByText("react-agent").closest("a")).toBeNull();
  });

  it("opens a featured skill detail page when its card is clicked", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
        <LocationDisplay />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("featured-card-find-skills"));

    expect(screen.getByTestId("location-display")).toHaveTextContent("/install/skills/vercel-labs%2Fskills%2Ffind-skills");
  });

  it("shows skills.sh source, file count, and installs on online cards", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /全网技能库|Global Registry/i }));

    await screen.findByTestId("online-card-react-agent");
    expect(screen.getByText(/来自 skills\.sh|From skills\.sh/i)).toBeInTheDocument();
    expect(screen.getByText(/3 个文件|3 files/i)).toBeInTheDocument();
    expect(screen.getByText("⚡ 709.5K")).toBeInTheDocument();
    expect(screen.queryByText(/Indexed on skills\.sh/i)).not.toBeInTheDocument();
  });

  it("hides the installs metric when skills.sh does not provide one", async () => {
    vi.mocked(searchGlobalSkills).mockResolvedValueOnce({
      items: [{
        id: "anthropics/skills/canvas-design",
        name: "canvas-design",
        ownerRepo: "anthropics/skills",
        description: "Canvas skill",
        installsText: "⚡ Indexed on skills.sh",
        fileCount: 1,
        repoUrl: "https://github.com/anthropics/skills",
        isVerifiedSkillsSh: true,
      }],
      totalCount: 1,
      page: 1,
      pageSize: 18,
    });

    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: /全网技能库|Global Registry/i }));

    await screen.findByTestId("online-card-canvas-design");
    expect(screen.getByText(/1 个文件|1 file/i)).toBeInTheDocument();
    expect(screen.queryByText(/Indexed on skills\.sh|暂无安装数据|Install data unavailable/i)).not.toBeInTheDocument();
  });

  it("supports sorting tab switching and pagination buttons on online search tab", async () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    const onlineTabBtn = screen.getByRole("tab", { name: /全网技能库|Global Registry/i });
    fireEvent.click(onlineTabBtn);

    await waitFor(() => {
      expect(searchGlobalSkills).toHaveBeenCalledWith({ query: "", page: 1, pageSize: 18, sortBy: "stars" });
    });

    // Switch sort order to updated
    const updatedSortBtn = screen.getByTestId("sort-updated-btn");
    fireEvent.click(updatedSortBtn);

    await waitFor(() => {
      expect(searchGlobalSkills).toHaveBeenCalledWith({ query: "", page: 1, pageSize: 18, sortBy: "updated" });
    });

    // Click next page
    const nextBtn = screen.getByTestId("page-next-btn");
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(searchGlobalSkills).toHaveBeenCalledWith({ query: "", page: 2, pageSize: 18, sortBy: "updated" });
    });

    // Click prev page
    const prevBtn = screen.getByTestId("page-prev-btn");
    fireEvent.click(prevBtn);

    await waitFor(() => {
      expect(searchGlobalSkills).toHaveBeenCalledWith({ query: "", page: 1, pageSize: 18, sortBy: "updated" });
    });
  });
});
