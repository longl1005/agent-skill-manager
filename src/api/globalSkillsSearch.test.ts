import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { searchGlobalSkills } from "./globalSkillsSearch";
import { SKILLS_SH_LEADERBOARD } from "./skillsShApi";

describe("Global Skills Search API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("searches and returns paginated merged items from skills.sh and GitHub topic API", async () => {
    const mockGitHubItems = [
      {
        id: 99,
        name: "react-agent-skill",
        full_name: "example/react-agent-skill",
        description: "React agent skill for coding",
        stargazers_count: 1200,
        html_url: "https://github.com/example/react-agent-skill",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockGitHubItems, total_count: 11900 }),
    } as Response);

    const res = await searchGlobalSkills({ query: "react", page: 1, sortBy: "stars" });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.totalCount).toBeGreaterThan(0);
    expect(res.page).toBe(1);
    expect(res.pageSize).toBe(20);
  });

  it("filters skills.sh items by query", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total_count: 0 }),
    } as Response);

    const res = await searchGlobalSkills({ query: "frontend-design", page: 1 });
    expect(res.items.some((item) => item.name === "frontend-design")).toBe(true);
  });

  it("formats star count correctly for GitHub items", async () => {
    const mockGitHubItems = [
      {
        id: 1,
        name: "mega-skill-1",
        full_name: "owner/mega-skill-1",
        description: "Mega skill 1",
        stargazers_count: 1500000,
        html_url: "https://github.com/owner/mega-skill-1",
      },
      {
        id: 2,
        name: "mega-skill-2",
        full_name: "owner/mega-skill-2",
        description: "Mega skill 2",
        stargazers_count: 2500,
        html_url: "https://github.com/owner/mega-skill-2",
      },
      {
        id: 3,
        name: "mega-skill-3",
        full_name: "owner/mega-skill-3",
        description: "Mega skill 3",
        stargazers_count: 42,
        html_url: "https://github.com/owner/mega-skill-3",
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockGitHubItems, total_count: 3 }),
    } as Response);

    const res = await searchGlobalSkills({ query: "mega-skill", page: 1 });
    const item1 = res.items.find((i) => i.name === "mega-skill-1");
    const item2 = res.items.find((i) => i.name === "mega-skill-2");
    const item3 = res.items.find((i) => i.name === "mega-skill-3");

    expect(item1?.installsText).toBe("★ 1.5M");
    expect(item2?.installsText).toBe("★ 2.5K");
    expect(item3?.installsText).toBe("★ 42");
  });

  it("handles fetch errors gracefully without crashing", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const res = await searchGlobalSkills({ query: "", page: 1 });
    expect(res.items.length).toBe(SKILLS_SH_LEADERBOARD.length);
    expect(res.totalCount).toBe(SKILLS_SH_LEADERBOARD.length);
  });

  it("deduplicates items present in both skills.sh and GitHub API", async () => {
    const firstSkillsSh = SKILLS_SH_LEADERBOARD[0];
    const mockGitHubItems = [
      {
        id: 1001,
        name: firstSkillsSh.name,
        full_name: firstSkillsSh.ownerRepo,
        description: "Duplicate item",
        stargazers_count: 500,
        html_url: firstSkillsSh.githubUrl,
      },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockGitHubItems, total_count: 1 }),
    } as Response);

    const res = await searchGlobalSkills({ query: "", page: 1 });
    const matchCount = res.items.filter((item) => item.id === firstSkillsSh.id).length;
    expect(matchCount).toBe(1);
  });

  it("only includes skills.sh items on page 1", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [], total_count: 100 }),
    } as Response);

    const resPage2 = await searchGlobalSkills({ query: "", page: 2 });
    expect(resPage2.items.some((item) => item.isVerifiedSkillsSh)).toBe(false);
  });
});
