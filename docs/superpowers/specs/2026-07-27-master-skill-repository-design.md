# Master Skill Repository (~/.asm/skills) & Symlink Distribution Design Spec

## Overview
The Master Skill Repository is the core single-source-of-truth storage directory located at `~/.asm/skills`. All genuine skills are stored physically in `~/.asm/skills/<skill-name>`. Individual AI agent skill directories (`~/.claude/skills`, `~/.codex/skills`, `~/.gemini/antigravity/skills`, `~/.pi/agent/skills`) maintain symbolic links (symlinks) pointing to the corresponding skill in `~/.asm/skills`.

## Core Features & Architecture

### 1. Master Repository Directory (`~/.asm/skills`)
- Created automatically on initial scan or app start if it does not exist.
- Contains canonical skill folders: `~/.asm/skills/<skill-name>/SKILL.md`.

### 2. Backend Modules (`src-tauri/src/modules/master_repo.rs`)
- `ensure_master_repo_exists()`: Guarantees `~/.asm/skills` directory exists.
- `scan_master_repo()`: Scans `~/.asm/skills` and returns installed master skills.
- `toggle_skill_symlink(agent_id, skill_name, enable)`:
  - If `enable == true`: Creates symlink `<agent_skills_root>/<skill_name>` -> `~/.asm/skills/<skill_name>`.
  - If `enable == false`: Removes symlink `<agent_skills_root>/<skill_name>`.
- `import_skill_to_master(agent_id, skill_name)`:
  - Moves skill from `<agent_skills_root>/<skill_name>` into `~/.asm/skills/<skill_name>`.
  - Creates symlink `<agent_skills_root>/<skill_name>` -> `~/.asm/skills/<skill_name>`.

### 3. Tauri IPC Commands (`src-tauri/src/commands.rs`)
- `get_master_skills`: Returns list of master skills with their distribution status across registered agents.
- `toggle_agent_skill`: Enables or disables a skill for a given agent via symlinking.
- `import_to_master`: Imports a unmanaged agent skill into the master repository.

### 4. Frontend UI (`Skill Library` `/library`)
- Displays all master skills in a modern grid card layout.
- Each skill card features an **Agent Link Matrix** showing status badges for Claude Code, Codex, Antigravity, and Pi Agent.
- Interactive toggle buttons on each agent badge to instantly link/unlink skills.
- Search and status filter (All, Linked, Unlinked).

## Data Types

```ts
export interface MasterSkill {
  name: string;
  description: string;
  path: string;
  fingerprint?: string;
  linkedAgents: Record<string, boolean>; // { "claude-code": true, "codex": false, ... }
}
```

## Verification Plan
1. Test symlink creation and deletion for all 4 supported agents (`cargo test`).
2. Test importing a non-symlinked skill into `~/.asm/skills`.
3. Verify frontend `Skill Library` correctly renders master skills and updates agent link toggles reactively.
4. Run `pnpm test` and `pnpm build` to verify clean build and passing tests.
