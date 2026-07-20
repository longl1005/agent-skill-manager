# ASM 工程脚手架设计

**日期**：2026-07-20
**状态**：已批准（等待用户对书面 spec 的最终审阅）
**范围**：Agent Skill Manager（ASM）的工程脚手架
**不在范围内**：Adapter 实现、Scanner 逻辑、Inventory 持久化、Sync 引擎、UI 功能（仅保留一个通过冒烟检查的壳）。

## 1. 目标

交付一个可运行的 Tauri 2 + React + TypeScript + Rust 工程，满足以下条件：

1. 通过 `pnpm tauri:dev` 启动，打开 ASM 侧边栏壳的桌面窗口。
2. 暴露一个 Tauri 命令（`ping`），通过在 React Dashboard 中打印 `pong` 来端到端验证 IPC 链路通畅。
3. Rust 模块目录布局与 `docs/ARCHITECTURE.md` 和 `docs/ADAPTER_SPEC.md` 中描述的边界一致，后续里程碑无需重命名或迁移代码。
4. 不引入过早依赖：Rust 侧仅 Tauri、serde、serde_json、thiserror；前端仅 React、React DOM、React Router、Zustand 与 Tauri JS API。
5. 不引入项目尚未决定采用的 lint 基建：无 ESLint、Prettier、Husky、CI、smoke test。

## 2. 思路

使用官方 Tauri 2 模板（`pnpm create tauri-app` 选 React + TypeScript + Vite）作为起点，再按下文结构改造。模板提供了经过验证的 `tauri.conf.json`、capabilities、build 钩子、图标配置；从零手写它们没有额外设计价值，且显著提高出错率。

脚手架接受 10–20 分钟清理模板产物（默认 Vite logo、`App.tsx` 计数器示例）的时间，以换取一个可靠的起点配置。

## 3. 仓库目录布局

```
agent-skill-manager/
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── DOMAIN_MODEL.md
│   ├── ADAPTER_SPEC.md
│   ├── SCANNER_SPEC.md
│   ├── UI_SPEC.md
│   ├── PROJECT_OVERVIEW.md         # 高层概述，从当前 README 迁移
│   └── superpowers/
│       └── specs/
│           └── 2026-07-20-asm-scaffold-design.md
├── src/                            # React 前端
│   ├── main.tsx
│   ├── App.tsx                     # HashRouter + 侧边栏 + 6 条路由
│   ├── routes/
│   │   ├── Dashboard.tsx           # 挂载时调 ping()，打印 "pong"
│   │   ├── Library.tsx
│   │   ├── AgentMatrix.tsx
│   │   ├── Agents.tsx
│   │   ├── ScanHistory.tsx
│   │   └── Settings.tsx
│   ├── stores/
│   │   └── uiStore.ts              # Zustand：仅 sidebarCollapsed
│   ├── ipc/
│   │   ├── commands.ts             # 类型化 invoke 封装
│   │   └── types.ts                # PingResponse 与未来的 DTO
│   └── styles/
│       └── global.css              # 手写的最小化样式
├── src-tauri/                      # Rust 后端
│   ├── src/
│   │   ├── main.rs                 # 调用 asm_lib::run()
│   │   ├── lib.rs                  # Builder + invoke_handler 装配
│   │   ├── commands.rs             # 仅 ping() 命令
│   │   └── modules/
│   │       ├── adapter/
│   │       │   ├── mod.rs          # AgentId、DetectionResult 占位、AgentAdapter trait
│   │       │   ├── claude_code.rs  # 空 struct 实现
│   │       │   └── codex.rs        # 空 struct 实现
│   │       ├── scanner/mod.rs      # 仅注释占位
│   │       ├── inventory/mod.rs    # 仅注释占位
│   │       ├── db/mod.rs           # 仅注释占位
│   │       ├── platform/mod.rs     # app_data_dir() 签名，body = todo!()
│   │       └── errors/mod.rs       # AsmError + AsmResult<T>
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── capabilities/
│   │   └── default.json            # 仅 core:default
│   └── icons/                      # 模板默认占位图标
├── .gitignore                      # 追加 src-tauri/target、src-tauri/gen、dist
├── .rustfmt.toml                   # edition=2021, max_width=100, tab_spaces=4
├── .clippy.toml                    # msrv=1.77, 其余默认
├── index.html
├── package.json
├── pnpm-lock.yaml                  # pnpm install 生成
├── tsconfig.json                   # strict + noUnusedLocals/Parameters/FallthroughCases
├── tsconfig.node.json              # vite.config.ts 的 node 类型
├── vite.config.ts                  # 端口 1421、strictPort、忽略 src-tauri
├── README.md                       # 仅 onboarding
└── LICENSE
```

## 4. 依赖

### 4.1 前端（`package.json`）

| 包 | 版本范围 | 用途 |
| --- | --- | --- |
| `@tauri-apps/api` | ^2.0.0 | IPC 桥 |
| `@tauri-apps/cli` | ^2.0.0 (dev) | Tauri 命令行 |
| `react`、`react-dom` | ^18.3.1 | UI 运行时 |
| `react-router-dom` | ^6.26.0 | 客户端路由 |
| `zustand` | ^4.5.0 | 全局 UI 状态 |
| `typescript` | ^5.5.0 (dev) | 类型检查 |
| `vite` | ^5.4.0 (dev) | 开发服务器 + 打包 |
| `@vitejs/plugin-react` | ^4.3.0 (dev) | React Fast Refresh |
| `@types/react`、`@types/react-dom` | ^18.3.0 (dev) | 类型定义 |

脚本：

```jsonc
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "preview": "vite preview",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
}
```

此阶段不引入 ESLint、Prettier、Husky 或测试框架。

### 4.2 后端（`src-tauri/Cargo.toml`）

| Crate | 版本 | 用途 |
| --- | --- | --- |
| `tauri` | ^2.0 | 桌面壳 |
| `tauri-build`（build-dep） | ^2.0 | 构建脚本 |
| `serde` | ^1（derive） | 命令 I/O |
| `serde_json` | ^1 | 命令载荷 |
| `thiserror` | ^1 | 未来错误类型 |

`crate-type = ["staticlib", "cdylib", "rlib"]`，匹配 Tauri 2 移动端入口惯例。

`[profile.dev]`：`incremental = true`。
`[profile.release]`：`lto = true`、`codegen-units = 1`、`opt-level = "s"`、`panic = "abort"`、`strip = true`。

刻意推迟：`rusqlite`/`sqlx`、`notify`（文件监听）、`blake3`/`sha2`（哈希）、`tokio`（异步运行时——只有 Scanner 真正需要时才引入）、`clap`（不在范围内的 CLI）。这些依赖随使用它们的模块一起加入。

### 4.3 `tsconfig.json`

- `target: ES2022`
- `module: ESNext`，`moduleResolution: Bundler`
- `strict: true`
- `noUnusedLocals: true`、`noUnusedParameters: true`、`noFallthroughCasesInSwitch: true`
- `isolatedModules: true`，`noEmit: true`
- `jsx: react-jsx`

### 4.4 `vite.config.ts`

- `server.port = 1421`，`strictPort = true`，`watch.ignored = ["**/src-tauri/**"]`
- `envPrefix = ["VITE_", "TAURI_"]`
- `build.target = "es2022"`，`minify = "esbuild"`

### 4.5 `tauri.conf.json`

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Agent Skill Manager",
  "version": "0.1.0",
  "identifier": "com.agentskillmanager.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1421",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      { "title": "Agent Skill Manager", "width": 1280, "height": 800, "minWidth": 960, "minHeight": 600 }
    ],
    "security": { "csp": null }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

### 4.6 `capabilities/default.json`

```jsonc
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": ["core:default"]
}
```

尚未授予文件系统、shell、dialog、opener 权限。每项权限都随真正需要它的模块一起加入。

## 5. Rust 模块占位

### 5.1 `main.rs`

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { asm_lib::run(); }
```

### 5.2 `lib.rs`

```rust
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

### 5.3 `commands.rs`

只有一个 `ping` 命令，返回 `PingResponse { message: "pong" }`。不含业务逻辑；命令层做的是薄壳。

### 5.4 `modules/errors/mod.rs`

`AsmError { kind: &'static str, message: String }` 与 `AsmResult<T> = Result<T, AsmError>`。`kind` 采用字符串类型，使 IPC 载荷在枚举演进时保持稳定。

### 5.5 `modules/platform/mod.rs`

`pub fn app_data_dir() -> PathBuf`，函数体 `todo!()`。签名先定义，便于 Inventory 模块直接调用而无需后续修改调用点。

### 5.6 `modules/db/mod.rs`、`scanner/mod.rs`、`inventory/mod.rs`

仅包含文件级文档注释，不定义任何符号。这避免了未使用 stub 触发的 `dead_code` 警告，同时为后续实现保留有据可查的结构。

### 5.7 `modules/adapter/mod.rs`

`AgentId(String)` newtype；`DetectionResult { agent, detected }` 占位结构；`AgentAdapter` trait 只有一个必需方法 `fn id(&self) -> AgentId`。`claude_code.rs` 与 `codex.rs` 各定义一个 struct 实现该 trait，确保 trait 能针对真实消费方进行编译检查。

## 6. 前端装配

### 6.1 `src/ipc/types.ts`

```ts
export interface PingResponse {
  message: string;
}
```

### 6.2 `src/ipc/commands.ts`

```ts
import { invoke } from "@tauri-apps/api/core";
import type { PingResponse } from "./types";

export async function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}
```

### 6.3 `src/stores/uiStore.ts`

Zustand store 仅含 `sidebarCollapsed: boolean` 与 `toggleSidebar()`。用于演示 Zustand 接线，不承诺任何尚未设计的状态形态。

### 6.4 `src/App.tsx`

`HashRouter` 配置 6 条路由（`/`、`/library`、`/matrix`、`/agents`、`/history`、`/settings`）。侧边栏通过 `NavLink` 列出。每一页渲染 `<h1>` 与空状态提示 `Run scan to discover agents.`。

### 6.5 `src/routes/Dashboard.tsx`

`useEffect(() => { ping().then(console.log); }, [])`。DevTools console 输出的 `pong` 是脚手架唯一的运行时验证。

### 6.6 `src/styles/global.css`

手写最小化 CSS：app shell 网格布局（240px 侧边栏 + 主内容）、导航 hover/active 状态、页面 padding 与 `.empty-hint` 样式。不引入 CSS 框架。

## 7. README 与文档拆分

当前 `README.md` 被拆为两份：

- **新的 `README.md`**——仅作 onboarding：前置条件、快速开始、命令、目录指引、文档列表。"Status" 一节明确说明项目处于脚手架阶段。
- **新的 `docs/PROJECT_OVERVIEW.md`**——保留当前 `README.md` 中的产品高层概述（问题陈述、核心能力、原则、MVP 路线图、参与贡献）。

这样根目录 README 专注于"如何把工程跑起来"，产品叙述则完整保留在 `docs/` 下。

## 8. `.gitignore` 追加项

```
src-tauri/target/
src-tauri/gen/
dist/
.DS_Store
```

（`node_modules/` 已在现有 `.gitignore` 中覆盖。）

## 9. 验收（必须全部通过才能宣告脚手架完成）

1. `pnpm install` 无错误完成。
2. `pnpm build`（即 `tsc --noEmit && vite build`）无错误完成。
3. `pnpm tauri:dev` 打开标题为 "Agent Skill Manager" 的桌面窗口，含 6 个侧边栏项。
4. 在路由间切换会改变页面标题；console 无错误。
5. Dashboard 页面挂载时在 DevTools console 打印 `pong`。
6. `cd src-tauri && cargo check` 退出码 0。
7. `cd src-tauri && cargo fmt --check` 退出码 0。
8. `cd src-tauri && cargo clippy -- -D warnings` 退出码 0。

## 10. 本脚手架不包含的内容

- Adapter 的 detect/scan 实现。
- Scanner 生命周期（Detect → Discover → Parse → Fingerprint → Analyze → Persist）。
- SQLite schema、迁移或仓库代码。
- 文件监听。
- `core:default` 之外的 Tauri 插件（不包含 `fs`、`shell`、`dialog`、`opener`）。
- ESLint / Prettier / Husky / CI / smoke test。
- Sync 引擎、冲突解决或任何写侧行为。
- 正式品牌资源（图标为模板默认占位；产品标识为字面文字 `ASM`）。

## 11. 风险与待决问题

- **Tauri 2 schema 漂移**。`tauri.conf.json` 与 capabilities 格式在 2.x 系列仍在演进。脚手架阶段固定到模板当时的精确版本，以减少后续 churn。
- **pnpm + Tauri CLI 怪癖**。Tauri CLI 通过 `pnpm tauri ...` 调用。如果底层 CLI 在良性警告上返回非零退出码，脚手架验收会暴露该问题，需要在 README 中记录解决方案。
- **M0 模块边界漂移**。`modules/adapter/mod.rs` 的 trait 表面在第一个 adapter 实现时将扩展。`AgentAdapter` 的后续变更属于预期演进，不是脚手架缺陷。
- **图标资源**。模板图标是占位。替换为品牌资产是另一项刻意推迟的任务。