# skills.sh Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate skills.sh leaderboard datasets, install metrics (`2.7M installs`), `owner/repo` shorthand parser, and automatic Git repository skill extractor.

**Architecture:** Update `featuredSkills.ts` with skills.sh metrics and repos, create `src/utils/skillsShParser.ts` for shorthand parsing, add Rust backend IPC `import_git_skill` in `master_repo.rs`, and update `InstallSkills.tsx`.

**Tech Stack:** React, TypeScript, Rust, Tauri IPC, Vitest.

## Global Constraints
- Full i18n support.
- Canonical skill storage location: `~/.asm/skills/<name>`.
- 100% test coverage.

---

### Task 1: Create skills.sh Shorthand Parser & Update Featured Dataset

**Files:**
- Create: `src/utils/skillsShParser.ts`
- Create: `src/utils/skillsShParser.test.ts`
- Modify: `src/data/featuredSkills.ts`
- Modify: `src/data/featuredSkills.test.ts`

- [ ] **Step 1: Write test for skillsShParser.ts**

```ts
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
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/utils/skillsShParser.test.ts`
Expected: FAIL ("cannot find module ./skillsShParser").

- [ ] **Step 3: Implement skillsShParser.ts**

```ts
export function parseSkillsShInput(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // 1. Check if full URL
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const urlObj = new URL(trimmed);
    if (urlObj.hostname === "skills.sh" || urlObj.hostname === "www.skills.sh") {
      const parts = urlObj.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        return `https://github.com/${parts[0]}/${parts[1]}`;
      }
    }
    return trimmed;
  }

  // 2. Check if owner/repo shorthand
  const ownerRepoMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)$/);
  if (ownerRepoMatch) {
    return `https://github.com/${ownerRepoMatch[1]}/${ownerRepoMatch[2]}`;
  }

  return trimmed;
}
```

- [ ] **Step 4: Update featuredSkills.ts with skills.sh Leaderboard Data**

Add `installsText` field to `FeaturedSkill` (e.g. `2.7M installs`, `709K installs`, `675K installs`, `583K installs`).
Include `find-skills`, `frontend-design`, `grill-me`, `agent-browser`, `ui-ux-pro-max`, `free-search`, `tavily-search`, `banner-design`, `systematic-debugging`.

- [ ] **Step 5: Run tests to verify pass**

Run: `pnpm test src/utils/skillsShParser.test.ts src/data/featuredSkills.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit changes**

```bash
git add src/utils/skillsShParser.ts src/utils/skillsShParser.test.ts src/data/featuredSkills.ts src/data/featuredSkills.test.ts
git commit -m "feat: add skills.sh shorthand parser and update leaderboard dataset with install metrics"
```

---

### Task 2: Update InstallSkills UI & Agent Distribution Modal

**Files:**
- Modify: `src/routes/InstallSkills.tsx`
- Modify: `src/routes/InstallSkills.test.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update InstallSkills.test.tsx**

Verify that skills.sh install badges (e.g. `2.7M installs`), owner/repo shorthand input, and skills.sh verified tag are rendered.

- [ ] **Step 2: Update InstallSkills.tsx**

Render `skills.sh Verified` badge on marketplace cards, display `installsText`, auto-apply `parseSkillsShInput` on URL input submit, and link to target agents upon confirmation.

- [ ] **Step 3: Add CSS for skills.sh badges in global.css**

Add styling for `.skills-sh-badge`, `.skills-sh-installs`.

- [ ] **Step 4: Run tests and build check**

Run: `(cd src-tauri && cargo test) && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/routes/InstallSkills.tsx src/routes/InstallSkills.test.tsx src/styles/global.css
git commit -m "feat: display skills.sh leaderboard badges and support owner/repo shorthand installation"
```
