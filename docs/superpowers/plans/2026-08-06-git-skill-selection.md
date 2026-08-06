# Git 多 Skill 选择 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse Git repositories into real Skill candidates, let the user choose when there are multiple, and never create a placeholder Skill when parsing fails.

**Architecture:** Rust owns cloning, recursive `SKILL.md` discovery, metadata parsing, safe subdirectory validation, and copying the selected directory. The React route requests candidates before opening the existing Agent distribution modal; it inserts a candidate-picker modal only when more than one candidate is found.

**Tech Stack:** Tauri 2 commands, Rust filesystem APIs, React 18, Zustand, Vitest, Cargo tests.

## Global Constraints

- Search cloned repositories recursively while excluding `.git`.
- A candidate must be a directory containing `SKILL.md` or `skill.md`.
- Reject absolute paths, parent traversal, and selected directories outside the cloned repository.
- A clone failure or zero candidates must return an error and leave the master library unchanged.
- Keep local-directory and ZIP installation behavior unchanged.

---

### Task 1: Add safe Git Skill discovery and selected-directory installation

**Files:**
- Modify: `src-tauri/src/modules/master_repo.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `GitSkillCandidate { name, description, relative_path }` serialized by Tauri.
- Produces: `inspect_git_skills(source: String) -> Result<Vec<GitSkillCandidate>, String>`.
- Extends: `install_skill_to_master(skill_name, source, source_subdir, custom_paths)` so `source_subdir` identifies the chosen Skill directory.

- [ ] **Step 1: Write failing Rust tests for nested discovery and unsafe selections**

Add tests in `master_repo.rs` that create a temporary repository tree without using the network:

```rust
#[test]
fn git_skill_discovery_finds_nested_skill_metadata() {
    let repo = temp_dir();
    let skill = repo.join("skills/dashi-ppt");
    fs::create_dir_all(&skill).unwrap();
    fs::write(skill.join("SKILL.md"), "---\nname: dashi-ppt\ndescription: Slides\n---\n# Dashi").unwrap();

    let candidates = discover_skill_candidates(&repo).unwrap();

    assert_eq!(candidates.len(), 1);
    assert_eq!(candidates[0].name, "dashi-ppt");
    assert_eq!(candidates[0].description, "Slides");
    assert_eq!(candidates[0].relative_path, "skills/dashi-ppt");
}

#[test]
fn selected_skill_path_rejects_parent_traversal() {
    let repo = temp_dir();
    assert!(selected_skill_dir(&repo, "../outside").is_err());
}
```

- [ ] **Step 2: Run the Rust tests to verify failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml git_skill_discovery_finds_nested_skill_metadata && cargo test --manifest-path src-tauri/Cargo.toml selected_skill_path_rejects_parent_traversal`

Expected: FAIL because discovery types and safe-path helpers do not exist.

- [ ] **Step 3: Implement candidate discovery and safe selected-directory copying**

In `master_repo.rs`, add a serializable `GitSkillCandidate`, `discover_skill_candidates(root)`, and `selected_skill_dir(root, relative_path)`. `discover_skill_candidates` must recursively visit directories except `.git`, find either casing of `SKILL.md`, read frontmatter `name` and `description`, and return deterministic path-sorted candidates. `selected_skill_dir` must reject non-relative and traversal paths, canonicalize the candidate, verify it remains inside the canonical repository root, and require a Skill entry file.

Change `install_skill_to_master` to accept `source_subdir: Option<&str>`. For a Git source, clone as today; require a selected subdirectory when provided, otherwise require exactly one discovered candidate. Copy that candidate directory. Return an `InvalidData` error for zero candidates and an `InvalidInput` error for ambiguous candidates. Remove the fallback block that creates `Skill '<name>'` after a Git installation failure. Keep the existing fallback only when `source` is `None`.

Expose a new `inspect_git_skills` command that clones to a temporary directory, returns `discover_skill_candidates`, and always removes the temporary directory. Update `commands.rs` and the `generate_handler!` list in `lib.rs`.

- [ ] **Step 4: Run focused Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml master_repo::tests`

Expected: PASS, including nested discovery and traversal rejection.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/modules/master_repo.rs src-tauri/src/commands.rs src-tauri/src/lib.rs
git commit -m "feat: discover Skills in Git repositories"
```

### Task 2: Type and expose the discovery command to React

**Files:**
- Modify: `src/ipc/commands.ts`
- Modify: `src/stores/masterRepoStore.ts`

**Interfaces:**
- Consumes: Tauri command `inspect_git_skills` and extended `install_skill_to_master` argument `sourceSubdir`.
- Produces: `GitSkillCandidate` and `inspectGitSkills(source)` for the install route.
- Extends: `installSkillToMaster(skillName, source, sourceSubdir?)` through the store.

- [ ] **Step 1: Write the failing wrapper test**

Create `src/ipc/commands.test.ts` with a mocked `invoke` and assert the typed boundary:

```ts
it("requests Git Skill candidates from Tauri", async () => {
  vi.mocked(invoke).mockResolvedValueOnce([{ name: "dashi-ppt", description: "Slides", relative_path: "skills/dashi-ppt" }]);
  await expect(inspectGitSkills("https://github.com/chuspeeism/dashi-ppt-skill")).resolves.toEqual([
    { name: "dashi-ppt", description: "Slides", relative_path: "skills/dashi-ppt" },
  ]);
  expect(invoke).toHaveBeenCalledWith("inspect_git_skills", { source: "https://github.com/chuspeeism/dashi-ppt-skill" });
});
```

- [ ] **Step 2: Run the wrapper test to verify failure**

Run: `npm test -- src/ipc/commands.test.ts`

Expected: FAIL because `inspectGitSkills` and `GitSkillCandidate` do not exist.

- [ ] **Step 3: Add the typed command wrappers**

Add:

```ts
export type GitSkillCandidate = { name: string; description: string; relative_path: string };
export function inspectGitSkills(source: string): Promise<GitSkillCandidate[]> {
  return invoke<GitSkillCandidate[]>("inspect_git_skills", { source });
}
```

Add the nullable `sourceSubdir` argument to the existing `installSkillToMaster` wrapper and pass it to the Tauri invocation. Thread the optional argument through `MasterRepoState.installSkillToMaster` without changing its existing callers.

- [ ] **Step 4: Run the wrapper test**

Run: `npm test -- src/ipc/commands.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ipc/commands.ts src/ipc/commands.test.ts src/stores/masterRepoStore.ts
git commit -m "feat: expose Git Skill discovery"
```

### Task 3: Select a Git Skill before distribution

**Files:**
- Modify: `src/routes/InstallSkills.tsx`
- Modify: `src/routes/InstallSkills.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `inspectGitSkills(source)` and candidate `{ name, description, relative_path }`.
- Produces: an optional selected `sourceSubdir` passed to `installSkillToMaster` after Agent selection.

- [ ] **Step 1: Write failing route tests for discovery and selection**

Mock `inspectGitSkills` in `InstallSkills.test.tsx` and add:

```tsx
it("offers nested Git Skills for selection before opening Agent distribution", async () => {
  vi.mocked(inspectGitSkills).mockResolvedValueOnce([
    { name: "dashi-ppt", description: "Slides", relative_path: "skills/dashi-ppt" },
    { name: "dashi-notes", description: "Notes", relative_path: "skills/dashi-notes" },
  ]);
  render(<MemoryRouter><InstallSkills /></MemoryRouter>);
  fireEvent.click(screen.getByRole("tab", { name: /Git \/ GitHub|Git \/ URL/i }));
  fireEvent.change(screen.getByLabelText("Git or GitHub repository URL"), { target: { value: "https://github.com/chuspeeism/dashi-ppt-skill" } });
  fireEvent.click(screen.getByRole("button", { name: /解析并安装|Fetch & Install/i }));

  expect(await screen.findByRole("dialog", { name: /选择.*Skill|Choose.*Skill/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /dashi-ppt/i }));
  expect(screen.getByTestId("target-agent-modal")).toBeInTheDocument();
});
```

Add a single-candidate assertion that the Agent distribution modal opens directly and a rejection assertion that the URL form renders the error message instead of either modal.

- [ ] **Step 2: Run route tests to verify failure**

Run: `npm test -- src/routes/InstallSkills.test.tsx`

Expected: FAIL because URL submission currently opens Agent distribution without parsing candidates.

- [ ] **Step 3: Implement parsing state, picker modal, and selected-subdirectory installation**

Replace `handleUrlSubmit` with an async handler that normalizes the source via `parseSkillsShInput`, sets an `isResolvingUrl` state, calls `inspectGitSkills`, and handles each candidate count. Store `{ source, candidate }` as the pending selection. One candidate calls `handleOpenInstallModal(candidate.name, source, candidate.relative_path)`. Multiple candidates opens a new accessible modal labelled with a localized “选择要安装的 Skill” heading; each option is a button showing name, description, and `relative_path`. A selected option then opens the existing Agent modal.

Extend the existing target modal state with `targetSkillSubdir` and pass it as the third argument to `installSkillToMaster`. Render resolver errors near the URL form and disable the submit button while parsing. Add compact picker styles using existing modal tokens and responsive one-column candidate buttons.

- [ ] **Step 4: Verify route behavior and production build**

Run: `npm test -- src/routes/InstallSkills.test.tsx && npm run build`

Expected: PASS. A Dashi-like nested single Skill skips the picker and retains the selected `skills/dashi-ppt` subdirectory; a multi-Skill repository opens the picker.

- [ ] **Step 5: Commit**

```bash
git add src/routes/InstallSkills.tsx src/routes/InstallSkills.test.tsx src/styles/global.css
git commit -m "feat: select Skills from Git repositories"
```

### Task 4: Full verification

**Files:**
- Verify only; no source changes.

**Interfaces:**
- Verifies the Rust command boundary, React selection flow, and existing installation behavior together.

- [ ] **Step 1: Run the full test suite and Rust checks**

Run: `npm test && npm run build && cargo test --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 2: Manually verify the reported repository**

In the running application, submit `https://github.com/chuspeeism/dashi-ppt-skill`, choose `dashi-ppt` if prompted, distribute it to one Agent, and open its `SKILL.md`. Confirm it contains the Dashi title and its real instructions rather than `Skill 'dashi-ppt-skill'`.
