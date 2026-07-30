# Agent 本地副本替换为软链接 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 识别 Agent 目录中与主库同名的真实技能副本，并在用户确认后安全地替换为指向主库的软链接。

**Architecture:** 扫描报告携带每个 Agent 技能条目的软链接状态与链接目标，前端据此与主库匹配后渲染四个互斥状态。新增专用的替换命令；它在受限目标上重新校验后删除本地条目并创建软链接。主库扫描只读取状态，不再自行改写 Agent 文件系统。

**Tech Stack:** Rust/Tauri 2、React 18、TypeScript、Zustand、Vitest。

## Global Constraints

- 扫描必须只读；绝不因为内容相同而自动替换本地副本。
- 只允许替换已扫描到的 Agent 技能根目录的直接子项，拒绝空名称、`.`、`..`、路径分隔符。
- 替换前必须经前端二次确认；按用户决定直接删除本地副本，不创建备份。
- 替换命令在删除前重新校验：主库技能存在，且 Agent 目标为非软链接的真实文件或目录；任意软链接都拒绝删除。
- 失败时不得删除任何路径；成功后更新 SQLite 链接状态和活动记录，并刷新前端扫描与主库列表。

---

### Task 1: 扫描结果暴露软链接状态，移除静默替换

**Files:**
- Modify: `src-tauri/src/commands.rs:100-109,229-254`
- Modify: `src/ipc/types.ts:32-45`
- Modify: `src-tauri/src/modules/master_repo.rs:176-276`
- Test: `src-tauri/src/modules/master_repo.rs:existing test module`

**Interfaces:**
- Produces: `SkillReport { is_symlink: bool, symlink_target: Option<String> }` through Tauri.
- Produces: `scan_master_repo` that never calls `remove_skill_symlink` or `create_skill_symlink` while enumerating skills.

- [ ] **Step 1: Write failing Rust tests for read-only scanning**

```rust
#[test]
fn scan_master_repo_does_not_replace_matching_agent_directory() {
    // Arrange a master skill and a same-content real directory in Claude's skill root.
    let reports = scan_master_repo(Some(&custom_paths));
    assert!(reports.iter().any(|skill| skill.name == "skill-a"));
    assert!(agent_root.join("skill-a").is_dir());
    assert!(!fs::symlink_metadata(agent_root.join("skill-a")).unwrap().file_type().is_symlink());
}
```

- [ ] **Step 2: Run the Rust test to verify it fails**

Run: `cargo test scan_master_repo_does_not_replace_matching_agent_directory`

Expected: FAIL because the current scan mutates the Agent directory.

- [ ] **Step 3: Add `is_symlink` to scan reports and remove scan-time writes**

```rust
pub struct SkillReport {
    // existing fields
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
}

let is_symlink = std::fs::symlink_metadata(&inst.location.display_path)
    .map(|metadata| metadata.file_type().is_symlink())
    .unwrap_or(false);
let symlink_target = if is_symlink {
    std::fs::read_link(&inst.location.display_path).ok().map(|path| path.to_string_lossy().into_owned())
} else { None };
```

Delete the fingerprint branch in `scan_master_repo` that calls `remove_skill_symlink` and `create_skill_symlink`; leave its linked state false for a non-symlink target.

- [ ] **Step 4: Update TypeScript contract and fixtures**

```ts
export interface SkillReport {
  // existing fields
  is_symlink: boolean;
  symlink_target: string | null;
}
```

Add `is_symlink: false` to Rust fixtures and `isSymlink: false` to TypeScript test fixtures according to the existing serialization convention.

- [ ] **Step 5: Run focused tests**

Run: `cargo test scan_master_repo_does_not_replace_matching_agent_directory` and `pnpm vitest run src/routes/AgentDetail.test.tsx`

Expected: PASS.

### Task 2: Add an explicit, guarded replacement command

**Files:**
- Modify: `src-tauri/src/modules/master_repo.rs:301-344`
- Modify: `src-tauri/src/commands.rs:380-391`
- Modify: `src-tauri/src/lib.rs:15-35`
- Modify: `src/ipc/commands.ts:47-65`
- Modify: `src/stores/masterRepoStore.ts:7-20,45-65`
- Test: `src-tauri/src/modules/master_repo.rs:existing test module`

**Interfaces:**
- Produces: `replace_agent_local_skill_with_symlink(agent_id, skill_name, custom_paths) -> Result<bool, std::io::Error>`.
- Produces: Tauri command `replace_agent_local_skill_with_symlink` and IPC function returning `Promise<boolean>`.
- Produces: Zustand method `replaceAgentLocalSkillWithSymlink(agentId, skillName): Promise<boolean>` that refreshes both stores after success.

- [ ] **Step 1: Write failing command-level filesystem tests**

```rust
#[test]
fn replaces_a_real_agent_skill_directory_with_a_master_symlink() {
    let result = replace_agent_local_skill_with_symlink("claude-code", "skill-a", Some(&paths));
    assert!(result.unwrap());
    assert!(is_valid_symlink_to(&agent_root.join("skill-a"), &master_root.join("skill-a")));
}

#[test]
fn replacement_rejects_path_traversal_and_preserves_files() {
    assert!(replace_agent_local_skill_with_symlink("claude-code", "../keep", Some(&paths)).is_err());
    assert!(agent_root.join("keep").exists());
}
```

Also test a missing master path and both an already-correct and an external symlink; each must fail without removing the Agent target.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cargo test replace_agent_local_skill_with_symlink`

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement the guarded replacement function**

```rust
pub fn replace_agent_local_skill_with_symlink(
    agent_id: &str,
    skill_name: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<bool> {
    if skill_name.is_empty() || skill_name == "." || skill_name == ".." || skill_name.contains(['/', '\\']) {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid skill name"));
    }
    // Resolve master and Agent roots; validate master exists and target is non-symlink.
    // Delete exactly target, create its symlink, then persist linked status/activity.
}
```

Use `symlink_metadata` to distinguish a link from an actual path. Do not delegate this operation to `toggle_skill_symlink`, whose enable path is intentionally broad.

- [ ] **Step 4: Wire the command, IPC client, and Zustand refresh**

```ts
export async function replaceAgentLocalSkillWithSymlink(
  agentId: string, skillName: string, customPaths?: Record<string, string>,
): Promise<boolean> {
  return invoke<boolean>("replace_agent_local_skill_with_symlink", { agentId, skillName, customPaths: customPaths ?? null });
}
```

The store calls this function, then `await Promise.all([get().fetchMasterSkills(), useScanStore.getState().scan()])` only after a true result.

- [ ] **Step 5: Run focused tests**

Run: `cargo test replace_agent_local_skill_with_symlink` and `pnpm vitest run src/routes/AgentDetail.test.tsx`

Expected: PASS.

### Task 3: Render source status and destructive replacement confirmation

**Files:**
- Modify: `src/routes/AgentDetail.tsx:33-102,200-253,336`
- Modify: `src/routes/AgentDetail.test.tsx`
- Modify: `src/locales/dict.ts:48-52,221-225`
- Modify: `src/styles/global.css:agent-detail card styles`

**Interfaces:**
- Consumes: `skill.is_symlink`, `skill.symlink_target`, `masterSkill`, and `replaceAgentLocalSkillWithSymlink`.
- Produces: status badge labels `已在主库 · 软链接` / `已在主库 · 本地副本` / `外部软链接` and action `替换为软链接`.

- [ ] **Step 1: Write failing UI tests for each source state and confirmation**

```tsx
it("marks a same-name real directory as a local copy and requires confirmation before replacement", () => {
  useMasterRepoStore.setState({ skills: [{ name: "frontend-design", path: "/master/frontend-design" }] });
  useScanStore.setState({ report: reportWithSkill({ isSymlink: false }) });
  renderDetail("/agents/claude-code");
  fireEvent.click(screen.getByRole("button", { name: "Replace with symlink" }));
  expect(screen.getByText(/permanently delete/i)).toBeVisible();
});
```

Add cases for a correct symlink (shows only the linked badge) and a skill absent from master (shows import action).

- [ ] **Step 2: Run the UI test to verify it fails**

Run: `pnpm vitest run src/routes/AgentDetail.test.tsx`

Expected: FAIL because the source labels, action, and confirmation do not exist.

- [ ] **Step 3: Implement card-state classification and localized copy**

```ts
const isInMaster = Boolean(masterSkill);
const isMasterSymlink = isInMaster && skill.is_symlink && skill.symlink_target === masterSkill.path;
const isLocalCopy = isInMaster && !skill.is_symlink;
const isExternalSymlink = skill.is_symlink && !isMasterSymlink;
```

Render import only when `!isInMaster && !skill.is_symlink`; render linked badge only when `isMasterSymlink`; render local-copy badge and replace button only when `isLocalCopy`; render a read-only external-link badge when `isExternalSymlink`.

- [ ] **Step 4: Implement the confirmation and refresh path**

Keep selected skill name in dedicated replacement-confirmation state. The confirmation body names the Agent and skill, says the local folder is permanently deleted, and says the master repository is unaffected. Confirm invokes the store method, disables modal buttons while pending, closes only after completion, and surfaces any store error through the page’s existing error UI.

- [ ] **Step 5: Run frontend verification**

Run: `pnpm vitest run src/routes/AgentDetail.test.tsx`

Expected: PASS with the existing tests plus state and confirmation coverage.

### Task 4: Full verification

**Files:**
- Verify only.

- [ ] **Step 1: Run Rust suite**

Run: `cargo test`

Expected: PASS.

- [ ] **Step 2: Run frontend suite and production build**

Run: `pnpm vitest run && pnpm build`

Expected: PASS; report any existing chunk-size warning separately from test/build success.

- [ ] **Step 3: Manually verify in the running desktop app**

Use a disposable Agent skill directory with a real same-name folder and confirm: scan labels it as a local copy; cancel keeps it; confirm replaces it; refresh then labels it as a master symlink.
