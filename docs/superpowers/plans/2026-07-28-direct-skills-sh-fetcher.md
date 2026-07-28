# Direct skills.sh Directory Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace generic GitHub topic search with a direct HTML scraper / API client for `https://skills.sh` so users can search and install skills indexed directly on skills.sh.

**Architecture:** Create `src/api/skillsShApi.ts`, test in `skillsShApi.test.ts`, update `InstallSkills.tsx`, `dict.ts`, and test suites.

---

### Task 1: Create direct skills.sh API Parser Helper

**Files:**
- Create: `src/api/skillsShApi.ts`
- Create: `src/api/skillsShApi.test.ts`

- [ ] **Step 1: Write test for skillsShApi.ts**

```ts
import { describe, expect, it, vi } from "vitest";
import { parseSkillsShHtml } from "./skillsShApi";

describe("skills.sh HTML Parser", () => {
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
    expect(res[0].name).toBe("frontend-design");
    expect(res[0].ownerRepo).toBe("anthropics/skills");
    expect(res[0].installsText).toBe("⚡ 709.5K");
    expect(res[1].name).toBe("tdd");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/api/skillsShApi.test.ts`
Expected: FAIL ("cannot find module ./skillsShApi").

- [ ] **Step 3: Implement skillsShApi.ts**

```ts
export interface SkillsShItem {
  id: string;
  name: string;
  ownerRepo: string;
  description: string;
  installsText: string;
  skillsShUrl: string;
  githubUrl: string;
}

export function parseSkillsShHtml(html: string): SkillsShItem[] {
  const items: SkillsShItem[] = [];

  // Match href="/owner/repo/skill-name" or href="/owner/repo"
  const hrefRegex = /href="\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:\/([a-zA-Z0-9_-]+))?"[\s\S]*?<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p[^>]*>([^<]+)<\/p>[\s\S]*?<span[^>]*>([0-9.]+[KKM]? installs|[0-9.]+[KKM]?)<\/span>/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const owner = match[1];
    const repo = match[2];
    const skillPathName = match[3] || match[4].trim();
    const name = match[4].trim();
    const ownerRepo = match[5].trim() || `${owner}/${repo}`;
    const installsStr = match[6].trim();

    items.push({
      id: `${ownerRepo}/${name}`,
      name,
      ownerRepo,
      description: `Official skill from ${ownerRepo} on skills.sh`,
      installsText: installsStr.startsWith("⚡") ? installsStr : `⚡ ${installsStr}`,
      skillsShUrl: `https://skills.sh/${owner}/${repo}/${skillPathName}`,
      githubUrl: `https://github.com/${owner}/${repo}`,
    });
  }

  // Fallback: If regex didn't catch, extract href="/..." links
  if (items.length === 0) {
    const simpleRegex = /href="\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)"/g;
    const seen = new Set<string>();
    while ((match = simpleRegex.exec(html)) !== null) {
      const owner = match[1];
      const repo = match[2];
      const name = match[3];
      const key = `${owner}/${repo}/${name}`;
      if (!seen.has(key) && !["topic", "agent", "official", "audits", "docs"].includes(owner)) {
        seen.add(key);
        items.push({
          id: key,
          name,
          ownerRepo: `${owner}/${repo}`,
          description: `Skill ${name} from ${owner}/${repo} indexed on skills.sh`,
          installsText: "⚡ Installed on skills.sh",
          skillsShUrl: `https://skills.sh/${owner}/${repo}/${name}`,
          githubUrl: `https://github.com/${owner}/${repo}`,
        });
      }
    }
  }

  return items;
}

export async function fetchSkillsShDirectory(query?: string): Promise<SkillsShItem[]> {
  try {
    const resp = await fetch("https://skills.sh");
    if (!resp.ok) return [];
    const html = await resp.text();
    const allItems = parseSkillsShHtml(html);

    if (!query || !query.trim()) {
      return allItems;
    }

    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        item.ownerRepo.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test src/api/skillsShApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/api/skillsShApi.ts src/api/skillsShApi.test.ts
git commit -m "feat: add direct skills.sh HTML scraper and parser"
```

---

### Task 2: Update InstallSkills Page & i18n to Direct skills.sh Directory

**Files:**
- Modify: `src/routes/InstallSkills.tsx`
- Modify: `src/routes/InstallSkills.test.tsx`
- Modify: `src/locales/dict.ts`

- [ ] **Step 1: Update dict.ts**

Update `installSkills.tabOnline`: "⚡ skills.sh 官方全量库" / "⚡ skills.sh Directory"
Update `installSkills.searchOnlinePlaceholder`: "搜索 skills.sh 官方全量技能 (如 frontend-design, tdd, web, react)..." / "Search skills.sh directory..."
Update `installSkills.searching`: "正在拉取 skills.sh 全量技能目录..." / "Fetching skills.sh directory..."

- [ ] **Step 2: Update InstallSkills.tsx**

Use `fetchSkillsShDirectory` from `../api/skillsShApi`.
Render `skills.sh` direct items with `⚡ installsText` and `skills.sh` link badge.

- [ ] **Step 3: Run tests and Vite build**

Run: `(cd src-tauri && cargo test) && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit changes**

```bash
git add src/routes/InstallSkills.tsx src/routes/InstallSkills.test.tsx src/locales/dict.ts
git commit -m "feat: direct integration with skills.sh live directory for searching and installing skills"
```
