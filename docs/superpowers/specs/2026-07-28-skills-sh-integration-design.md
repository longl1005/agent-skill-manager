# skills.sh Integration Design Specification

## Overview
Deeply integrate [skills.sh](https://skills.sh) (The Open Agent Skills Ecosystem by Vercel/Anthropics/Community) into Agent Skill Manager (ASM).
Users can browse the official `skills.sh` leaderboard with live installation metrics (e.g. `2.7M` installs), search any community skill by `owner/repo`, and install directly into `~/.asm/skills` with automatic target Agent symlink distribution.

## Key Features

### 1. `skills.sh` Official Leaderboard & Community Hub
- Show official `skills.sh` verified badge on featured skills cards.
- Display install metrics (`2.7M installs`, `709K installs`, `675K installs`, etc.).
- Top skills included:
  - `find-skills` (`vercel-labs/skills`) - 2.7M installs
  - `frontend-design` (`anthropics/skills`) - 709K installs
  - `grill-me` (`mattpocock/skills`) - 675K installs
  - `agent-browser` (`vercel-labs/agent-browser`) - 583K installs
  - `ui-ux-pro-max` (`superpowers/skills`) - 420K installs
  - `free-search` (`superpowers/skills`) - 350K installs
  - `tavily-search` (`superpowers/skills`) - 310K installs
  - `banner-design` (`superpowers/skills`) - 280K installs
  - `systematic-debugging` (`superpowers/skills`) - 250K installs

### 2. `skills.sh` Shorthand URL Parser & Git Importer
- Supports inputs in all formats:
  - `owner/repo` (e.g. `anthropics/skills` or `mattpocock/skills`)
  - `https://github.com/owner/repo`
  - `https://skills.sh/owner/repo/skill-name`
- Automatically resolves repo files, extracts `SKILL.md`, and places the skill directory into `~/.asm/skills/<name>`.

### 3. Target Agent Symlink Distribution
- Prompts user to select target Agents (`Claude Code`, `Codex`, `Antigravity`, `Pi Agent`, `Open Code`, `Cursor`).
- Instantly creates symlinks in target Agent skills directories.

## Technical Architecture
- Frontend: `src/data/featuredSkills.ts`, `src/routes/InstallSkills.tsx`.
- Rust Backend: `src-tauri/src/modules/master_repo.rs` - Add `import_skill_from_git_repo` or GitHub tarball downloader.
- Tauri IPC: `import_git_skill(repo_url: String, target_agents: Vec<String>) -> Result<MasterSkillReport, String>`.

## Verification & Test Plan
- Vitest unit tests for `skills.sh` shorthand parsing and card rendering.
- Rust unit tests for git/tarball repo extraction.
- End-to-end Vite build validation.
