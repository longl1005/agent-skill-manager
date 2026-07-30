# Skill ZIP 分享与本地导入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 导出主库 skill 为安全的 ZIP，并将本地导入扩展为目录或 ZIP。

**Architecture:** Rust `zip` 库负责 ZIP 创建和受限解压；Tauri command 暴露导出、选择保存位置由 Dialog 插件完成。前端在主库卡片调用导出命令，在本地导入页允许目录或 ZIP 并复用安装、分发流程。

**Tech Stack:** Rust/Tauri 2、`zip` crate、Tauri Dialog、React、TypeScript、Vitest。

## Global Constraints

- 只支持 `.zip`，不调用操作系统的压缩命令。
- ZIP 解压拒绝绝对路径、`..` 和越出临时目录的条目。
- 导入必须验证 `SKILL.md`；失败不得影响已有主库技能。
- 临时目录在成功、错误和取消后清理。

---

### Task 1: ZIP 导出与安全导入后端

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/modules/master_repo.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs`
- Test: `src-tauri/src/modules/master_repo.rs`

**Interfaces:**
- Produces: `export_master_skill_zip(skill_name, destination, custom_paths) -> io::Result<PathBuf>`.
- Produces: `extract_skill_zip(source, temp_root) -> io::Result<PathBuf>` used by `install_skill_to_master`.
- Produces Tauri command `export_master_skill_zip(skill_name, destination, custom_paths)`.

- [ ] **Step 1: Add failing unit tests**

```rust
#[test]
fn exports_one_skill_as_a_zip_with_skill_md() {
    export_master_skill_zip("demo", &archive, Some(&paths)).unwrap();
    let mut zip = zip::ZipArchive::new(File::open(&archive).unwrap()).unwrap();
    assert!(zip.by_name("demo/SKILL.md").is_ok());
}

#[test]
fn zip_import_rejects_parent_directory_entries() {
    assert!(extract_skill_zip(&malicious_zip, &temp_root).is_err());
    assert!(!outside_path.exists());
}
```

- [ ] **Step 2: Run the focused tests**

Run: `cargo test exports_one_skill_as_a_zip_with_skill_md zip_import_rejects_parent_directory_entries`

Expected: FAIL because ZIP functions do not exist.

- [ ] **Step 3: Add ZIP dependency and implementation**

Add `zip = "2"` to Cargo dependencies. Implement archive creation by walking the selected master directory and writing each regular file under `<skill-name>/`. Implement extraction by rejecting entries whose `enclosed_name()` is absent, creating only descendants of a newly created temp root, then locating a root or one-level nested `SKILL.md`.

- [ ] **Step 4: Integrate ZIP sources into installation**

When `source` has a case-insensitive `.zip` extension, extract into a UUID temp directory, copy the validated skill directory into the master target, and remove the temp directory before returning on every result path.

- [ ] **Step 5: Run Rust verification**

Run: `cargo test`

Expected: PASS.

### Task 2: IPC and share action

**Files:**
- Modify: `src/ipc/commands.ts`
- Modify: `src/routes/SkillLibrary.tsx`
- Modify: `src/routes/SkillLibrary.test.tsx`
- Modify: `src/locales/dict.ts`

**Interfaces:**
- Produces: `exportMasterSkillZip(skillName, destination, customPaths): Promise<string>`.
- Consumes: Dialog `save({ defaultPath: `${skill.name}.zip`, filters: [{ name: "ZIP", extensions: ["zip"] }] })`.

- [ ] **Step 1: Write a failing card-action test**

```tsx
fireEvent.click(screen.getByRole("button", { name: "Share web-search-pro" }));
expect(save).toHaveBeenCalled();
expect(exportMasterSkillZip).toHaveBeenCalledWith("web-search-pro", expect.stringMatching(/web-search-pro\.zip$/), expect.anything());
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run src/routes/SkillLibrary.test.tsx`

Expected: FAIL because no share action exists.

- [ ] **Step 3: Add the share action**

Place a share button between open-folder and delete. If the save dialog returns null, return with no toast. Otherwise call the IPC export function and surface success/failure through the page’s existing error feedback.

- [ ] **Step 4: Run frontend verification**

Run: `pnpm vitest run src/routes/SkillLibrary.test.tsx`

Expected: PASS.

### Task 3: Local directory-or-ZIP import UI

**Files:**
- Modify: `src/routes/InstallSkills.tsx`
- Modify: `src/routes/InstallSkills.test.tsx`
- Modify: `src/locales/dict.ts`

**Interfaces:**
- Consumes: Dialog `open({ directory: true, multiple: false })` for directories, followed by `open({ directory: false, multiple: false, filters: [{ name: "ZIP", extensions: ["zip"] }] })` or a combined picker where platform supports both.
- Produces: `localPath` containing either an absolute directory or ZIP path passed unchanged as `source` to `installSkillToMaster`.

- [ ] **Step 1: Write failing UI tests**

```tsx
it("accepts a ZIP selected for local import", async () => {
  open.mockResolvedValueOnce("/tmp/demo.zip");
  fireEvent.click(screen.getByText("本地导入"));
  fireEvent.click(screen.getByTestId("local-import-dropzone"));
  expect(screen.getByText("demo.zip")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused test**

Run: `pnpm vitest run src/routes/InstallSkills.test.tsx`

Expected: FAIL because the picker only accepts a directory and labels the tab as “本地目录导入”.

- [ ] **Step 3: Update labels, picker, and drop validation**

Rename the tab and prompt to “本地导入”. Offer folder and ZIP choice through the dialog flow; accept only directories and names ending `.zip` in the drop zone. Derive the modal skill label from a ZIP basename without its `.zip` suffix, while preserving the original ZIP path as installation source.

- [ ] **Step 4: Run frontend verification**

Run: `pnpm vitest run src/routes/InstallSkills.test.tsx`

Expected: PASS.

### Task 4: Full verification

- [ ] **Step 1: Run frontend suite and production build**

Run: `pnpm vitest run && pnpm build`

Expected: PASS.

- [ ] **Step 2: Manually verify desktop flows**

Export a master skill to `<skill>.zip`; inspect it for `<skill>/SKILL.md`; import that ZIP through “本地导入” and distribute it to an Agent.
