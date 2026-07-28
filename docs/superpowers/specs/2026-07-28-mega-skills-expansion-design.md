# Mega Skills Expansion Engine Specification

## Overview
Expand the skill discovery ecosystem in Agent Skill Manager by combining the direct `skills.sh` directory with live GitHub Topic API searches (`topic:agent-skills`, `topic:claude-skills`, `topic:agent-skill`) covering over 11,900+ open-source agent skill repositories.

## Features

### 1. Unified Global Search API (`src/api/globalSkillsSearch.ts`)
- Merges results from `skills.sh` leaderboard and GitHub Topic Search API.
- Supports sorting by:
  - **Most Starred / Installs (热门 Star 榜)**
  - **Recently Updated (最新更新榜)**
- Supports pagination (`page = 1, 2, 3...`) returning 20-30 items per page.

### 2. UI Enhancements in `InstallSkills.tsx`
- Search bar with Sorting controls: `[ ⚡ skills.sh & GitHub 全量库 (11,900+) ]`
- Sort Selector: `[ 最热 (Most Stars/Installs) | 最新 (Recently Updated) ]`
- Pagination Bar: `< 上一页 | 第 1 页 | 下一页 >`
- Interactive cards rendering:
  - Skill Name & `owner/repo`
  - Origin badge (`skills.sh Verified` / `GitHub Open Source`)
  - Description snippet
  - Install metrics / Star count
  - 1-Click Install button with Target Agent Symlink Distribution Modal!

## Verification & Testing Plan
- Vitest unit tests for pagination, sorting, and API merging.
- Vite build verification (`pnpm build`).
