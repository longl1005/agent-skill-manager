# Language Switching (i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Simplified Chinese (`zh`, default) and English (`en`) language switching to the Settings page, allowing users to dynamically switch language across the entire application with instant UI updates and `localStorage` persistence.

**Architecture:** Create `i18nStore.ts` using Zustand with `persist` middleware. Create a structured translation dictionary `locales/dict.ts` mapping translation keys for `zh` and `en`. Update components (`AppSidebar.tsx`, `Settings.tsx`, `Agents.tsx`, `AgentDetail.tsx`) to consume the active language translation.

**Tech Stack:** React 18, Zustand, Vitest, Vite, TypeScript.

## Global Constraints
- Language options: `"zh"` (Simplified Chinese, default) and `"en"` (English).
- Persistence key: `"asm_app_language"`.

---

### Task 1: Create i18n Store and Translation Dictionary

**Files:**
- Create: `src/stores/i18nStore.ts`
- Create: `src/locales/dict.ts`
- Create: `src/stores/i18nStore.test.ts`

**Interfaces:**
- Consumes: Zustand `create` & `persist`
- Produces: `useI18nStore`, `Language` type (`"zh" | "en"`), `t(key, lang)` helper function

- [ ] **Step 1: Write the failing test for i18nStore**

```tsx
import { describe, expect, it, beforeEach } from "vitest";
import { useI18nStore } from "./i18nStore";
import { t } from "../locales/dict";

describe("i18nStore & dict", () => {
  beforeEach(() => {
    useI18nStore.getState().setLanguage("zh");
  });

  it("defaults to zh language", () => {
    expect(useI18nStore.getState().lang).toBe("zh");
    expect(t("settings.title", "zh")).toBe("设置");
  });

  it("switches language to en and translates correctly", () => {
    useI18nStore.getState().setLanguage("en");
    expect(useI18nStore.getState().lang).toBe("en");
    expect(t("settings.title", "en")).toBe("Settings");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/stores/i18nStore.test.ts`
Expected: FAIL due to missing files.

- [ ] **Step 3: Implement `src/locales/dict.ts`**

```ts
export type Language = "zh" | "en";

export const dict = {
  zh: {
    // Navigation
    "nav.dashboard": "仪表盘",
    "nav.library": "技能库",
    "nav.install": "安装技能",
    "nav.allAgents": "所有智能体",
    "nav.discoveredAgents": "已发现智能体",
    "nav.settings": "设置",

    // Settings
    "settings.title": "设置",
    "settings.subtitle": "管理系统偏好与 Agent 技能目录配置",
    "settings.appearance.title": "外观主题",
    "settings.appearance.desc": "选择应用程序的视觉主题模式",
    "settings.theme.light": "浅色模式",
    "settings.theme.lightDesc": "适合白天的清爽干净视觉体验",
    "settings.theme.dark": "深色模式",
    "settings.theme.darkDesc": "适合暗光环境的极客暗色体验",
    "settings.theme.system": "跟随系统",
    "settings.theme.systemDesc": "根据操作系统设置自动切换主题",
    "settings.active": "✓ 已生效",
    "settings.lang.title": "语言 / Language",
    "settings.lang.desc": "选择控制台界面显示的语言（支持中文和英文）",
    "settings.lang.zh": "简体中文",
    "settings.lang.zhDesc": "默认语言 (Simplified Chinese)",
    "settings.lang.en": "English",
    "settings.lang.enDesc": "英文界面 (English Interface)",
    "settings.paths.title": "Agent 技能目录配置",
    "settings.paths.desc": "为每个 Agent 配置自定义技能目录路径，覆盖自动检测路径",
    "settings.paths.resetAll": "一键重置所有路径",
    "settings.paths.default": "默认",
    "settings.paths.overridden": "已覆盖",
    "settings.paths.placeholder": "输入自定义绝对路径",
    "settings.paths.save": "保存",
    "settings.paths.reset": "重置",
  },
  en: {
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.library": "Skill Library",
    "nav.install": "Install Skills",
    "nav.allAgents": "All Agents",
    "nav.discoveredAgents": "Discovered Agents",
    "nav.settings": "Settings",

    // Settings
    "settings.title": "Settings",
    "settings.subtitle": "Manage system preferences and agent skill path configurations",
    "settings.appearance.title": "Appearance",
    "settings.appearance.desc": "Select your preferred color theme for the interface",
    "settings.theme.light": "Light Mode",
    "settings.theme.lightDesc": "Bright, clean visual appearance for day time",
    "settings.theme.dark": "Dark Mode",
    "settings.theme.darkDesc": "Sleek dark theme, easy on the eyes in low light",
    "settings.theme.system": "System Preference",
    "settings.theme.systemDesc": "Automatically switch theme based on OS settings",
    "settings.active": "✓ Active",
    "settings.lang.title": "Language",
    "settings.lang.desc": "Select your preferred interface language (Chinese / English)",
    "settings.lang.zh": "简体中文",
    "settings.lang.zhDesc": "Simplified Chinese (Default)",
    "settings.lang.en": "English",
    "settings.lang.enDesc": "English Interface",
    "settings.paths.title": "Agent Skills Directory Configurations",
    "settings.paths.desc": "Configure custom skills directory paths for each Agent to override auto-detection",
    "settings.paths.resetAll": "Reset All Paths",
    "settings.paths.default": "Default",
    "settings.paths.overridden": "Overridden",
    "settings.paths.placeholder": "Enter custom path",
    "settings.paths.save": "Save",
    "settings.paths.reset": "Reset",
  },
} as const;

export type TranslationKey = keyof typeof dict.zh;

export function t(key: TranslationKey, lang: Language): string {
  return dict[lang]?.[key] ?? dict.zh[key] ?? key;
}
```

- [ ] **Step 4: Implement `src/stores/i18nStore.ts`**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Language } from "../locales/dict";

export interface I18nStore {
  lang: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      lang: "zh",
      setLanguage: (lang: Language) => set({ lang }),
    }),
    {
      name: "asm_app_language",
    }
  )
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test src/stores/i18nStore.test.ts`
Expected: PASS

---

### Task 2: Integrate Language Switcher & Translations into Settings Page

**Files:**
- Modify: `src/routes/Settings.tsx`
- Modify: `src/routes/Settings.test.tsx`

- [ ] **Step 1: Update `src/routes/Settings.tsx` to include Language section and reactive translation**

In `Settings.tsx`, import `useI18nStore` and `t`, render the Language section radio cards, and update all static strings to use `t(key, lang)`.

- [ ] **Step 2: Update `src/routes/Settings.test.tsx` to test switching language**

Verify that clicking the English option updates active badge and translations in `Settings.tsx`.

- [ ] **Step 3: Run Vitest tests**

Run: `pnpm test src/routes/Settings.test.tsx`
Expected: PASS

---

### Task 3: Integrate Translation into App Sidebar Component

**Files:**
- Modify: `src/components/AppSidebar.tsx`
- Modify: `src/components/AppSidebar.test.tsx`

- [ ] **Step 1: Update `src/components/AppSidebar.tsx` to use `t(key, lang)` for menu labels**

Translate Dashboard, Skill Library, Install Skills, Discovered Agents, All Agents, Settings using `useI18nStore`.

- [ ] **Step 2: Run all tests & Vite build check**

Run: `pnpm test && pnpm build`
Expected: PASS clean.

---
