# Master Skill Repository (~/.asm/skills) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Master Skill Repository (`~/.asm/skills`) for canonical skill storage and symbolic link distribution management across all AI Agents (Claude Code, Codex, Antigravity, Pi Agent).

**Architecture:**
- Rust Backend: Create `master_repo.rs` providing `scan_master_repo`, `toggle_skill_symlink`, and `import_skill_to_master` functions. Register commands in `commands.rs`.
- Frontend: Update `src/ipc/commands.ts`, create `src/stores/masterRepoStore.ts`, and enhance `Skill Library` (`src/routes/SkillLibrary.tsx`) with an interactive Agent distribution toggle matrix.

**Tech Stack:** Rust (std::fs, std::os::unix::fs::symlink), Tauri IPC, React 18, Zustand, Vitest, Vite, TypeScript.

## Global Constraints
- Master repository path: `~/.asm/skills`.
- Operating system symlink support: Unix symlink (`std::os::unix::fs::symlink` / `std::fs::remove_file` / `std::fs::remove_dir_all`).

---

### Task 1: Rust Backend Master Repository Module & Symlink Manager

**Files:**
- Create: `src-tauri/src/modules/master_repo.rs`
- Modify: `src-tauri/src/modules/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Test: `src-tauri/src/modules/master_repo.rs` (unit tests inside module)

**Interfaces:**
- Consumes: `user_home_dir()`, `AgentAdapter`
- Produces: `get_master_skills`, `toggle_agent_skill`, `import_to_master` Tauri IPC commands

- [ ] **Step 1: Write `src-tauri/src/modules/master_repo.rs` with core structs, symlink operations, and unit tests**

```rust
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::modules::platform::user_home_dir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterSkillReport {
    pub name: String,
    pub description: String,
    pub path: String,
    pub linked_agents: HashMap<String, bool>,
}

pub fn master_repo_dir() -> PathBuf {
    let home = user_home_dir().unwrap_or_else(|| PathBuf::from("/"));
    home.join(".asm").join("skills")
}

pub fn ensure_master_repo_dir() -> std::io::Result<PathBuf> {
    let dir = master_repo_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn create_skill_symlink(master_skill_path: &Path, target_symlink: &Path) -> std::io::Result<()> {
    if let Some(parent) = target_symlink.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    if target_symlink.exists() || fs::symlink_metadata(target_symlink).is_ok() {
        let _ = fs::remove_file(target_symlink);
        let _ = fs::remove_dir_all(target_symlink);
    }
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(master_skill_path, target_symlink)?;
    }
    Ok(())
}

pub fn remove_skill_symlink(target_symlink: &Path) -> std::io::Result<()> {
    if target_symlink.exists() || fs::symlink_metadata(target_symlink).is_ok() {
        let _ = fs::remove_file(target_symlink);
        let _ = fs::remove_dir_all(target_symlink);
    }
    Ok(())
}
```

- [ ] **Step 2: Run `cargo test` to verify module passes unit tests**

Run: `(cd src-tauri && cargo test)`
Expected: PASS

- [ ] **Step 3: Register Tauri IPC commands in `src-tauri/src/commands.rs`**

Add `get_master_skills`, `toggle_agent_skill`, and `import_to_master` Tauri commands.

---

### Task 2: Frontend IPC Wrappers & Master Repository Store

**Files:**
- Modify: `src/ipc/commands.ts`
- Modify: `src/ipc/types.ts`
- Create: `src/stores/masterRepoStore.ts`
- Create: `src/stores/masterRepoStore.test.ts`

**Interfaces:**
- Consumes: Tauri `invoke`
- Produces: `useMasterRepoStore` Zustand store with `fetchMasterSkills`, `toggleAgentSkill`, `importToMaster`

- [ ] **Step 1: Update DTO types in `src/ipc/types.ts`**

Add `MasterSkillReport` type:
```ts
export interface MasterSkillReport {
  name: string;
  description: string;
  path: string;
  linked_agents: Record<string, boolean>;
}
```

- [ ] **Step 2: Add IPC functions in `src/ipc/commands.ts`**

```ts
export async function getMasterSkills(): Promise<MasterSkillReport[]> {
  return invoke<MasterSkillReport[]>("get_master_skills");
}

export async function toggleAgentSkill(agentId: string, skillName: string, enable: boolean): Promise<boolean> {
  return invoke<boolean>("toggle_agent_skill", { agentId, skillName, enable });
}
```

- [ ] **Step 3: Create `src/stores/masterRepoStore.ts`**

Zustand store managing master skill reports and trigger actions.

- [ ] **Step 4: Create `src/stores/masterRepoStore.test.ts`**

Vitest unit test for `masterRepoStore`.

- [ ] **Step 5: Run Vitest tests**

Run: `pnpm test src/stores/masterRepoStore.test.ts`
Expected: PASS

---

### Task 3: Interactive Skill Library & Agent Link Matrix UI

**Files:**
- Modify: `src/routes/SkillLibrary.tsx`
- Modify: `src/routes/SkillLibrary.test.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Update `src/routes/SkillLibrary.tsx`**

Render all Master Skills from `~/.asm/skills` in a grid, showing each skill's metadata and interactive Agent Link Matrix badges (Claude Code, Codex, Antigravity, Pi Agent) to toggle symlinks instantaneously.

- [ ] **Step 2: Add CSS styles in `src/styles/global.css`**

Add styling for Master Skill card, Agent Link Matrix badges, and status toggle buttons.

- [ ] **Step 3: Run full tests and build**

Run: `(cd src-tauri && cargo test) && pnpm test && pnpm build`
Expected: PASS clean.

---
