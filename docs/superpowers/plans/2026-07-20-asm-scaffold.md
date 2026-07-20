# ASM Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 ASM 桌面工程搭成一个可运行的最小骨架——`pnpm tauri:dev` 启动桌面窗口，侧边栏 6 个导航项可点击切换，Dashboard 启动时通过 IPC 调 `ping` 拿到 `pong` 打印到 console。

**Architecture:** 用 Tauri 2 官方模板起步（保证 `tauri.conf.json` / capabilities / 图标 / build 钩子校对过），随后手工重构成两段：Rust 侧按 ARCHITECTURE.md / ADAPTER_SPEC.md 的边界拆成 `commands.rs` + `modules/{adapter,scanner,inventory,db,platform,errors}/`，前端用 React Router + Zustand + 类型化 invoke 封装。脚手架阶段**不引入任何单元测试框架**——没有可测试的行为可写；验收靠 spec §9 的 8 条手动检查完成。

**Tech Stack:** Tauri 2 (^2.0), React 18, TypeScript 5.5 (strict), Vite 5, React Router 6, Zustand 4, pnpm 9, Rust 1.77+ (serde, serde_json, thiserror)。

## Global Constraints

以下条目从 spec 原样复制，每个任务的隐含前提就是这一节。违反任一条都视为不符合 spec。

- **Rust toolchain** ≥ 1.77（`Cargo.toml` 的 `rust-version = "1.77"`，`Cargo.lock` 由 `cargo` 生成）。
- **Node.js** ≥ 20，**pnpm** ≥ 9（README 要求）。
- **包管理器** pnpm；`pnpm-lock.yaml` 由 `pnpm install` 生成，不要提交 `package-lock.json` 或 `yarn.lock`。
- **Rust 依赖** 仅 `tauri`、`tauri-build`、`serde`(+derive)、`serde_json`、`thiserror`。**不引入** `rusqlite`/`sqlx`、`notify`、`blake3`/`sha2`、`tokio`、`clap`——它们随对应模块的实现一起加入。
- **前端依赖** 仅 `@tauri-apps/api`、`@tauri-apps/cli`、`react`、`react-dom`、`react-router-dom`、`zustand`、对应 types 与 `@vitejs/plugin-react`。**不引入** ESLint、Prettier、Husky、测试框架、UI 组件库。
- **Tauri capabilities** 仅 `core:default`；不预先授予 `fs`/`shell`/`dialog`/`opener`。
- **目录命名**：`src-tauri/src/modules/{adapter,scanner,inventory,db,platform,errors}/`，每个目录一个 `mod.rs`（脚手架阶段不拆多文件）。
- **占位策略**：`db`、`scanner`、`inventory` 三个模块仅文件级 doc 注释，零符号；`platform` 定义 `app_data_dir() -> PathBuf` 签名、body `todo!()`；`errors` 定义 `AsmError` + `AsmResult<T>`；`adapter` 定义 `AgentId`、`DetectionResult` 占位、`AgentAdapter` trait（仅 `id()`）+ `claude_code.rs` / `codex.rs` 空实现。
- **Tauri 命令** 脚手架阶段仅 `ping` 一个；命令体只做参数转发，零业务逻辑。
- **IPC** 通过 `@tauri-apps/api/core` 的 `invoke<T>()`，所有调用集中在 `src/ipc/commands.ts`；类型集中在 `src/ipc/types.ts`。组件里**禁止**直接 `invoke()`。
- **路由** 用 `HashRouter`（Tauri 桌面应用标准做法，避免 file:// 协议下 history 路由失败）。
- **样式** 手写 `src/styles/global.css`，**不引入** CSS 框架、Tailwind、styled-components。
- **TypeScript**：`strict: true` + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch`。
- **Vite**：`server.port = 1421`、`strictPort = true`、`watch.ignored = ["**/src-tauri/**"]`、`envPrefix = ["VITE_", "TAURI_"]`、`build.target = "es2022"`、`minify = "esbuild"`。
- **`tauri.conf.json`** schema = `https://schema.tauri.app/config/2`，identifier = `com.agentskillmanager.app`，窗口 1280×800（最小 960×600），`frontendDist = "../dist"`，`beforeDevCommand = "pnpm dev"`，`devUrl = http://localhost:1421`。
- **`.gitignore`** 追加 `src-tauri/target/`、`src-tauri/gen/`、`dist/`、`.DS_Store`。
- **Rust 静态检查** `.rustfmt.toml` (`edition = "2021"`、`max_width = 100`、`tab_spaces = 4`)；`.clippy.toml` (`msrv = "1.77"`)。
- **README** 拆为根目录 `README.md`（onboarding）与 `docs/PROJECT_OVERVIEW.md`（产品高层概述，从旧 README 迁移）。
- **图标** 使用 `pnpm create tauri-app` 模板自带的占位 PNG/ICO/ICNS；不替换为正式品牌资源。
- **Commit 风格** 中文描述 + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。

---

## File Structure

实施中将创建或修改的文件（按写入先后）：

```
agent-skill-manager/
├── package.json                              # T2、T3、T4 修改（依赖 + 脚本）
├── pnpm-lock.yaml                            # T2、T3 由 pnpm install 生成
├── index.html                                # T1 模板生成、T4 清理
├── tsconfig.json                             # T4 创建（替换模板默认）
├── tsconfig.node.json                        # T4 创建
├── vite.config.ts                            # T4 重写
├── .gitignore                                # T5 追加
├── .rustfmt.toml                             # T2 创建
├── .clippy.toml                              # T2 创建
├── README.md                                 # T5 重写
├── src/
│   ├── main.tsx                              # T1 模板生成、T4 检查无改动
│   ├── App.tsx                               # T4 重写
│   ├── routes/
│   │   ├── Dashboard.tsx                     # T4 创建
│   │   ├── Library.tsx                       # T4 创建
│   │   ├── AgentMatrix.tsx                   # T4 创建
│   │   ├── Agents.tsx                        # T4 创建
│   │   ├── ScanHistory.tsx                   # T4 创建
│   │   └── Settings.tsx                      # T4 创建
│   ├── stores/
│   │   └── uiStore.ts                        # T4 创建
│   ├── ipc/
│   │   ├── commands.ts                       # T4 创建
│   │   └── types.ts                          # T4 创建
│   └── styles/
│       └── global.css                        # T4 创建
└── src-tauri/
    ├── Cargo.toml                            # T2 修改（crate-type 等）
    ├── tauri.conf.json                       # T1 模板生成、T2 校核
    ├── build.rs                              # T1 模板生成
    ├── capabilities/
    │   └── default.json                      # T2 校核为仅 core:default
    ├── icons/                                # T1 模板生成（保持原状）
    └── src/
        ├── main.rs                           # T2 重写
        ├── lib.rs                           # T2 重写
        ├── commands.rs                       # T2 创建
        └── modules/
            ├── adapter/
            │   ├── mod.rs                    # T2 创建
            │   ├── claude_code.rs            # T2 创建
            │   └── codex.rs                  # T2 创建
            ├── scanner/mod.rs                # T2 创建（注释占位）
            ├── inventory/mod.rs              # T2 创建（注释占位）
            ├── db/mod.rs                     # T2 创建（注释占位）
            ├── platform/mod.rs               # T2 创建（签名 + todo!()）
            └── errors/mod.rs                 # T2 创建
```

---

## Task 1: 用 Tauri 2 模板生成 baseline

**Files:**
- Create: 模板生成的 `package.json`、`pnpm-lock.yaml`、`index.html`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`src/` 目录、`src-tauri/` 目录（含 `Cargo.toml`、`tauri.conf.json`、`build.rs`、`capabilities/default.json`、`icons/`、`src/main.rs`、`src/lib.rs`）
- Modify: 模板生成的 `package.json`（保留原状，T2 再改）
- Modify: `index.html`（保留 Tauri 模板的 body 标记）
- Test: 无（脚手架阶段不写测试）

**Interfaces:**
- Consumes: pnpm 9+、Rust 1.77+、Node 20+
- Produces: 一个能 `pnpm tauri:dev` 起 Tauri 默认窗口的 baseline 工程；后续任务在此基础上重写。

- [ ] **Step 1.1：在 agent-skill-manager 仓库目录确认现状**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git status
```

预期：`On branch main`，工作树包含 `5728dcc docs: add ASM scaffold design spec` 与未跟踪的 `.idea/`。如果有冲突的本地改动，先 `git stash` 备份。

- [ ] **Step 1.2：用 `pnpm create tauri-app` 在临时目录生成模板**

不要直接在仓库里跑——模板会拒绝非空目录。改成生成到临时目录再拷过来：

```bash
cd /tmp
pnpm create tauri-app@latest asm-tmp -- --manager pnpm --template react-ts --identifier com.agentskillmanager.app
```

回答任何交互提示时按上述参数走（`pnpm` 包管理器、`react-ts` 模板、identifier 设为 `com.agentskillmanager.app`）。若 CLI 仍提示交互，可改用非交互模式：

```bash
cd /tmp
pnpm create tauri-app@latest asm-tmp -- --manager pnpm --template react-ts --identifier com.agentskillmanager.app -y
```

- [ ] **Step 1.3：把模板内容并入仓库**

```bash
cp -R /tmp/asm-tmp/. /Users/dragon/workspace/resp/agent-skill-manager/
rm -rf /tmp/asm-tmp
cd /Users/dragon/workspace/resp/agent-skill-manager
ls -la
```

预期：仓库根目录出现 `package.json`、`pnpm-lock.yaml`、`index.html`、`vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`src/`、`src-tauri/`、`README.md`（模板默认）。

- [ ] **Step 1.4：核对模板默认 `src/` 与 `src-tauri/`**

```bash
ls src/ src-tauri/ src-tauri/src/ src-tauri/capabilities/ src-tauri/icons/
```

预期：
- `src/` 至少有 `main.tsx`、`App.tsx`、`assets/`（含 react.svg 等模板 logo）、`vite-env.d.ts`。
- `src-tauri/src/` 有 `main.rs`、`lib.rs`。
- `src-tauri/capabilities/` 有 `default.json`。
- `src-tauri/icons/` 有 4 个占位图标（`32x32.png`、`128x128.png`、`128x128@2x.png`、`icon.icns` 或 `icon.ico`——视平台而定）。

- [ ] **Step 1.5：核对 `tauri.conf.json` 的 identifier 已正确**

```bash
grep -n '"identifier"' /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/tauri.conf.json
```

预期：输出 `"identifier": "com.agentskillmanager.app"`。如果模板沿用 `com.tauri.dev` 之类的占位 identifier，改为 `com.agentskillmanager.app` 后继续。

- [ ] **Step 1.6：核对 capabilities 只授 `core:default`**

```bash
cat /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/capabilities/default.json
```

预期：permissions 数组只含 `"core:default"`（或等价核心能力）。如有 `core:event:default`、`core:window:default` 等被显式列出，合并成 `"core:default"`。

- [ ] **Step 1.7：暂存 `.gitignore` 变更并准备 T1 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git add -A
git status
```

预期：除了 `.idea/` 仍保持 untracked（IDE 临时文件，T5 才处理），其余模板文件全部 staged。`.gitignore` 末尾追加项 T5 处理，本任务不动。

- [ ] **Step 1.8：提交模板导入**

```bash
git commit -m "$(cat <<'EOF'
chore(scaffold): import Tauri 2 React+TS template

Imports create-tauri-app baseline as the starting point for the ASM scaffold.
Template cleanup, module restructuring, route wiring, and doc split land in
later tasks. Tauri capabilities are pinned to core:default; no fs/shell/dialog
permissions are pre-granted.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

预期：commit 成功，git log 新增一条。

- [ ] **Step 1.9（验收 A）：`pnpm install` 通过**

```bash
pnpm install
```

预期：依赖安装成功，无 error。warning 可以接受。

- [ ] **Step 1.10（验收 B）：模板默认能 `pnpm tauri:dev` 起窗口**

```bash
pnpm tauri:dev
```

预期：弹出标题为 "Tauri" 或 "React App" 的窗口（含 Vite logo + 计数器）。窗口出现后即可关闭（Ctr+C 终止 dev server）。如果启动报错（如 Rust 编译失败、Tauri schema 不匹配），先排查环境再继续。

---

## Task 2: 重构 Rust 侧为扁平多模块

**Files:**
- Modify: `src-tauri/src/main.rs`（改为 `fn main() { asm_lib::run(); }`）
- Modify: `src-tauri/src/lib.rs`（改为 `mod commands; mod modules;` + Builder 装配 + `invoke_handler` 注册 `commands::ping`）
- Modify: `src-tauri/Cargo.toml`（补 `crate-type`、把 `lib.name = "asm_lib"`）
- Modify: `src-tauri/capabilities/default.json`（仅保留 `core:default`）
- Create: `src-tauri/src/commands.rs`（`ping` 命令 + `PingResponse`）
- Create: `src-tauri/src/modules/errors/mod.rs`
- Create: `src-tauri/src/modules/platform/mod.rs`
- Create: `src-tauri/src/modules/adapter/mod.rs`
- Create: `src-tauri/src/modules/adapter/claude_code.rs`
- Create: `src-tauri/src/modules/adapter/codex.rs`
- Create: `src-tauri/src/modules/db/mod.rs`（注释占位）
- Create: `src-tauri/src/modules/scanner/mod.rs`（注释占位）
- Create: `src-tauri/src/modules/inventory/mod.rs`（注释占位）
- Create: `.rustfmt.toml`
- Create: `.clippy.toml`
- Test: 无

**Interfaces:**
- Consumes: 模板的 `tauri = "2"` + `serde = { version = "1", features = ["derive"] }` 依赖。
- Produces:
  - Tauri 命令 `ping() -> PingResponse { message: &'static str }`，`PingResponse` 派生 `Serialize`。
  - `AsmError { kind: &'static str, message: String }`，`AsmResult<T> = Result<T, AsmError>`。
  - `pub fn app_data_dir() -> PathBuf`（body `todo!()`）。
  - `pub struct AgentId(pub String)`、`pub struct DetectionResult { pub agent: AgentId, pub detected: bool }`、`pub trait AgentAdapter { fn id(&self) -> AgentId; }`。
  - `pub struct ClaudeCodeAdapter;` 与 `pub struct CodexAdapter;`，各自 `impl AgentAdapter`。

- [ ] **Step 2.1：创建 `.rustfmt.toml`**

写入 `/Users/dragon/workspace/resp/agent-skill-manager/.rustfmt.toml`：

```toml
edition = "2021"
max_width = 100
tab_spaces = 4
```

- [ ] **Step 2.2：创建 `.clippy.toml`**

写入 `/Users/dragon/workspace/resp/agent-skill-manager/.clippy.toml`：

```toml
msrv = "1.77"
```

- [ ] **Step 2.3：修改 `src-tauri/Cargo.toml`**

读取当前文件（模板生成的版本可能略有不同）。在 `[package]` 段确保有 `edition = "2021"` 与 `rust-version = "1.77"`；在文件末尾（`[dependencies]` 之后）补：

```toml
[lib]
name = "asm_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

在 `[dependencies]` 段确保有：

```toml
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
```

如果模板只装了 `tauri = "2"`（没 features 字段），保持不变。如果有 features 列表，改为 `features = []`。**不要**追加 `rusqlite`、`notify`、`blake3`、`tokio`、`clap`。

- [ ] **Step 2.4：重写 `src-tauri/src/main.rs`**

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/main.rs`：

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    asm_lib::run();
}
```

- [ ] **Step 2.5：重写 `src-tauri/src/lib.rs`**

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/lib.rs`：

```rust
//! ASM 桌面应用入口。
//!
//! 装配 Tauri Builder、注册命令、挂载模块。模块实现见 `modules/`。

mod commands;
mod modules;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2.6：创建 `src-tauri/src/commands.rs`**

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/commands.rs`：

```rust
//! Tauri 命令薄壳。命令体内只做参数转发和结果映射，业务逻辑全部下沉到 `modules/`。

use serde::Serialize;

#[derive(Serialize)]
pub struct PingResponse {
    pub message: &'static str,
}

/// 健康检查命令，验证 IPC 通畅。
#[tauri::command]
pub fn ping() -> PingResponse {
    PingResponse { message: "pong" }
}
```

- [ ] **Step 2.7：创建 `src-tauri/src/modules/errors/mod.rs`**

先建目录：

```bash
mkdir -p /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/{errors,platform,adapter,scanner,inventory,db}
mkdir -p /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/adapter
```

然后写入 `src-tauri/src/modules/errors/mod.rs`：

```rust
//! 统一错误类型。
//!
//! 后续 Adapter / Scanner / Inventory 的错误统一收敛为 `AsmError`，
//! 通过 `serde` 序列化为前端可读结构。MVP 阶段先占位，不暴露具体变体。

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AsmError {
    pub kind: &'static str,
    pub message: String,
}

pub type AsmResult<T> = Result<T, AsmError>;
```

- [ ] **Step 2.8：创建 `src-tauri/src/modules/platform/mod.rs`**

写入 `src-tauri/src/modules/platform/mod.rs`：

```rust
//! 平台服务。
//!
//! 负责解析应用数据目录、用户主目录、跨平台路径标准化。
//! 严格遵循 ARCHITECTURE.md §7：绝不硬编码路径分隔符或 home 字符串。
//!
//! M0 阶段：仅占位，提供 `app_data_dir()` 一个常量返回函数。

use std::path::PathBuf;

/// ASM 应用数据目录的解析入口。
///
/// 调用方（如 Inventory 模块）按签名调用即可；具体解析逻辑在 M0 实现阶段补齐。
#[allow(clippy::todo)]
pub fn app_data_dir() -> PathBuf {
    todo!("platform::app_data_dir 在 M0 实现阶段补齐")
}
```

- [ ] **Step 2.9：创建 `src-tauri/src/modules/adapter/mod.rs`**

写入 `src-tauri/src/modules/adapter/mod.rs`：

```rust
//! Agent Adapter 注册与统一契约。
//!
//! 契约见 ADAPTER_SPEC.md §3。MVP 仅 `detect` 和 `scan` 为必实现。
//! M0 阶段：定义 trait 骨架，提供 Claude Code / Codex 两个空实现占位。

mod claude_code;
mod codex;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AgentId(pub String);

/// 占位的检测结果。M0 真正实现时替换为完整 DetectionResult。
#[derive(Debug, Clone, Serialize)]
pub struct DetectionResult {
    pub agent: AgentId,
    pub detected: bool,
}

/// MVP 阶段所有适配器必须实现的最小契约。
/// 完整方法（`detect` / `scan` / `capabilities` / `skill_roots`）在 M0 实现时补齐。
pub trait AgentAdapter {
    fn id(&self) -> AgentId;
}

pub use claude_code::ClaudeCodeAdapter;
pub use codex::CodexAdapter;
```

- [ ] **Step 2.10：创建 `src-tauri/src/modules/adapter/claude_code.rs`**

写入 `src-tauri/src/modules/adapter/claude_code.rs`：

```rust
//! Claude Code Adapter 占位。
//!
//! 完整 detect / scan 见 ADAPTER_SPEC.md。M0 阶段仅实现 trait 必需方法。

use super::{AgentAdapter, AgentId};

pub struct ClaudeCodeAdapter;

impl AgentAdapter for ClaudeCodeAdapter {
    fn id(&self) -> AgentId {
        AgentId("claude-code".to_string())
    }
}
```

- [ ] **Step 2.11：创建 `src-tauri/src/modules/adapter/codex.rs`**

写入 `src-tauri/src/modules/adapter/codex.rs`：

```rust
//! Codex Adapter 占位。
//!
//! 完整 detect / scan 见 ADAPTER_SPEC.md。M0 阶段仅实现 trait 必需方法。

use super::{AgentAdapter, AgentId};

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn id(&self) -> AgentId {
        AgentId("codex".to_string())
    }
}
```

- [ ] **Step 2.12：创建三个注释占位模块**

写入 `src-tauri/src/modules/db/mod.rs`：

```rust
//! SQLite 持久化层。
//!
//! ARCHITECTURE.md §3 "Database"：连接、迁移、仓库模块。MVP 不直接对外暴露表，
//! 仅供 Inventory 模块调用。
//!
//! M0 阶段：占位。引入 `rusqlite` 或 `sqlx` 在 M0 真正开始实现时决定。
```

写入 `src-tauri/src/modules/scanner/mod.rs`：

```rust
//! Scanner 编排层。
//!
//! 见 SCANNER_SPEC.md：Detect → Discover → Parse → Fingerprint → Analyze → Persist。
//!
//! M0 阶段：占位。等 Adapter 的 detect / scan 真正可用时再实现编排。
```

写入 `src-tauri/src/modules/inventory/mod.rs`：

```rust
//! Inventory 服务。
//!
//! 见 ARCHITECTURE.md §3 与 DOMAIN_MODEL.md：维护 Agent / Skill / Installation
//! 的归一化视图与查询接口。
//!
//! M0 阶段：占位。
```

- [ ] **Step 2.13：校核 `src-tauri/capabilities/default.json`**

读取文件，确保内容等价于：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

如有 `core:event:default`、`core:window:default` 等展开形式，统一收敛为 `"core:default"`。

- [ ] **Step 2.14（验收 A）：`cargo fmt` 全仓格式化**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri
cargo fmt
```

预期：无输出，退出码 0。

- [ ] **Step 2.15（验收 B）：`cargo fmt --check` 通过**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri
cargo fmt --check
```

预期：退出码 0，无 diff 输出。

- [ ] **Step 2.16（验收 C）：`cargo check` 通过**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri
cargo check
```

预期：编译成功，输出 `Finished \`dev\` profile [unoptimized + debuginfo] target(s)`。warning 可以接受（但若出现"unused import"等可修警告就修掉）。

- [ ] **Step 2.17（验收 D）：`cargo clippy -- -D warnings` 通过**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri
cargo clippy -- -D warnings
```

预期：退出码 0。`#[allow(clippy::todo)]` 是显式允许项，不应被 clippy 拒绝。如果 clippy 因为 `todo!()` 报错，调整为：

```rust
#[allow(clippy::todo)]
pub fn app_data_dir() -> PathBuf {
    todo!("platform::app_data_dir 在 M0 实现阶段补齐")
}
```

（Step 2.8 已含该属性，若仍报错请检查 `clippy.toml` 是否包含 `avoid-breaking-exported-api = false` 等会冲突的项，必要时删除非 msrv 字段。）

- [ ] **Step 2.18：提交 Rust 重构**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git add -A
git status
```

预期：staged 包括 `src-tauri/src/{main.rs,lib.rs,commands.rs}`、`src-tauri/src/modules/`、`src-tauri/Cargo.toml`、`.rustfmt.toml`、`.clippy.toml`，可能还有 `src-tauri/capabilities/default.json` 的微调。

```bash
git commit -m "$(cat <<'EOF'
refactor(scaffold): split Rust into flat modules

Replaces the template's single lib.rs with modules/{adapter,scanner,inventory,
db,platform,errors} matching ARCHITECTURE.md and ADAPTER_SPEC.md boundaries.
Adds ping command (the scaffold's only Tauri command), defines AgentId /
DetectionResult / AgentAdapter trait with empty Claude Code and Codex impls,
pins capabilities to core:default, and configures rustfmt + clippy.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

预期：commit 成功。

---

## Task 3: 收紧前端依赖与 TypeScript / Vite 配置

**Files:**
- Modify: `package.json`（依赖列表改为 spec §4.1 锁定的版本范围，脚本定型）
- Modify: `tsconfig.json`（覆盖模板默认，启用 strict + 三个 no-X 规则）
- Modify: `tsconfig.node.json`（覆盖模板默认）
- Modify: `vite.config.ts`（覆盖模板默认，固定端口与 watch 规则）
- Delete（可选）: 模板默认的 `src/assets/react.svg` 与模板里的 `App.css`、`index.css`——T4 再彻底清
- Test: 无

**Interfaces:**
- Consumes: 模板默认的 `package.json`、`tsconfig.json`、`tsconfig.node.json`、`vite.config.ts`。
- Produces: 与 spec §4 完全对齐的依赖清单与配置文件；`pnpm install` 后可重生成 `pnpm-lock.yaml`。

- [ ] **Step 3.1：重写 `package.json`**

读取模板的 `package.json`，覆盖为：

```json
{
  "name": "agent-skill-manager",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

如果模板默认 `name` 不是 `agent-skill-manager`（如 `asm-tmp`），改之。

- [ ] **Step 3.2：重写 `tsconfig.json`**

读取模板默认内容，覆盖为：

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3.3：重写 `tsconfig.node.json`**

读取模板默认内容，覆盖为：

```jsonc
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 3.4：重写 `vite.config.ts`**

读取模板默认内容，覆盖为：

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri 期望固定端口；HMR 通过 1421
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    minify: "esbuild",
    sourcemap: false,
  },
});
```

- [ ] **Step 3.5：删模板默认资源文件**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
rm -f src/assets/react.svg
ls src/assets/ 2>/dev/null
```

如果 `src/assets/` 目录已空，保留目录（后续可能用到）；如想彻底清理，连目录一起 `rmdir`：

```bash
rmdir src/assets 2>/dev/null || true
```

模板默认 `App.css`、`index.css` 暂不删——T4 重写 `App.tsx` 时一并清理。

- [ ] **Step 3.6：刷新依赖**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
pnpm install
```

预期：依赖被规整到 spec §4.1 锁定的版本范围，`pnpm-lock.yaml` 被更新。

- [ ] **Step 3.7（验收）：`pnpm build`（即 `tsc --noEmit && vite build`）通过**

```bash
pnpm build
```

预期：tsc 无错误（warning 可能来自模板的 `App.tsx`，T4 会清），vite build 成功输出到 `dist/`。**注意**：此时模板默认的 `App.tsx` 仍在，所以 `noUnusedLocals`/`noUnusedParameters` 触发的话，先临时放宽不修——T4 会彻底重写。

如果 tsc 报错拦住了 vite build，可临时改成：

```bash
pnpm exec tsc --noEmit || true
pnpm exec vite build
```

记录这条 warning，作为 T4 的待办。

- [ ] **Step 3.8：提交配置收紧**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git add -A
git status
```

预期：staged 包括 `package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`tsconfig.node.json`、`vite.config.ts`、`src/assets/` 的删除（如发生）。

```bash
git commit -m "$(cat <<'EOF'
chore(scaffold): pin frontend deps and tsconfig

Aligns package.json with the spec's locked dependency set, switches
tsconfig to strict + noUnusedLocals/Parameters/FallthroughCasesInSwitch,
and pins Vite to port 1421 with src-tauri ignored. Default Vite logo
asset removed; App.tsx rewrite lands in the next task.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 路由 + IPC 类型化封装 + 占位页面

**Files:**
- Modify: `index.html`（改 `<title>` 为 "Agent Skill Manager"，移除 Vite 默认 `<link>` 与 logo 引用）
- Modify: `src/main.tsx`（保留模板结构，但确保只导入 `./App`）
- Modify: `src/App.tsx`（彻底重写为 HashRouter + 侧边栏 + 6 条路由）
- Delete: `src/App.css`、`src/index.css`（模板默认）
- Create: `src/routes/Dashboard.tsx`、`src/routes/Library.tsx`、`src/routes/AgentMatrix.tsx`、`src/routes/Agents.tsx`、`src/routes/ScanHistory.tsx`、`src/routes/Settings.tsx`
- Create: `src/ipc/commands.ts`、`src/ipc/types.ts`
- Create: `src/stores/uiStore.ts`
- Create: `src/styles/global.css`
- Test: 无

**Interfaces:**
- Consumes: 模板默认 `index.html`；`@tauri-apps/api` 的 `invoke<T>()`；React Router 6 的 `HashRouter`、`Routes`、`Route`、`NavLink`；Zustand 4 的 `create`。
- Produces:
  - `export interface PingResponse { message: string }`（`src/ipc/types.ts`）。
  - `export async function ping(): Promise<PingResponse>`（`src/ipc/commands.ts`）。
  - `useUiStore` Zustand store，含 `sidebarCollapsed: boolean` 与 `toggleSidebar(): void`。
  - 6 个路由组件，每个导出 default 函数组件。
  - `App` 默认导出组件，渲染 `<HashRouter>` + sidebar nav + `<Routes>`。

- [ ] **Step 4.1：重写 `index.html`**

读取模板默认内容（应包含 `<div id="root"></div>` 与 Vite 默认的 favicon/logo 引用），覆盖为：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Agent Skill Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4.2：清理 `src/main.tsx`**

读取模板默认内容，覆盖为：

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

如果模板有 import 任何模板默认样式（`./App.css`、`./index.css`），删除之——T4 全部走 `global.css`。

- [ ] **Step 4.3：删除模板默认样式文件**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
rm -f src/App.css src/index.css
ls src/
```

预期：`src/` 仍有 `main.tsx`、`App.tsx`，但 `App.css` 与 `index.css` 不再存在。

- [ ] **Step 4.4：创建 `src/styles/global.css`**

写入 `src/styles/global.css`：

```css
:root {
  --bg: #fafafa;
  --fg: #1f2328;
  --muted: #6e7681;
  --border: #d0d7de;
  --accent: #0969da;
  --sidebar-w: 240px;
}

* { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  background: var(--bg);
  color: var(--fg);
}

.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) 1fr;
  height: 100%;
}

.sidebar {
  border-right: 1px solid var(--border);
  padding: 16px 12px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.brand {
  margin: 0 8px 16px;
  font-size: 18px;
  letter-spacing: 0.04em;
}

.sidebar nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar nav a {
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--fg);
  text-decoration: none;
  font-size: 14px;
}

.sidebar nav a:hover { background: #f3f4f6; }

.sidebar nav a.active {
  background: var(--accent);
  color: #fff;
}

.content {
  padding: 24px 32px;
  overflow: auto;
}

.page h1 {
  margin: 0 0 8px;
  font-size: 22px;
}

.empty-hint {
  color: var(--muted);
  font-size: 14px;
}
```

- [ ] **Step 4.5：创建 `src/ipc/types.ts`**

写入 `src/ipc/types.ts`：

```ts
export interface PingResponse {
  message: string;
}
```

- [ ] **Step 4.6：创建 `src/ipc/commands.ts`**

写入 `src/ipc/commands.ts`：

```ts
import { invoke } from "@tauri-apps/api/core";
import type { PingResponse } from "./types";

/**
 * 与 Rust 端 `commands::ping` 对应。
 * 类型化封装，避免在组件里直接调用字符串 invoke。
 */
export async function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}
```

- [ ] **Step 4.7：创建 `src/stores/uiStore.ts`**

写入 `src/stores/uiStore.ts`：

```ts
import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
```

- [ ] **Step 4.8：创建 6 个路由占位组件**

依次创建下列 6 个文件，每个文件结构相同（仅标题文字不同）。示例 `Dashboard.tsx`：

```tsx
import { useEffect } from "react";
import { ping } from "../ipc/commands";

export default function Dashboard() {
  useEffect(() => {
    ping().then((res) => console.log(res.message));
  }, []);

  return (
    <section className="page">
      <h1>Dashboard</h1>
      <p className="empty-hint">Run scan to discover agents.</p>
    </section>
  );
}
```

其余 5 个（`Library.tsx`、`AgentMatrix.tsx`、`Agents.tsx`、`ScanHistory.tsx`、`Settings.tsx`）结构：

```tsx
export default function Library() {
  return (
    <section className="page">
      <h1>Library</h1>
      <p className="empty-hint">Run scan to discover agents.</p>
    </section>
  );
}
```

（标题文字分别改为 `Agent Matrix` / `Agents` / `Scan History` / `Settings`。）

**注意**：仅 `Dashboard.tsx` 含 `useEffect` 调 ping；其他 5 个文件**不要**导入 `ping`，避免无意义 IPC 调用。

- [ ] **Step 4.9：重写 `src/App.tsx`**

读取模板默认内容，覆盖为：

```tsx
import { HashRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Library from "./routes/Library";
import AgentMatrix from "./routes/AgentMatrix";
import Agents from "./routes/Agents";
import ScanHistory from "./routes/ScanHistory";
import Settings from "./routes/Settings";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/library", label: "Library" },
  { to: "/matrix", label: "Agent Matrix" },
  { to: "/agents", label: "Agents" },
  { to: "/history", label: "Scan History" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <h1 className="brand">ASM</h1>
          <nav>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/matrix" element={<AgentMatrix />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/history" element={<ScanHistory />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
```

- [ ] **Step 4.10（验收 A）：`pnpm build` 通过**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
pnpm build
```

预期：
- `tsc --noEmit` 无错误。
- `vite build` 输出到 `dist/`。
- 整个命令退出码 0。

- [ ] **Step 4.11（验收 B）：`pnpm tauri:dev` 起窗口、IPC 打印 pong**

```bash
pnpm tauri:dev
```

预期：
- 桌面窗口打开，标题为 "Agent Skill Manager"。
- 左侧 6 个导航项可见：Dashboard / Library / Agent Matrix / Agents / Scan History / Settings。
- 默认路由 `/` 渲染 Dashboard 页，显示标题 "Dashboard" + 提示 "Run scan to discover agents."。
- 打开 DevTools（macOS: ⌘+Option+I；Windows/Linux: Ctrl+Shift+I），console 输出 `pong`。
- 点击任一导航项切换路由，页面标题随之变化，无 console 错误。
- 关闭 dev server（Ctr+C）。

- [ ] **Step 4.12：提交前端装配**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git add -A
git status
```

预期：staged 包括 `index.html`、`src/main.tsx`、`src/App.tsx`、`src/routes/*`、`src/ipc/*`、`src/stores/*`、`src/styles/global.css`，可能还有 `src/App.css`/`src/index.css` 的删除。

```bash
git commit -m "$(cat <<'EOF'
feat(scaffold): wire routes and typed IPC ping

Replaces the template App with HashRouter + 6 sidebar routes (Dashboard,
Library, Agent Matrix, Agents, Scan History, Settings), a Zustand uiStore,
typed invoke wrapper in src/ipc/commands.ts, and a hand-written global.css.
Dashboard calls ping() on mount and logs the response, end-to-end verifying
the IPC pipeline as the scaffold's only runtime check.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: README 拆分 + `.gitignore` 追加

**Files:**
- Modify: `README.md`（覆盖为 spec §7 的 onboarding 内容）
- Create: `docs/PROJECT_OVERVIEW.md`（从模板默认 README 提取产品概述——但模板默认 README 通常很短，几乎是项目名 + 链接，遇到内容不足时按 spec §7 末段"看 docs/PRD.md §5"指引精简版即可）
- Modify: `.gitignore`（追加 `src-tauri/target/`、`src-tauri/gen/`、`dist/`、`.DS_Store`）
- Test: 无

**Interfaces:**
- Consumes: 当前 `README.md`、当前 `.gitignore`。
- Produces: 根目录 onboarding-only 的 `README.md`、保留产品叙述的 `docs/PROJECT_OVERVIEW.md`、覆盖范围更全的 `.gitignore`。

- [ ] **Step 5.1：备份当前 `README.md`**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
cp README.md /tmp/asm-readme-backup.md
```

即使后续判定为"模板默认 README 内容太薄、无需拆分"，备份可保证可恢复。

- [ ] **Step 5.2：写新的 `README.md`**

覆盖 `/Users/dragon/workspace/resp/agent-skill-manager/README.md`：

````markdown
# Agent Skill Manager (ASM)

> Cross-platform desktop app to inventory AI Agent Skills.

## Status

Planning & architecture phase. This repository currently contains:
- Design specifications under `docs/`
- A runnable scaffold (Tauri 2 + React + Rust) with a smoke-checked IPC pipeline

No adapter, scanner, or inventory logic is implemented yet. See the MVP roadmap in [`docs/PRD.md`](docs/PRD.md).

## Prerequisites

| Tool | Version |
| --- | --- |
| Rust | ≥ 1.77 |
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| OS | macOS 13+, Windows 10+, or a current Linux desktop |

On Linux you also need the Tauri system dependencies listed at https://v2.tauri.app/start/prerequisites/.

## Quick start

```bash
pnpm install
pnpm tauri:dev
```

The first run downloads Rust dependencies and may take several minutes. When the window opens you should see the ASM shell with six navigation items; opening DevTools shows a `pong` log confirming the IPC pipeline.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server only (browser preview at http://localhost:1421) |
| `pnpm tauri:dev` | Full desktop app in dev mode |
| `pnpm tauri:build` | Production bundle for the current platform |
| `pnpm build` | Type-check + production frontend bundle |
| `cargo fmt --check` | Verify Rust formatting |
| `cargo clippy -- -D warnings` | Lint Rust sources |

## Layout

```
src/              React + TypeScript frontend
src-tauri/        Rust core (Tauri 2)
docs/             PRD, architecture, domain, adapter, scanner, UI specs
docs/superpowers/ Design specs and plans produced through brainstorming
```

## Documentation

- [PRD](docs/PRD.md)
- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [Adapter Spec](docs/ADAPTER_SPEC.md)
- [Scanner Spec](docs/SCANNER_SPEC.md)
- [UI Spec](docs/UI_SPEC.md)

## Contributing

Issues and PRs welcome. See `docs/PRD.md` §5 for the user problems the MVP targets.
````

- [ ] **Step 5.3：把当前 README 的产品叙述迁到 `docs/PROJECT_OVERVIEW.md`**

读取 `/tmp/asm-readme-backup.md`。**只有当** 该文件含有"问题陈述 / 核心能力 / 原则 / MVP 路线图 / 参与贡献"等内容（即原仓库迁移过来的产品叙述，而非模板默认的 Tauri 简介）时，才需要拆分。

如果备份里就是模板默认 README（标题 + Vite/Tauri 简介 + 几行模板说明），**不写** `PROJECT_OVERVIEW.md`，跳过 Step 5.3。原因：模板 README 不是产品叙述，迁移过去就是噪音。直接进入 Step 5.4。

如果备份里有产品叙述，写入 `/Users/dragon/workspace/resp/agent-skill-manager/docs/PROJECT_OVERVIEW.md`，文件首加一段引导：

```markdown
# ASM Project Overview

> 这是 ASM 项目的高层概述（产品定位、原则、MVP 路线图）。想了解如何跑起来或贡献代码，请看根目录 [`README.md`](../../README.md)。

---

<原 README 中的产品叙述原文保留>
```

- [ ] **Step 5.4：追加 `.gitignore`**

读取 `/Users/dragon/workspace/resp/agent-skill-manager/.gitignore` 当前内容，在文件末尾追加：

```
# ASM-specific
src-tauri/target/
src-tauri/gen/
dist/
.DS_Store
```

用 `cat >>`：

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
cat >> .gitignore <<'EOF'

# ASM-specific
src-tauri/target/
src-tauri/gen/
dist/
.DS_Store
EOF
tail -20 .gitignore
```

预期：文件末尾出现 4 行新条目。

- [ ] **Step 5.5（验收）：`.gitignore` 生效**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git status
```

预期：`.idea/` 仍 untracked（IDE 临时目录，spec 未要求忽略——除非用户后续要求）；`src-tauri/target/` 与 `dist/` 即使存在也不再出现在 untracked 列表。

- [ ] **Step 5.6：提交 README 与 .gitignore**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
git add -A
git status
```

预期：staged 包括 `README.md`、可能的 `docs/PROJECT_OVERVIEW.md`、`.gitignore`。`src-tauri/target/` 不应出现。

```bash
git commit -m "$(cat <<'EOF'
docs(scaffold): split README into onboarding + project overview

Rewrites root README as a focused onboarding doc (prereqs, quick start,
commands, layout). Migrates the existing product narrative (if any) to
docs/PROJECT_OVERVIEW.md. Extends .gitignore with src-tauri/target,
src-tauri/gen, dist, and .DS_Store.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 端到端验收（spec §9 全 8 条）

**Files:** 无（纯验收任务）。如有失败则回到对应 Task 修补。

**Interfaces:** 验收脚本覆盖整个仓库。

- [ ] **Step 6.1：跑 §9 验收清单**

在仓库根目录依次跑：

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager

# 1. pnpm install 无错误
pnpm install

# 2. pnpm build 无错误
pnpm build

# 6. cargo check
(cd src-tauri && cargo check)

# 7. cargo fmt --check
(cd src-tauri && cargo fmt --check)

# 8. cargo clippy -- -D warnings
(cd src-tauri && cargo clippy -- -D warnings)
```

预期：全部退出码 0。

- [ ] **Step 6.2：跑 §9 验收清单中需要 dev server 的项**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager
pnpm tauri:dev
```

人工检查（spec §9 第 3、4、5 条）：
- 3. 窗口标题 "Agent Skill Manager"，6 个侧边栏项。
- 4. 路由切换工作，无 console 错误。
- 5. Dashboard console 输出 `pong`。

完成后 `Ctrl+C` 关闭 dev server。

- [ ] **Step 6.3：失败处理**

任一条验收未通过：定位到对应的 Task 回补。常见回补路径：
- `pnpm install` 报错 → 检查 `package.json` 是否含 spec 之外的依赖（多半是 T3 没覆盖完）。
- `pnpm build` tsc 报错 → 多半是 T4 没改干净的 `App.tsx` 残留或 `noUnusedLocals` 漏网。
- `cargo check` / `clippy` 报错 → T2 的某个文件语法错（多半是 `mod.rs` 声明与子模块名不符）。
- `cargo fmt --check` 报错 → 跑 `cd src-tauri && cargo fmt` 后重新 commit。
- Tauri 窗口未弹出 → 检查 `tauri.conf.json` 的 `identifier`、`devUrl`、`beforeDevCommand`。
- Dashboard 无 `pong` → 打开 DevTools 看 console：`@tauri-apps/api` 报错通常是 `invoke('ping')` 调用栈问题（多半是 `ping` 命令未在 `invoke_handler!` 注册，回 T2.5 检查）。

- [ ] **Step 6.4：记录验收结果**

不需要新增文件。如果全部通过，跳到下一步。如果有修补，重复 Step 6.1–6.3 直到全部通过。

- [ ] **Step 6.5：无需 commit**

本任务不产生新代码。如果 T6.3 触发了 T2 / T3 / T4 / T5 的修补，commit 已经在对应任务里完成。

---

## Self-Review（写完后自检）

**1. Spec coverage**：
- §1 目标 1（`pnpm tauri:dev` 起窗口）→ T4.11 验收。
- §1 目标 2（`ping` IPC 验证）→ T4.10 + T4.11 + T6.1。
- §1 目标 3（Rust 模块边界对齐）→ T2 整个任务。
- §1 目标 4（依赖最小化）→ T3.1 + Global Constraints。
- §1 目标 5（无 ESLint / Prettier / Husky / CI / 测试）→ Global Constraints。
- §3 目录树 → T2–T5 全部覆盖；`docs/PROJECT_OVERVIEW.md` 在 T5.3 有条件创建。
- §4.1–4.6 配置 → T3.1（package.json）、T3.2–3.3（tsconfig）、T3.4（vite）、T2.3（Cargo.toml）、T2.13（capabilities）。
- §5.1–5.7 模块占位 → T2.4–2.12。
- §6.1–6.6 前端装配 → T4.1–4.9。
- §7 README 拆分 → T5.2–5.3。
- §8 .gitignore → T5.4–5.5。
- §9 全部 8 条验收 → T6.1–6.2。
- §10 不包含项 → Global Constraints 集中声明。
- §11 风险 → Global Constraints 中的 Tauri 2 schema 漂移、pnpm + Tauri CLI 怪癖、模块边界漂移、图标资源推迟都已注明。

无遗漏。

**2. Placeholder scan**：
- 搜了所有 step：没有"TBD"、"TODO"、"implement later"、"fill in details"。
- 没有"Add appropriate error handling"这类模糊指令；T2.8 的 `todo!()` 是有意的延迟实现，且函数体明确写了"在 M0 实现阶段补齐"，不构成 placeholder。
- 没有"Similar to Task N"——T4.8 给出了 Dashboard 与其余 5 个文件的完整代码。
- 所有 code step 都展示了完整代码块。
- 没有引用未定义类型或函数——`PingResponse`、`AsmError`、`app_data_dir`、`AgentId`、`DetectionResult`、`AgentAdapter`、`ClaudeCodeAdapter`、`CodexAdapter`、`ping` 都在出现前已定义。

**3. Type consistency**：
- `PingResponse` 在 T4.5 定义为 `{ message: string }`，T4.6 的 `ping(): Promise<PingResponse>` 与 T4.8 的 `res.message` 读取一致。Rust 端 `PingResponse::message: &'static str` 通过 serde 序列化为字符串，与 TS 端 `string` 兼容。
- `AsmError` 在 T2.7 定义为 `{ kind: &'static str, message: String }`；任务中暂无消费者，但签名稳定，后续 Inventory / Adapter 接入直接用。
- `AgentId(String)` 在 T2.9 定义，T2.10/T2.11 消费为 `AgentId("claude-code".to_string())` 与 `AgentId("codex".to_string())`，类型一致。
- `DetectionResult { agent: AgentId, detected: bool }` 定义在 T2.9，目前无消费者，留给 M0。
- `app_data_dir() -> PathBuf` 在 T2.8 定义，无消费者，留给 M0。
- Tauri 命令 `ping` 在 T2.6 定义为 `pub fn ping() -> PingResponse`，T2.5 的 `generate_handler![commands::ping]` 引用一致。
- Frontend `useUiStore` 在 T4.7 定义，T4.9 当前**未消费**（仅装配演示），保留留作 M0 接入 UI 状态时用。**这里有一个微小的潜在 nit**：T4.7 引入 `useUiStore` 但 T4.9 没有 import，会触发 `noUnusedLocals` 警告吗？答：模块级别的导出 `export const useUiStore = ...` 不算 unused（导出是 public API），无 warning。**确认无误。**

无类型一致性问题。

**4. Spec vs plan 范围**：单文件、单可执行单元，单 plan 覆盖完整。不需拆分。