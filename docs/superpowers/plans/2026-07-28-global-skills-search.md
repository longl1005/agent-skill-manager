# Global Skills.sh Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time online search across 11,000+ open-source skills.sh / GitHub skills repositories directly inside the Install Skills page.

**Architecture:** Create `src/api/onlineSkillsApi.ts`, add live search state in `InstallSkills.tsx`, and render interactive online skill cards.

**Tech Stack:** React, TypeScript, GitHub / skills.sh REST API, Vitest.

## Global Constraints
- Full i18n support (`dict.ts`).
- Standard skill storage location: `~/.asm/skills/<name>`.
- 100% test coverage.

---

### Task 1: Create Online Skills Search API Helper

**Files:**
- Create: `src/api/onlineSkillsApi.ts`
- Create: `src/api/onlineSkillsApi.test.ts`

- [ ] **Step 1: Write test for onlineSkillsApi.ts**

```ts
import { describe, expect, it, vi } from "vitest";
import { searchOnlineSkills } from "./onlineSkillsApi";

describe("Online Skills Search API", () => {
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
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as any);

    const res = await searchOnlineSkills("frontend");
    expect(res.length).toBe(1);
    expect(res[0].ownerRepo).toBe("anthropics/skills");
    expect(res[0].stars).toBe(164547);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/api/onlineSkillsApi.test.ts`
Expected: FAIL ("cannot find module ./onlineSkillsApi").

- [ ] **Step 3: Implement onlineSkillsApi.ts**

```ts
export interface OnlineSkillResult {
  id: string;
  name: string;
  ownerRepo: string;
  description: string;
  stars: number;
  repoUrl: string;
  installsText: string;
}

export async function searchOnlineSkills(query: string): Promise<OnlineSkillResult[]> {
  const cleanQuery = query.trim();
  const searchParam = cleanQuery ? `${encodeURIComponent(cleanQuery)}+` : "";
  const url = `https://api.github.com/search/repositories?q=${searchParam}topic:agent-skills+sort:stars`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    if (!Array.isArray(data.items)) return [];

    return data.items.map((item: any) => {
      const stars = item.stargazers_count ?? 0;
      let starsFormatted = `${stars}`;
      if (stars >= 1000000) {
        starsFormatted = `${(stars / 1000000).toFixed(1)}M`;
      } else if (stars >= 1000) {
        starsFormatted = `${(stars / 1000).toFixed(1)}K`;
      }

      return {
        id: String(item.id || item.full_name),
        name: item.name,
        ownerRepo: item.full_name,
        description: item.description || "(No description)",
        stars,
        repoUrl: item.html_url,
        installsText: `★ ${starsFormatted}`,
      };
    });
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test src/api/onlineSkillsApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/api/onlineSkillsApi.ts src/api/onlineSkillsApi.test.ts
git commit -m "feat: add online skills search API helper querying GitHub agent-skills topic"
```

---

### Task 2: Connect Live Online Search to InstallSkills UI & i18n

**Files:**
- Modify: `src/routes/InstallSkills.tsx`
- Modify: `src/routes/InstallSkills.test.tsx`
- Modify: `src/locales/dict.ts`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add i18n keys for online search in dict.ts**

Add `installSkills.searchOnline`: "在全网 11,000+ 开源 Agent 技能库中搜索..." / "Search 11,000+ open-source skills on skills.sh & GitHub..."
Add `installSkills.searching`: "正在搜索全网技能..." / "Searching global registry..."
Add `installSkills.tabOnline`: "🌐 全网技能搜索" / "🌐 Live Online Search"

- [ ] **Step 2: Update InstallSkills.tsx**

Add `liveSearchQuery` and `onlineResults` state. When user types in search or switches to `online` tab, invoke `searchOnlineSkills`.
Render online skill cards with `skills.sh / GitHub` origin badge and "一键安装至主库" button.

- [ ] **Step 3: Update InstallSkills.test.tsx**

Test online search rendering and live result filtering.

- [ ] **Step 4: Run tests and build check**

Run: `(cd src-tauri && cargo test) && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/routes/InstallSkills.tsx src/routes/InstallSkills.test.tsx src/locales/dict.ts src/styles/global.css
git commit -m "feat: integrate live online skills.sh search across 11,000+ repositories into InstallSkills page"
```
