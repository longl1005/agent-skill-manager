# Install Skills Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated "Install Skills" page (`src/routes/InstallSkills.tsx`) featuring a Marketplace tab, URL installer tab, Local folder import tab, and Target Agent Distribution modal.

**Architecture:** Create `InstallSkills.tsx`, register route `/install` in `App.tsx`, implement marketplace dataset (`src/data/featuredSkills.ts`), add IPC commands for URL & folder installation in Rust backend, and connect to Zustand stores.

**Tech Stack:** React, TypeScript, Zustand, Tauri IPC, CSS Variables.

## Global Constraints
- Full i18n support for Chinese and English.
- Target Master Skill storage location: `~/.asm/skills/<name>`.
- Vitest unit test coverage for all new components.

---

### Task 1: Create Featured Marketplace Data & Types

**Files:**
- Create: `src/data/featuredSkills.ts`
- Create: `src/data/featuredSkills.test.ts`

- [ ] **Step 1: Write test for featured skills dataset**

```ts
import { describe, expect, it } from "vitest";
import { FEATURED_SKILLS, getFeaturedSkillsByCategory } from "./featuredSkills";

describe("Featured Skills Data", () => {
  it("exports valid featured skills list with category filtering", () => {
    expect(FEATURED_SKILLS.length).toBeGreaterThan(0);
    const uiSkills = getFeaturedSkillsByCategory("ui");
    expect(uiSkills.every((s) => s.category === "ui")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/data/featuredSkills.test.ts`
Expected: FAIL ("cannot find module ./featuredSkills").

- [ ] **Step 3: Implement featuredSkills.ts**

```ts
export interface FeaturedSkill {
  id: string;
  name: string;
  category: "all" | "ui" | "search" | "workflow" | "architecture";
  description: Record<"zh" | "en", string>;
  author: string;
  repoUrl: string;
  fileCount: number;
}

export const FEATURED_SKILLS: FeaturedSkill[] = [
  {
    id: "frontend-design",
    name: "frontend-design",
    category: "ui",
    description: {
      zh: "注重视觉美感、排版与响应式体验的前端 UI 设计指南与组件规范",
      en: "Guidance for distinctive visual design and UI component patterns",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/frontend-design",
    fileCount: 2,
  },
  {
    id: "ui-ux-pro-max",
    name: "ui-ux-pro-max",
    category: "ui",
    description: {
      zh: "UI/UX 设计情报库，内置 67 种风格、161 种配色与 57 种字体搭配",
      en: "UI/UX design intelligence database with 67 styles and 161 palettes",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/ui-ux-pro-max",
    fileCount: 5,
  },
  {
    id: "free-search",
    name: "free-search",
    category: "search",
    description: {
      zh: "完全免费的 AI 联网搜索技能，支持维基百科与 DuckDuckGo 搜索",
      en: "Completely free web search engine using Wikipedia and DuckDuckGo",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/free-search",
    fileCount: 2,
  },
  {
    id: "tavily-search",
    name: "tavily-search",
    category: "search",
    description: {
      zh: "专为 AI Agent 优化的结构化网络检索与网页内容提取技能",
      en: "AI-optimized web search engine powered by Tavily API",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/tavily-search",
    fileCount: 4,
  },
  {
    id: "banner-design",
    name: "banner-design",
    category: "ui",
    description: {
      zh: "社交媒体、广告、网站 Hero 与全平台横幅 Banner 智能设计",
      en: "Design banners for social media, ads, website heroes, and print",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/banner-design",
    fileCount: 3,
  },
  {
    id: "systematic-debugging",
    name: "systematic-debugging",
    category: "workflow",
    description: {
      zh: "系统化 Bug 排查与根因诊断工作流指南",
      en: "Systematic debugging and root-cause analysis workflow",
    },
    author: "Superpowers",
    repoUrl: "https://github.com/superpowers/skills/systematic-debugging",
    fileCount: 2,
  },
];

export function getFeaturedSkillsByCategory(category: string): FeaturedSkill[] {
  if (category === "all") return FEATURED_SKILLS;
  return FEATURED_SKILLS.filter((s) => s.category === category);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test src/data/featuredSkills.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/data/featuredSkills.ts src/data/featuredSkills.test.ts
git commit -m "feat: add featured skills marketplace dataset"
```

---

### Task 2: Create InstallSkills Page Route & i18n Keys

**Files:**
- Create: `src/routes/InstallSkills.tsx`
- Create: `src/routes/InstallSkills.test.tsx`
- Modify: `src/locales/dict.ts`
- Modify: `src/App.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add i18n keys for Install Skills in dict.ts**

Add `installSkills.*` keys in `dict.ts` for Chinese and English.

- [ ] **Step 2: Create InstallSkills.test.tsx**

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InstallSkills from "./InstallSkills";
import { useMasterRepoStore } from "../stores/masterRepoStore";

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

describe("InstallSkills Route", () => {
  beforeEach(() => {
    vi.mocked(useMasterRepoStore).mockReturnValue({
      skills: [],
      fetchMasterSkills: vi.fn(),
      importToMaster: vi.fn(),
    } as any);
  });

  it("renders Install Skills header and tab navigation", () => {
    render(
      <MemoryRouter>
        <InstallSkills />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /安装技能|Install Skills/i })).toBeInTheDocument();
    expect(screen.getByText(/热门技能市场|Marketplace/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement InstallSkills.tsx component**

Render Header, Tab bar, Marketplace tab with search and category filter cards, URL installer tab, Local folder import tab, and Target Agent Modal.

- [ ] **Step 4: Update App.tsx route mapping**

Update `/install` route in `App.tsx` to render `<InstallSkills />`.

- [ ] **Step 5: Add styling in global.css**

Add styles for `.install-tabs`, `.install-marketplace-grid`, `.install-skill-card`, `.install-url-panel`, `.install-local-dropzone`.

- [ ] **Step 6: Run tests and build check**

Run: `(cd src-tauri && cargo test) && pnpm test && pnpm build`
Expected: PASS.

- [ ] **Step 7: Commit changes**

```bash
git add src/routes/InstallSkills.tsx src/routes/InstallSkills.test.tsx src/locales/dict.ts src/App.tsx src/styles/global.css
git commit -m "feat: implement dedicated Install Skills page with marketplace, url installer, and agent modal"
```
