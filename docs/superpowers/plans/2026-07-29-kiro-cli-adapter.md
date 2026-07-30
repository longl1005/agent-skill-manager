# Kiro CLI Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Kiro CLI as a separately managed skills agent.

**Architecture:** Add a Rust `KiroAdapter` for Kiro CLI's global `~/.kiro/skills` directory, using the established `SKILL.md` scan and fingerprint path. Register the `kiro` ID in scanning, master-library linking, settings, and identity rendering with the existing `kiro.webp` asset.

**Tech Stack:** Rust/Tauri backend, React/TypeScript frontend, Vitest, Cargo tests.

## Global Constraints

- Use agent ID `kiro` and display name `Kiro CLI`.
- Scan only `~/.kiro/skills`; exclude project-level `.kiro/skills`.
- Preserve behavior for all existing agents.
- Reuse `src/assets/icons/agents/kiro.webp`.

---

### Task 1: Add backend adapter and master-library target

**Files:**
- Create: `src-tauri/src/modules/adapter/kiro.rs`
- Modify: `src-tauri/src/modules/adapter/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/modules/master_repo.rs`

- [ ] Write and run failing detection tests for present/missing `~/.kiro/skills`.
- [ ] Implement and register `KiroAdapter` plus the `kiro` master-library target.
- [ ] Run the complete Rust test suite.

### Task 2: Add visual identity and frontend controls

**Files:**
- Modify: `src/components/AgentVisual.tsx`
- Modify: `src/components/AgentVisual.test.tsx`
- Modify: `src/routes/Settings.tsx`
- Modify: `src/routes/SkillLibrary.tsx`

- [ ] Write and run a failing test requiring the `kiro.webp` identity image.
- [ ] Add the icon, path setting, and skill-library entry.
- [ ] Run full frontend tests and production build.
