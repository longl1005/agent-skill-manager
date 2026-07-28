# Language Switching (i18n) Design Spec

## Overview
Add a language switching feature to the Agent Skill Manager (ASM) Settings page, supporting Simplified Chinese (`zh`, default) and English (`en`). Selecting a language dynamically updates all UI text across the entire application and persists the preference in `localStorage`.

## User Requirements
- Language options: Simplified Chinese (`zh`, default) and English (`en`).
- Controls placed inside the **Settings** page (`src/routes/Settings.tsx`).
- Instant reactive UI update across all navigation, labels, buttons, and headers without requiring app reload.

## Architecture & Components

### 1. State Store (`src/stores/i18nStore.ts`)
- Zustand store with `persist` middleware.
- `lang`: `"zh" | "en"` (default: `"zh"`).
- `setLanguage`: `(lang: Language) => void`.
- Storage key: `asm_app_language`.

### 2. Locale Dictionary (`src/locales/dict.ts`)
- Structured key-value dictionary for both Chinese and English:
  - Navigation (Dashboard, Skill Library, Install Skills, All Agents, Settings, Discovered Agents).
  - Common actions (Save, Reset, Reset All, Active, Overridden, Copy Path).
  - Page Headers & Descriptions (Settings, Dashboard, Agent Detail, Skill Library).
  - Status Labels (Detected, Not Detected, Partial, Consistent, Conflict, Unknown).

### 3. Settings UI Component (`src/routes/Settings.tsx`)
- New section **Language Settings / 语言设置**.
- Radio cards for `简体中文 (Simplified Chinese)` and `English`.
- Active indicator badge (`✓ 已生效` / `✓ Active`).

### 4. Integration Points
- `AppSidebar.tsx`: Uses `i18nStore` for sidebar labels.
- `Settings.tsx`: Theme section, path settings, language section labels.
- `Agents.tsx` & `AgentDetail.tsx`: Header titles, status text.

## Verification Plan
1. Toggle language between Chinese and English in Settings.
2. Confirm instant reactive translation of Sidebar navigation, Settings cards, headers, and action buttons.
3. Reload application and verify language preference persists from `localStorage`.
4. Run `pnpm test` and `pnpm build` to ensure clean TypeScript compilation and test passes.
