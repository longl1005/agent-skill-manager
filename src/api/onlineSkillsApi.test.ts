import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchOnlineSkills } from "./onlineSkillsApi";

describe("Online Skills Search API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches and normalizes repositories from GitHub agent-skills topic", async () => {
    const mockItems = [
      {
        id: 1,
        name: "skills",
        full_name: "anthropics/skills",
        description: "Public repository for Agent Skills",
        stargazers_count: 164547,
        html_url: "https://github.com/anthropics/skills",
      },
      {
        id: 2,
        name: "superpowers",
        full_name: "obra/superpowers",
        description: null,
        stargazers_count: 850,
        html_url: "https://github.com/obra/superpowers",
      },
      {
        id: 3,
        name: "mega-skills",
        full_name: "test/mega-skills",
        description: "Million star skill",
        stargazers_count: 1200000,
        html_url: "https://github.com/test/mega-skills",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as any);

    const res = await searchOnlineSkills("frontend");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.github.com/search/repositories?q=frontend+topic:agent-skills+sort:stars"
    );
    expect(res.length).toBe(3);
    expect(res[0]).toEqual({
      id: "1",
      name: "skills",
      ownerRepo: "anthropics/skills",
      description: "Public repository for Agent Skills",
      stars: 164547,
      repoUrl: "https://github.com/anthropics/skills",
      installsText: "★ 164.5K",
    });
    expect(res[1].description).toBe("(No description)");
    expect(res[1].installsText).toBe("★ 850");
    expect(res[2].installsText).toBe("★ 1.2M");
  });

  it("handles empty query correctly", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as any);

    await searchOnlineSkills("   ");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.github.com/search/repositories?q=topic:agent-skills+sort:stars"
    );
  });

  it("returns empty array on HTTP failure or exception", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
    } as any);

    const res1 = await searchOnlineSkills("test");
    expect(res1).toEqual([]);

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const res2 = await searchOnlineSkills("test");
    expect(res2).toEqual([]);
  });
});
