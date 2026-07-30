# Agent Management Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a detected Agent to be disabled after confirmation, removing only ASM-managed skill symlinks; enabling it again does not restore links.

**Architecture:** Persist disabled Agent IDs in the existing local Agent configuration store. Add a Tauri command that examines each master skill and removes an Agent path only when it is a valid symlink to that master skill. The settings UI toggles that state, confirms destructive disable actions, and refreshes scan and master-repository data.

**Tech Stack:** React, Zustand, Tauri 2, Rust std::fs, Vitest, Rust unit tests.

## Global Constraints

- Do not create a worktree; the user requested changes in the current workspace.
- Disable removes only symlinks that resolve to the configured ASM master repository.
- User-created files, directories, and symlinks to any other destination must remain untouched.
- Enabling an Agent never recreates prior links.

---

### Task 1: Safely unlink an Agent in the Rust backend

**Files:**
- Modify: `src-tauri/src/modules/master_repo.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `unlink_all_agent_skills(agent_id, custom_paths) -> io::Result<usize>`.
- Produces: Tauri command `unlink_all_agent_skills(agent_id, custom_paths) -> Result<usize, String>`.

- [ ] **Step 1: Write failing Rust tests** for a master skill symlink and a non-ASM file in the same Agent directory; assert the symlink is removed and the file remains.
- [ ] **Step 2: Run the focused Rust test** with `cargo test unlink_all_agent_skills` and verify it fails before implementation.
- [ ] **Step 3: Implement `unlink_all_agent_skills`** by iterating master-skill directories, using `is_valid_symlink_to` before calling `remove_skill_symlink`, and logging each successful unlink as `UNLINK_SKILL`.
- [ ] **Step 4: Register the Tauri command** in `commands.rs` and `lib.rs` with the same optional custom-path parameter used by existing link commands.
- [ ] **Step 5: Run the focused Rust test** and verify it passes.

### Task 2: Add persisted Agent management state and IPC wrapper

**Files:**
- Modify: `src/stores/agentConfigStore.ts`
- Modify: `src/ipc/commands.ts`
- Modify: `src/stores/masterRepoStore.ts`
- Test: `src/stores/agentConfigStore.test.ts` (create if absent)

**Interfaces:**
- Produces: `disabledAgentIds: string[]` and `setAgentDisabled(agentId, disabled)`.
- Produces: `unlinkAllAgentSkills(agentId, customPaths?): Promise<number>`.
- Produces: `unlinkAllAgentSkills(agentId): Promise<number | null>` in the master repository store, refreshing master-skill and scan data after success.

- [ ] **Step 1: Write failing store tests** showing Agent IDs can be disabled and re-enabled without changing custom path values.
- [ ] **Step 2: Run the store test** and verify it fails before adding the state/action.
- [ ] **Step 3: Add persisted disabled-ID state** and the explicit `setAgentDisabled` action; preserve existing persisted custom paths.
- [ ] **Step 4: Add IPC and master-repository-store wrappers** that pass custom paths and refresh both derived data sources after a successful backend unlink.
- [ ] **Step 5: Run store tests** and verify they pass.

### Task 3: Add the settings switch and destructive confirmation

**Files:**
- Modify: `src/routes/Settings.tsx`
- Modify: `src/routes/Settings.test.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/locales/dict.ts`

**Interfaces:**
- Consumes: `setAgentDisabled(agentId, disabled)` and `unlinkAllAgentSkills(agentId)`.
- Renders: a switch per detected Agent, a confirmation dialog before disabling, and an inactive card state after disable.

- [ ] **Step 1: Write failing route tests** that verify disabling opens a warning, cancelling preserves enabled state, confirming calls the unlink action, and re-enabling does not call it.
- [ ] **Step 2: Run the focused route test** and verify it fails before UI implementation.
- [ ] **Step 3: Implement a compact per-Agent switch** in the card header. When switching off, open a native confirmation dialog describing that all ASM skill links for that Agent will be removed.
- [ ] **Step 4: On confirmation, unlink before persisting disabled state**; on error, leave the switch enabled and show an inline error. On enable, only clear disabled state.
- [ ] **Step 5: Style active/inactive cards and switch** while retaining two-column layout and accessible labels.
- [ ] **Step 6: Run focused route tests** and verify they pass.

### Task 4: Verify the feature end-to-end

**Files:**
- Modify: none

- [ ] **Step 1: Run `cargo test`** from `src-tauri`.
- [ ] **Step 2: Run `pnpm test`** from the repository root.
- [ ] **Step 3: Run `pnpm build`** from the repository root.
