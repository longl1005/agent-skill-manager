# Global Skills.sh & GitHub Online Search Design Specification

## Overview
Expand the "Install Skills" page (`src/routes/InstallSkills.tsx`) to support real-time dynamic searching and browsing across the entire `skills.sh` / GitHub Agent Skills ecosystem (over 11,000+ open-source agent skills repositories).

## Features

### 1. Dynamic Search Bar & Live Registry Query
- Real-time search input box allowing searching any keyword (e.g. `react`, `testing`, `search`, `python`, `design`, `git`).
- Interacts with GitHub / skills.sh API (`q=topic:agent-skills+<keyword>`).
- Renders paginated / infinitely scrollable skill cards showing:
  - Skill Name & Repo (`owner/repo`)
  - Description snippet
  - Stars / Installs count (`★ 164.5K` / `⚡ 2.7M`)
  - Compatibility & License tags
  - Direct "Install to Master" button

### 2. Deep Repository Skill Extractor
- Supports repos containing single or multiple sub-folder skills (e.g. `anthropics/skills/frontend-design`).
- Analyzes repository tree to extract all valid `SKILL.md` folders.
- Prompts Target Agent Symlink Distribution modal.

## Verification & Testing Plan
- Vitest unit tests for live query parser and online skill search state management.
- Verify clean build (`pnpm build`).
