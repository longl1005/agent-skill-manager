# Oh My Pi (OPM) Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect and manage Oh My Pi (OPM) skills alongside the existing agents.

**Architecture:** Add a dedicated Rust `OhMyPiAdapter` that scans OMP's native user skills at `~/.omp/agent/skills` using the same `SKILL.md` contract as the existing adapters. Register its stable ID (`oh-my-pi`) across scanning, master-library linking, settings, and UI identity rendering, using the existing `oh-my-pi.webp` asset.

**Tech Stack:** Rust/Tauri backend, React/TypeScript frontend, Vitest, Cargo tests.

## Global Constraints

- Use agent ID `oh-my-pi` and display name `Oh My Pi (OPM)`.
- Default user skill root is `~/.omp/agent/skills`; custom paths take precedence.
- Preserve current Cline, Pi Agent, and other agent behavior.
- Reuse `src/assets/icons/agents/oh-my-pi.webp`; do not add a duplicate asset.

---

### Task 1: Add the backend OMP adapter and master-library target

**Files:**
- Create: `src-tauri/src/modules/adapter/oh_my_pi.rs`
- Modify: `src-tauri/src/modules/adapter/mod.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/modules/master_repo.rs`

**Interfaces:**
- Consumes: `AgentAdapter`, `enumerate_skill_dirs`, `parse_frontmatter`, and `compute_fingerprint` from the existing adapter layer.
- Produces: `OhMyPiAdapter`, whose `id()` returns `AgentId("oh-my-pi")`, and an `oh-my-pi` key in master-library reports.

- [ ] **Step 1: Write failing adapter detection tests**

```rust
#[test]
fn oh_my_pi_detect_only_user_root() {
    let home = temp_home();
    std::fs::create_dir_all(home.join(".omp/agent/skills")).unwrap();
    let result = OhMyPiAdapter.detect(&ctx_for(&home));
    assert_eq!(result.status, DetectionStatus::Detected);
    assert_eq!(result.roots[0].display_path, home.join(".omp/agent/skills"));
}

#[test]
fn oh_my_pi_detect_neither_root() {
    let home = temp_home();
    let result = OhMyPiAdapter.detect(&ctx_for(&home));
    assert_eq!(result.status, DetectionStatus::Unavailable);
}
```

- [ ] **Step 2: Run the adapter tests and verify failure**

Run: `cargo test oh_my_pi --manifest-path src-tauri/Cargo.toml`

Expected: FAIL because `OhMyPiAdapter` is not yet defined.

- [ ] **Step 3: Implement and register the adapter**

```rust
pub struct OhMyPiAdapter;

impl AgentAdapter for OhMyPiAdapter {
    fn id(&self) -> AgentId { AgentId("oh-my-pi".to_string()) }
    // Descriptor: "Oh My Pi (OPM)"; native root: ~/.omp/agent/skills.
}
```

Copy the established `SKILL.md` scan/fingerprint behavior from `ClineAdapter`, changing only identity, documentation URL, notes, and root candidates. Export the adapter, include it in `scan_agents`, and include `oh-my-pi` in `get_agent_skills_dir`, `known_agents`, and `ALL_AGENT_IDS`.

- [ ] **Step 4: Run the backend tests and verify success**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all adapter and master-repository tests pass.

### Task 2: Expose OMP in frontend configuration and visual identity

**Files:**
- Modify: `src/components/AgentVisual.tsx`
- Modify: `src/components/AgentVisual.test.tsx`
- Modify: `src/routes/Settings.tsx`
- Modify: `src/routes/SkillLibrary.tsx`
- Modify: `src/routes/SkillLibrary.test.tsx`

**Interfaces:**
- Consumes: backend agent ID `oh-my-pi` and existing `oh-my-pi.webp` image.
- Produces: an OMP icon for `AgentIdentityMark`, configurable OMP path, and an OMP master-library toggle.

- [ ] **Step 1: Write a failing identity-mark test**

```tsx
it("renders official Oh My Pi identity mark when agentId is oh-my-pi", () => {
  render(<AgentIdentityMark agentId="oh-my-pi" />);
  expect(screen.getByLabelText("oh-my-pi identity mark")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the visual test and verify failure**

Run: `pnpm test src/components/AgentVisual.test.tsx`

Expected: FAIL because `oh-my-pi` currently matches the generic Pi Agent branch.

- [ ] **Step 3: Add OMP UI registrations**

```tsx
import ohMyPiWebp from "../assets/icons/agents/oh-my-pi.webp";

if (agentId.toLowerCase().includes("oh-my-pi")) {
  return <OhMyPiMark size={size} />;
}
```

Place this branch before the generic `pi` match. Add `{ id: "oh-my-pi", name: "Oh My Pi (OPM)" }` to library support and `{ id: "oh-my-pi", name: "Oh My Pi (OPM)", defaultPath: "~/.omp/agent/skills" }` to Settings.

- [ ] **Step 4: Run frontend tests and build verification**

Run: `pnpm test && pnpm build`

Expected: all Vitest suites pass and TypeScript/Vite build exits 0.

- [ ] **Step 5: Commit implementation**

```bash
git add src-tauri/src/modules/adapter/oh_my_pi.rs src-tauri/src/modules/adapter/mod.rs src-tauri/src/commands.rs src-tauri/src/modules/master_repo.rs src/components/AgentVisual.tsx src/components/AgentVisual.test.tsx src/routes/Settings.tsx src/routes/SkillLibrary.tsx src/routes/SkillLibrary.test.tsx docs/superpowers/plans/2026-07-29-oh-my-pi-adapter.md
git commit -m "feat: add Oh My Pi agent adapter"
```
