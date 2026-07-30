# 单向显示主窗口 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让托盘菜单项和左键点击只显示并聚焦主窗口，不再隐藏窗口。

**Architecture:** 托盘菜单 ID 保持不变以避免不必要的原生菜单重建，但语义由 `ToggleWindow` 收敛为 `ShowWindow`。两种入口都复用既有的 `show_main_window`，关闭窗口时的隐藏逻辑不改动。

**Tech Stack:** Rust、Tauri 2、Rust 内联单元测试。

## Global Constraints

- 中文菜单文案必须为“显示主窗口”，英文菜单文案必须为 “Show Main Window”。
- 托盘菜单项和左键点击都不得调用 `hide()`。
- 关闭主窗口后隐藏到托盘的既有逻辑必须保持不变。
- Windows 的托盘图标策略不改动。

---

### Task 1: 将托盘入口改为单向显示

**Files:**
- Modify: `src-tauri/src/tray.rs:4-320`
- Test: `src-tauri/src/tray.rs:267-329`

**Interfaces:**
- Consumes: `show_main_window(app: &tauri::AppHandle) -> bool`，负责显示并聚焦主窗口。
- Produces: `TrayAction::ShowWindow`，由菜单事件与左键托盘事件共同调用 `show_main_window`。

- [ ] **Step 1: 写入失败的行为断言**

将菜单映射和文案断言改为以下目标值：

```rust
assert_eq!(
    action_for_menu_id("tray-toggle-window"),
    Some(TrayAction::ShowWindow)
);
assert_eq!(zh.show_window, "显示主窗口");
assert_eq!(en.show_window, "Show Main Window");
```

删除 `WindowAction` 与 `window_action_for_visibility` 的测试，因为单向显示不再依赖窗口可见性。

- [ ] **Step 2: 运行测试，确认当前实现不满足新契约**

Run: `cargo test tray::tests`

Expected: FAIL，因为当前枚举仍为 `TrayAction::ToggleWindow`，菜单文案仍包含“隐藏”。

- [ ] **Step 3: 实现最小单向显示行为**

在 `src-tauri/src/tray.rs` 中：

```rust
pub enum TrayAction {
    ShowWindow,
    Refresh,
    OpenLibrary,
    Quit,
}

// menu action
Some(TrayAction::ShowWindow) => {
    show_main_window(app);
}

// left click
show_main_window(tray.app_handle());
```

将 `TrayLabels::toggle_window` 重命名为 `show_window`，并把中英文文案改为全局约束要求。删除 `toggle_main_window`、`WindowAction` 和 `window_action_for_visibility`，使任何托盘入口都不存在调用 `hide()` 的路径。

- [ ] **Step 4: 运行针对性测试，确认行为通过**

Run: `cargo test tray::tests`

Expected: PASS，且无与托盘模块相关的失败。

- [ ] **Step 5: 构建 macOS 应用并手工验证**

Run: `pnpm tauri build --bundles app`

Expected: 成功产出 `src-tauri/target/release/bundle/macos/Agent Skill Manager.app`。手工验证：关闭窗口后它隐藏到托盘；点击“显示主窗口”或左键托盘图标均重新显示窗口；窗口可见时再次点击不会隐藏它。

- [ ] **Step 6: 提交实现（仅在工作树中不混入无关文件时）**

```bash
git add src-tauri/src/tray.rs
git commit -m "fix: make tray window action show only"
```
