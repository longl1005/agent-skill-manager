# 系统托盘功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 macOS 菜单栏和 Windows 系统托盘增加窗口隐藏、即时刷新、打开主技能仓库与显式退出能力。

**Architecture:** Rust 新增独立的 `tray` 模块，负责 Tauri 原生托盘、菜单、窗口关闭拦截与事件发送。React 新增一个位于 `HashRouter` 内的事件桥接组件，监听 Rust 事件并复用现有的 `scanStore.scan()`、`masterRepoStore.fetchMasterSkills()` 与 React Router 导航。

**Tech Stack:** Tauri 2 / Rust、React 18、TypeScript、Zustand、React Router、Vitest。

## Global Constraints

- 必须启用 Tauri 2 的 `tray-icon` feature；不引入额外托盘库。
- 关闭主窗口必须隐藏到托盘，只有菜单“退出应用”才真正退出。
- 托盘菜单固定包含：显示 / 隐藏主窗口、立即刷新、打开主技能仓库、退出应用。
- Windows 使用现有彩色应用图标；macOS 使用单色模板托盘图标。
- “立即刷新”必须同时执行 Agent 扫描和主技能仓库刷新。
- 事件名固定为 `tray:refresh` 与 `tray:open-library`；主技能仓库路由固定为 `/library`。
- 不增加定时同步、Linux 托盘适配或系统通知。

---

## 文件结构

- 新建 `src-tauri/src/tray.rs`：托盘菜单、鼠标事件、关闭窗口拦截、菜单文案更新和纯事件路由函数。
- 修改 `src-tauri/Cargo.toml`：启用 `tray-icon`。
- 修改 `src-tauri/src/lib.rs`：注册 `tray` 模块、应用启动初始化、语言命令。
- 修改 `src-tauri/src/commands.rs`：新增 `set_tray_language` Tauri 命令，转发给托盘模块。
- 新建 `src-tauri/icons/tray-template.png`：macOS 单色模板托盘图标。
- 新建 `src/hooks/useTrayEvents.ts`：将 `tray:*` 事件桥接到现有 Zustand Store 与路由。
- 修改 `src/App.tsx`：在 `HashRouter` 内挂载托盘事件桥接组件，并在语言变更时同步托盘菜单文案。
- 修改 `src/ipc/commands.ts`：添加 `setTrayLanguage(language)` 类型化 IPC 封装。
- 新建 `src/hooks/useTrayEvents.test.tsx`：验证刷新与页面跳转事件。
- 修改 `src/App.test.tsx`：验证语言切换会同步原生托盘菜单文案。

## Task 1: 建立 Rust 托盘基础与关闭隐藏行为

**Files:**
- Create: `src-tauri/src/tray.rs`
- Modify: `src-tauri/Cargo.toml:22`
- Modify: `src-tauri/src/lib.rs:1-31`
- Test: `src-tauri/src/tray.rs` 内的 `#[cfg(test)]` 模块

**Interfaces:**
- Produces: `pub fn setup(app: &tauri::App) -> tauri::Result<()>`
- Produces: `pub enum TrayAction { ToggleWindow, Refresh, OpenLibrary, Quit }`
- Produces: `pub fn action_for_menu_id(id: &str) -> Option<TrayAction>`
- Consumes: `tauri::tray::TrayIconBuilder`、`tauri::menu::{Menu, MenuItem, PredefinedMenuItem}`、`tauri::Manager`、`tauri::Emitter`。

- [ ] **Step 1: 写入菜单事件路由的失败测试**

在 `src-tauri/src/tray.rs` 创建纯函数及测试骨架：

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayAction {
    ToggleWindow,
    Refresh,
    OpenLibrary,
    Quit,
}

#[cfg(test)]
mod tests {
    use super::{action_for_menu_id, TrayAction};

    #[test]
    fn maps_each_supported_menu_id_to_a_tray_action() {
        assert_eq!(action_for_menu_id("tray-toggle-window"), Some(TrayAction::ToggleWindow));
        assert_eq!(action_for_menu_id("tray-refresh"), Some(TrayAction::Refresh));
        assert_eq!(action_for_menu_id("tray-open-library"), Some(TrayAction::OpenLibrary));
        assert_eq!(action_for_menu_id("tray-quit"), Some(TrayAction::Quit));
        assert_eq!(action_for_menu_id("unknown"), None);
    }
}
```

- [ ] **Step 2: 运行失败测试，确认测试先失败**

Run: `cargo test tray::tests::maps_each_supported_menu_id_to_a_tray_action`

Expected: FAIL，提示 `action_for_menu_id` 尚未定义。

- [ ] **Step 3: 实现托盘模块与菜单事件**

在 `src-tauri/Cargo.toml` 改为：

```toml
tauri = { version = "2", features = ["tray-icon"] }
```

在 `tray.rs` 中实现：

```rust
pub fn action_for_menu_id(id: &str) -> Option<TrayAction> {
    match id {
        "tray-toggle-window" => Some(TrayAction::ToggleWindow),
        "tray-refresh" => Some(TrayAction::Refresh),
        "tray-open-library" => Some(TrayAction::OpenLibrary),
        "tray-quit" => Some(TrayAction::Quit),
        _ => None,
    }
}
```

`setup` 必须：

```rust
let toggle = MenuItem::with_id(app, "tray-toggle-window", "显示 / 隐藏主窗口", true, None::<&str>)?;
let refresh = MenuItem::with_id(app, "tray-refresh", "立即刷新", true, None::<&str>)?;
let open_library = MenuItem::with_id(app, "tray-open-library", "打开主技能仓库", true, None::<&str>)?;
let separator = PredefinedMenuItem::separator(app)?;
let quit = MenuItem::with_id(app, "tray-quit", "退出应用", true, None::<&str>)?;
```

- 为 macOS 使用 `tray-template.png`，并在 macOS 上调用 `set_icon_as_template(true)`；Windows 使用 `app.default_window_icon()`。
- 使用 `TrayIconBuilder::with_id("main-tray")` 创建菜单，调用 `show_menu_on_left_click(false)`。
- 左键释放事件执行“显示 / 隐藏主窗口”；右键保留原生菜单。
- 菜单“立即刷新”调用 `app.emit("tray:refresh", ())`。
- 菜单“打开主技能仓库”先显示并聚焦主窗口，再调用 `app.emit("tray:open-library", ())`。
- 菜单“退出应用”调用 `app.exit(0)`。
- 为主窗口注册 `on_window_event`：收到 `WindowEvent::CloseRequested` 时调用 `api.prevent_close()` 和 `window.hide()`。

在 `lib.rs` 中注册模块并在 `.setup(|app| { ... })` 内调用：

```rust
mod tray;

.setup(|app| {
    tray::setup(app)?;
    Ok(())
})
```

- [ ] **Step 4: 运行 Rust 单元测试**

Run: `cargo test tray::tests::maps_each_supported_menu_id_to_a_tray_action`

Expected: PASS。

- [ ] **Step 5: 运行完整 Rust 测试**

Run: `cargo test`

Expected: PASS，且所有既有 adapter、inventory、master repository 测试仍通过。

- [ ] **Step 6: 提交**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/tray.rs src-tauri/icons/tray-template.png
git commit -m "feat: add native system tray controls"
```

## Task 2: 添加托盘菜单语言同步命令

**Files:**
- Modify: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/commands.rs:337-410`
- Modify: `src-tauri/src/lib.rs:10-29`
- Modify: `src/ipc/commands.ts`
- Test: `src-tauri/src/tray.rs` 内的 `#[cfg(test)]` 模块

**Interfaces:**
- Produces: `pub fn update_menu_language(app: &tauri::AppHandle, language: &str) -> Result<(), String>`
- Produces: `pub fn tray_labels(language: &str) -> TrayLabels`
- Produces: `export async function setTrayLanguage(language: "zh" | "en"): Promise<void>`
- Consumes: Task 1 通过 `app.manage(...)` 持有的菜单项句柄。

- [ ] **Step 1: 写入失败测试**

为纯文案函数加入：

```rust
#[test]
fn returns_chinese_and_english_menu_labels() {
    let zh = tray_labels("zh");
    assert_eq!(zh.toggle_window, "显示 / 隐藏主窗口");
    assert_eq!(zh.refresh, "立即刷新");

    let en = tray_labels("en");
    assert_eq!(en.open_library, "Open Master Skill Library");
    assert_eq!(en.quit, "Quit Agent Skill Manager");
}
```

- [ ] **Step 2: 运行失败测试**

Run: `cargo test tray::tests::returns_chinese_and_english_menu_labels`

Expected: FAIL，提示 `tray_labels` 尚未定义。

- [ ] **Step 3: 实现文案状态与 Tauri 命令**

在 `tray.rs` 定义：

```rust
pub struct TrayLabels {
    pub toggle_window: &'static str,
    pub refresh: &'static str,
    pub open_library: &'static str,
    pub quit: &'static str,
}
```

同时保存四个 `MenuItem` 句柄至 `TrayMenuItems` App State。`update_menu_language` 只接受 `"zh"` 或 `"en"`；其他值返回 `Err("Unsupported tray language")`。对每个句柄调用 `set_text`，不销毁或重新创建托盘图标。

在 `commands.rs` 添加：

```rust
#[tauri::command]
pub fn set_tray_language(app: tauri::AppHandle, language: String) -> Result<(), String> {
    crate::tray::update_menu_language(&app, &language)
}
```

将 `commands::set_tray_language` 加入 `generate_handler!`。在 `src/ipc/commands.ts` 添加：

```ts
export async function setTrayLanguage(language: "zh" | "en"): Promise<void> {
  return invoke<void>("set_tray_language", { language });
}
```

- [ ] **Step 4: 运行 Rust 测试**

Run: `cargo test tray::tests`

Expected: PASS。

- [ ] **Step 5: 运行 TypeScript 类型检查**

Run: `pnpm build`

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src-tauri/src/tray.rs src-tauri/src/commands.rs src-tauri/src/lib.rs src/ipc/commands.ts
git commit -m "feat: localize system tray menu"
```

## Task 3: 建立前端托盘事件桥接

**Files:**
- Create: `src/hooks/useTrayEvents.ts`
- Create: `src/hooks/useTrayEvents.test.tsx`
- Modify: `src/App.tsx:1-78`

**Interfaces:**
- Produces: `export function TrayEventBridge(): null`
- Consumes: `listen` from `@tauri-apps/api/event`、`useNavigate`、`useScanStore`、`useMasterRepoStore`、Task 2 的 `setTrayLanguage`。
- Emits/handles: `tray:refresh` and `tray:open-library`.

- [ ] **Step 1: 写入事件桥接失败测试**

在 `useTrayEvents.test.tsx` mock `listen`，捕获两个 handler；mock Store 函数后验证：

```tsx
refreshHandler?.({});
await waitFor(() => {
  expect(scan).toHaveBeenCalledOnce();
  expect(fetchMasterSkills).toHaveBeenCalledOnce();
});

openLibraryHandler?.({});
expect(navigate).toHaveBeenCalledWith("/library");
```

另写一个用例，将语言 Store 设为 `"en"`，并验证 `setTrayLanguage("en")` 在桥接组件挂载时调用。

- [ ] **Step 2: 运行失败测试**

Run: `pnpm test -- --run src/hooks/useTrayEvents.test.tsx`

Expected: FAIL，提示模块或事件桥接组件不存在。

- [ ] **Step 3: 实现事件桥接组件**

创建 `TrayEventBridge`，位于 `HashRouter` 内部，因此可安全使用 `useNavigate()`：

```tsx
useEffect(() => {
  const cleanups = Promise.all([
    listen("tray:refresh", () => {
      void Promise.all([scan(), fetchMasterSkills()]);
    }),
    listen("tray:open-library", () => navigate("/library")),
  ]);

  return () => {
    void cleanups.then((unlisten) => unlisten.forEach((stop) => stop()));
  };
}, [fetchMasterSkills, navigate, scan]);
```

使用独立 effect 同步语言：

```tsx
useEffect(() => {
  void setTrayLanguage(lang).catch(() => undefined);
}, [lang]);
```

在 `App.tsx` 中新增一个内部 `AppRoutes` 组件，将现有 `<Routes>` 与 `<TrayEventBridge />` 放在同一个 `<HashRouter>` 内。保留既有标题栏拖动、侧边栏和首次扫描逻辑。

- [ ] **Step 4: 运行前端事件桥接测试**

Run: `pnpm test -- --run src/hooks/useTrayEvents.test.tsx`

Expected: PASS。

- [ ] **Step 5: 运行完整前端测试与构建**

Run: `pnpm test -- --run && pnpm build`

Expected: PASS，既有 85 项以上测试均通过，TypeScript 无错误。

- [ ] **Step 6: 提交**

```bash
git add src/hooks/useTrayEvents.ts src/hooks/useTrayEvents.test.tsx src/App.tsx src/App.test.tsx
git commit -m "feat: bridge tray events to app actions"
```

## Task 4: 构建并进行跨平台手工验收

**Files:**
- Modify: 无
- Verify: `src-tauri/target/release/bundle/macos/Agent Skill Manager.app`
- Verify: Windows CI 或 Windows 本机产生的安装包

**Interfaces:**
- Consumes: Task 1–3 完成后的托盘、窗口事件和前端桥接。

- [ ] **Step 1: 构建 macOS 应用包**

Run: `pnpm tauri build --bundles app`

Expected: PASS，并生成 `src-tauri/target/release/bundle/macos/Agent Skill Manager.app`。

- [ ] **Step 2: 验证 macOS 菜单栏交互**

1. 启动 `.app`，确认单色托盘图标出现在菜单栏。
2. 点击窗口红色关闭按钮，确认窗口消失但托盘图标仍在。
3. 左键托盘图标，确认窗口恢复并获得焦点；再点一次确认窗口隐藏。
4. 右键托盘图标，确认四个菜单项均存在。
5. 选择“立即刷新”，确认 Agent 和主技能仓库数据刷新。
6. 选择“打开主技能仓库”，确认窗口显示并跳转到 `/library`。
7. 选择“退出应用”，确认应用与托盘图标均退出。

- [ ] **Step 3: 验证 Windows 系统托盘交互**

1. 在 Windows 构建安装包并安装。
2. 确认彩色应用图标显示于通知区域（若被折叠，确认在溢出菜单中）。
3. 重复 macOS 步骤 2–7，验证关闭隐藏、菜单、刷新、路由及退出。

- [ ] **Step 4: 最终提交**

```bash
git status --short
git add src-tauri/Cargo.lock
git commit -m "build: update lockfile for tray support"
```

仅当启用 `tray-icon` 导致 `Cargo.lock` 发生变化时执行此提交；若 `Cargo.lock` 未变化，则跳过本步骤。

## 自检

- Spec 的关闭隐藏、四个菜单项、双平台图标、语言同步、刷新事件、打开主技能仓库、错误处理和非目标，分别由 Task 1–4 覆盖。
- 全文没有占位内容或未定义的后续动作。
- 接口名称一致：`TrayAction`、`action_for_menu_id`、`update_menu_language`、`setTrayLanguage`、`TrayEventBridge`、`tray:refresh`、`tray:open-library`。
