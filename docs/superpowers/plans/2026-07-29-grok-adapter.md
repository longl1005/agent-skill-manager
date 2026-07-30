# Grok Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Grok as a separately managed skills agent.

**Architecture:** Add a Rust `GrokAdapter` that detects and scans Grok's user-level `~/.grok/skills` directory using the existing `SKILL.md` scanning contract. Register the `grok` agent ID in the scan command, master-library linking, settings, and visual identity layers, reusing the existing `grok.webp` asset.

**Tech Stack:** Rust/Tauri backend, React/TypeScript frontend, Vitest, Cargo tests.

## Global Constraints

- Use agent ID `grok` and display name `Grok`.
- Support only user-level `~/.grok/skills`; do not scan project-level `.grok/skills`.
- Preserve all existing agent behavior.
- Reuse `src/assets/icons/agents/grok.webp`.

---

### Task 1: Add Grok backend discovery, scanning, and master-library linking

**Files:**
- Create: `src-tauri/src/modules/adapter/grok.rs`
- Modify: `src-tauri/src/modules/adapter/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/modules/master_repo.rs`

- [ ] **Step 1: Write failing detection tests for a present and missing `~/.grok/skills` root.**
- [ ] **Step 2: Run `cargo test grok --manifest-path src-tauri/Cargo.toml` and observe the missing adapter failure.**
- [ ] **Step 3: Implement `GrokAdapter`, register it for scans, and add `grok` as a master-library target.**
- [ ] **Step 4: Run `cargo test --manifest-path src-tauri/Cargo.toml`.**

### Task 2: Add Grok settings, skill-library control, and visual identity

**Files:**
- Modify: `src/components/AgentVisual.tsx`
- Modify: `src/components/AgentVisual.test.tsx`
- Modify: `src/routes/Settings.tsx`
- Modify: `src/routes/SkillLibrary.tsx`

- [ ] **Step 1: Write a failing test that `AgentIdentityMark` renders the Grok icon for `grok`.**
- [ ] **Step 2: Run `pnpm test src/components/AgentVisual.test.tsx` and observe the generic-mark failure.**
- [ ] **Step 3: Map `grok` to `grok.webp`, then add it to Settings and the skill library.**
- [ ] **Step 4: Run `pnpm test`, `pnpm build`, and `cargo test --manifest-path src-tauri/Cargo.toml`.**
- [ ] **Step 5: Commit the verified implementation.**
