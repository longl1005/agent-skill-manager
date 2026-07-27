import { describe, expect, it } from "vitest";
import { FEATURED_SKILLS, getFeaturedSkillsByCategory } from "./featuredSkills";

describe("Featured Skills Data", () => {
  it("exports valid featured skills list with category filtering", () => {
    expect(FEATURED_SKILLS.length).toBeGreaterThan(0);
    const uiSkills = getFeaturedSkillsByCategory("ui");
    expect(uiSkills.every((s) => s.category === "ui")).toBe(true);
  });

  it("includes skills.sh leaderboard metrics (installsText and ownerRepo)", () => {
    expect(FEATURED_SKILLS.length).toBe(9);
    for (const skill of FEATURED_SKILLS) {
      expect(skill.installsText).toBeDefined();
      expect(typeof skill.installsText).toBe("string");
      expect(skill.ownerRepo).toBeDefined();
      expect(typeof skill.ownerRepo).toBe("string");
    }
  });

  it("contains specific high-ranking leaderboard skills", () => {
    const findSkills = FEATURED_SKILLS.find((s) => s.id === "find-skills");
    expect(findSkills).toBeDefined();
    expect(findSkills?.installsText).toBe("2.7M installs");
    expect(findSkills?.ownerRepo).toBe("vercel-labs/skills");

    const frontendDesign = FEATURED_SKILLS.find((s) => s.id === "frontend-design");
    expect(frontendDesign).toBeDefined();
    expect(frontendDesign?.installsText).toBe("709K installs");
    expect(frontendDesign?.ownerRepo).toBe("anthropics/skills");
  });
});
