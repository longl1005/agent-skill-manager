# Install Skills Page Design Specification

## Overview
Design and implement a unified, multi-source "Install Skills" page (`src/routes/InstallSkills.tsx`) to allow users to discover, download, and import agent skills into the canonical Master Skill repository (`~/.asm/skills`) and instantly distribute symlinks to target Agents.

## User Interface & Tab Layout

### Header & Navigation
- Title: **安装技能 / Install Skills**
- Subtitle: **从开源技能市场、Git 仓库或本地目录一键安装并分发至 Agent**
- Tab Switching Bar:
  1. `🔥 热门技能市场` (`marketplace`)
  2. `🔗 Git / GitHub 网址安装` (`url`)
  3. `📁 本地目录导入` (`local`)

### 1. Marketplace Tab (热门技能市场)
- Category filters: `全部 (All)`, `UI/前端`, `工具与搜索`, `架构与设计`, `工作流`
- Curated Skill Cards grid displaying:
  - Skill Name & Icon
  - Description snippet
  - Target agent compatibility tags
  - Install Status: "已在主库 (In Master)" or "安装 (Install)" button

### 2. Git / URL Import Tab (网址安装)
- Input box supporting full git URLs (e.g., `https://github.com/user/skill-repo`) or shorthand (`owner/repo`).
- "解析并安装 (Fetch & Install)" button.
- Live progress indicator during download/cloning.

### 3. Local Import Tab (本地导入)
- Drag & Drop zone / Browse file picker button for local skill directories containing `SKILL.md`.
- Preview panel showing parsed skill metadata (Name, Description, File list).

### 4. Target Agent Distribution Modal (Agent 分发确认框)
- Triggered upon clicking "Install" or "Import".
- Allows user to select target Agents via toggle badges (`[x] Claude Code`, `[x] Codex`, `[x] Antigravity`, `[x] Pi Agent`, `[x] Open Code`, `[x] Cursor`).
- Action: Saves skill to `~/.asm/skills/<name>` and automatically creates symlinks in selected agent skill directories.

## Backend Tauri Commands & Frontend IPC
- `install_skill_from_url(url: String, target_agents: Vec<String>) -> Result<MasterSkillReport, String>`
- `import_local_skill_folder(path: String, target_agents: Vec<String>) -> Result<MasterSkillReport, String>`

## Verification & Test Plan
- Vitest unit tests for `InstallSkills.tsx` route covering tab switching, URL input validation, Marketplace card filtering, and agent selection modal.
- Verify production Vite build without errors.
