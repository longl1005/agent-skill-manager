import { describe, expect, it } from "vitest";
import { parseSkillsShInput } from "./skillsShParser";

describe("skills.sh Shorthand Parser", () => {
  it("parses owner/repo shorthand into GitHub repo URL", () => {
    const res = parseSkillsShInput("anthropics/skills");
    expect(res).toBe("https://github.com/anthropics/skills");
  });

  it("parses skills.sh page URL into GitHub repo URL", () => {
    const res = parseSkillsShInput("https://skills.sh/vercel-labs/skills/find-skills");
    expect(res).toBe("https://github.com/vercel-labs/skills");
  });

  it("leaves full github URLs untouched", () => {
    const res = parseSkillsShInput("https://github.com/user/my-skill");
    expect(res).toBe("https://github.com/user/my-skill");
  });

  it("handles empty or whitespace input", () => {
    expect(parseSkillsShInput("   ")).toBe("");
    expect(parseSkillsShInput("")).toBe("");
  });

  it("returns arbitrary string as is if non-matching", () => {
    expect(parseSkillsShInput("just-a-skill-name")).toBe("just-a-skill-name");
  });
});
