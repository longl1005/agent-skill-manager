# Direct skills.sh Directory Integration Design Specification

## Overview
Re-orient the Live Online Search feature in `InstallSkills.tsx` to directly query and parse the official [skills.sh](https://skills.sh) directory rather than GitHub's generic API.

## Design

### 1. `src/api/skillsShApi.ts`
- `fetchSkillsShDirectory(query?: string): Promise<SkillsShItem[]>`
- Fetches live HTML from `https://skills.sh`.
- Uses regex / DOM parser to extract all skill entries:
  - Skill Name (e.g., `find-skills`, `frontend-design`, `grill-me`, `agent-browser`, `web-design-guidelines`, `tdd`, `improve-codebase-architecture`, `microsoft-foundry`, `lark-approval`)
  - Owner / Repo (e.g., `vercel-labs/skills`, `anthropics/skills`, `mattpocock/skills`, `microsoft/azure-skills`)
  - Install metrics from skills.sh (e.g., `⚡ 2.7M`, `⚡ 709.5K`, `⚡ 675.3K`, `⚡ 553.9K`, `⚡ 532.9K`)
- Provides filtering by keyword across skill names and owner/repo.

### 2. UI Update in `InstallSkills.tsx`
- Tab Label: `⚡ skills.sh 官方全量库` / `⚡ skills.sh Directory`
- Displays cards parsed directly from `https://skills.sh`.
- Clicking "Install" triggers the Target Agent Symlink Distribution Modal.

## Verification & Testing
- Vitest unit test for HTML parser in `skillsShApi.test.ts`.
- Integration tests in `InstallSkills.test.tsx`.
- Vite build verification (`pnpm build`).
