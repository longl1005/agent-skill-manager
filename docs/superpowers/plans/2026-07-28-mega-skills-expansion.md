# Mega Skills Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate live GitHub Topic API search (11,900+ repositories) with skills.sh catalog, pagination, and sort options into `InstallSkills.tsx`.

**Architecture:** Create `src/api/globalSkillsSearch.ts`, update `InstallSkills.tsx`, `dict.ts`, and test suites.

---

### Task 1: Create Global Skills Search Helper & Tests

**Files:**
- Create: `src/api/globalSkillsSearch.ts`
- Create: `src/api/globalSkillsSearch.test.ts`

- [ ] **Step 1: Write test for globalSkillsSearch.ts**

```ts
import { describe, expect, it, vi } from "vitest";
import { searchGlobalSkills } from "./globalSkillsSearch";

describe("Global Skills Search API", () => {
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
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/api/globalSkillsSearch.test.ts`
Expected: FAIL ("cannot find module ./globalSkillsSearch").

- [ ] **Step 3: Implement globalSkillsSearch.ts**

```ts
import { SKILLS_SH_LEADERBOARD, fetchSkillsShDirectory, type SkillsShItem } from "./skillsShApi";

export interface GlobalSkillItem {
  id: string;
  name: string;
  ownerRepo: string;
  description: string;
  installsText: string;
  repoUrl: string;
  skillsShUrl?: string;
  isVerifiedSkillsSh?: boolean;
}

export interface GlobalSkillsSearchOptions {
  query?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "stars" | "updated";
}

export interface GlobalSkillsSearchResult {
  items: GlobalSkillItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export async function searchGlobalSkills(
  options: GlobalSkillsSearchOptions = {}
): Promise<GlobalSkillsSearchResult> {
  const { query = "", page = 1, pageSize = 20, sortBy = "stars" } = options;
  const q = query.trim().toLowerCase();

  // 1. Filter local/skills.sh directory items first
  const skillsShItems: GlobalSkillItem[] = SKILLS_SH_LEADERBOARD.map((item) => ({
    id: item.id,
    name: item.name,
    ownerRepo: item.ownerRepo,
    description: item.description,
    installsText: item.installsText,
    repoUrl: item.githubUrl,
    skillsShUrl: item.skillsShUrl,
    isVerifiedSkillsSh: true,
  })).filter(
    (item) =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.ownerRepo.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q)
  );

  // 2. Fetch live GitHub topic API items
  let gitHubItems: GlobalSkillItem[] = [];
  let gitHubTotal = 0;

  try {
    const sortParam = sortBy === "updated" ? "updated" : "stars";
    const queryParam = q ? `${encodeURIComponent(q)}+` : "";
    const url = `https://api.github.com/search/repositories?q=${queryParam}topic:agent-skills+sort:${sortParam}&page=${page}&per_page=${pageSize}`;

    const resp = await fetch(url);
    if (resp.ok) {
      const data = await resp.json();
      gitHubTotal = data.total_count || 0;
      if (Array.isArray(data.items)) {
        gitHubItems = data.items.map((item: any) => {
          const stars = item.stargazers_count ?? 0;
          let starsFormatted = `${stars}`;
          if (stars >= 1000000) {
            starsFormatted = `${(stars / 1000000).toFixed(1)}M`;
          } else if (stars >= 1000) {
            starsFormatted = `${(stars / 1000).toFixed(1)}K`;
          }

          return {
            id: String(item.full_name || item.id),
            name: item.name,
            ownerRepo: item.full_name,
            description: item.description || `Open-source agent skill from ${item.full_name}`,
            installsText: `★ ${starsFormatted}`,
            repoUrl: item.html_url,
            isVerifiedSkillsSh: false,
          };
        });
      }
    }
  } catch {
    // Ignore fetch network errors
  }

  // 3. Deduplicate and merge items
  const seenIds = new Set<string>();
  const mergedItems: GlobalSkillItem[] = [];

  // Add skills.sh verified items first for page 1
  if (page === 1) {
    for (const item of skillsShItems) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        mergedItems.push(item);
      }
    }
  }

  for (const item of gitHubItems) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      mergedItems.push(item);
    }
  }

  const totalCount = Math.max(gitHubTotal, skillsShItems.length);

  return {
    items: mergedItems,
    totalCount,
    page,
    pageSize,
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test src/api/globalSkillsSearch.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/api/globalSkillsSearch.ts src/api/globalSkillsSearch.test.ts
git commit -m "feat: add global skills search helper merging skills.sh and 11,900+ GitHub topic repositories"
```

---

### Task 2: Connect Mega Search Engine to InstallSkills UI & Pagination

**Files:**
- Modify: `src/routes/InstallSkills.tsx`
- Modify: `src/routes/InstallSkills.test.tsx`
- Modify: `src/locales/dict.ts`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update dict.ts with i18n keys**

Add `installSkills.tabOnline`: "🌐 全网 11,900+ 技能库" / "🌐 Global 11,900+ Registry"
Add `installSkills.searchOnlinePlaceholder`: "搜索全网 11,900+ 技能 (如 react, python, tdd, search, design)..." / "Search 11,900+ agent skills..."
Add `installSkills.sortByStars`: "最热 Star 榜" / "Most Starred"
Add `installSkills.sortByUpdated`: "最新更新" / "Recently Updated"
Add `installSkills.pagePrev`: "上一页" / "Previous"
Add `installSkills.pageNext`: "下一页" / "Next"

- [ ] **Step 2: Update InstallSkills.tsx**

Use `searchGlobalSkills`.
Add state for `onlinePage`, `onlineSortBy`, `totalOnlineCount`.
Render sorting bar and pagination buttons.

- [ ] **Step 3: Run tests and Vite build**

Run: `(cd src-tauri && cargo test) && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit changes**

```bash
git add src/routes/InstallSkills.tsx src/routes/InstallSkills.test.tsx src/locales/dict.ts src/styles/global.css
git commit -m "feat: connect 11,900+ repository mega search engine with pagination and sorting to InstallSkills page"
```
