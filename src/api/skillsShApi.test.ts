import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSkillsShDirectory, parseSkillsShHtml } from "./skillsShApi";

describe("skills.sh HTML Parser & Fetcher", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts skills, owner/repo, and install metrics from skills.sh HTML", () => {
    const sampleHtml = `
      <a href="/anthropics/skills/frontend-design">
        <h3>frontend-design</h3>
        <p>anthropics/skills</p>
        <span>709.5K</span>
      </a>
      <a href="/mattpocock/skills/tdd">
        <h3>tdd</h3>
        <p>mattpocock/skills</p>
        <span>532.9K</span>
      </a>
    `;

    const res = parseSkillsShHtml(sampleHtml);
    expect(res.length).toBe(2);

    expect(res[0]).toEqual({
      id: "anthropics/skills/frontend-design",
      name: "frontend-design",
      ownerRepo: "anthropics/skills",
      description: "Official skill from anthropics/skills on skills.sh",
      installsText: "⚡ 709.5K",
      skillsShUrl: "https://skills.sh/anthropics/skills/frontend-design",
      githubUrl: "https://github.com/anthropics/skills",
    });

    expect(res[1]).toEqual({
      id: "mattpocock/skills/tdd",
      name: "tdd",
      ownerRepo: "mattpocock/skills",
      description: "Official skill from mattpocock/skills on skills.sh",
      installsText: "⚡ 532.9K",
      skillsShUrl: "https://skills.sh/mattpocock/skills/tdd",
      githubUrl: "https://github.com/mattpocock/skills",
    });
  });

  it("falls back to extracting simple href links if main regex fails to match cards", () => {
    const sampleHtml = `
      <div class="list">
        <a href="/anthropics/skills/frontend-design">Frontend Design</a>
        <a href="/topic/react">React Topic</a>
        <a href="/facebook/react/react-skill">React Skill</a>
      </div>
    `;

    const res = parseSkillsShHtml(sampleHtml);
    expect(res.length).toBe(2);
    expect(res[0].id).toBe("anthropics/skills/frontend-design");
    expect(res[1].id).toBe("facebook/react/react-skill");
  });

  it("fetches skills.sh directory and filters by query", async () => {
    const mockHtml = `
      <a href="/anthropics/skills/frontend-design">
        <h3>frontend-design</h3>
        <p>anthropics/skills</p>
        <span>709.5K</span>
      </a>
      <a href="/mattpocock/skills/tdd">
        <h3>tdd</h3>
        <p>mattpocock/skills</p>
        <span>532.9K</span>
      </a>
    `;

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    } as Response);

    const allItems = await fetchSkillsShDirectory();
    expect(allItems.length).toBe(2);

    const filtered = await fetchSkillsShDirectory("frontend");
    expect(filtered.length).toBe(1);
    expect(filtered[0].name).toBe("frontend-design");
  });

  it("returns empty array if fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const items = await fetchSkillsShDirectory();
    expect(items).toEqual([]);
  });
});
