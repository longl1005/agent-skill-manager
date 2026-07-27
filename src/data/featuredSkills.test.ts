import { describe, expect, it } from "vitest";
import { FEATURED_SKILLS, getFeaturedSkillsByCategory } from "./featuredSkills";

describe("Featured Skills Data", () => {
  it("exports valid featured skills list with category filtering", () => {
    expect(FEATURED_SKILLS.length).toBeGreaterThan(0);
    const uiSkills = getFeaturedSkillsByCategory("ui");
    expect(uiSkills.every((s) => s.category === "ui")).toBe(true);
  });
});
