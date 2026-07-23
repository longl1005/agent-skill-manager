# Discovery Inventory UI（M0）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：**将 Claude Code 的一次扫描结果归一化为内存态 Inventory，并在四个 Discovery 页面中共享、展示真实数据。

**架构：**Rust command 保留原始 `ScanReport` 并构建 `Inventory` 投影；`Platform::current()` 提供真实平台值，adapter 只接收命令栈内的借用。前端新增单一 Zustand scan store，Dashboard 发起扫描，Library、Matrix 与 Agents 消费相同报告。

**技术栈：**Rust、Tauri 2、React 18、TypeScript 5、Zustand 4；不新增依赖。

## 全局约束

- 不引入 SQLite、文件监听、扫描历史、数据库依赖或迁移代码。
- 不实现 Codex adapter，不进行安装、同步、更新、删除或任何 Agent 文件写入。
- 不改变已有 Claude Code 的 Skill 识别和 SHA-256 指纹算法。
- 不得在生产代码中使用 `Box::leak`；所有扫描上下文使用普通借用。
- IPC 继续返回现有 `ScanReport`，不进行推测性的 API 扩展。
- 每项 Rust 行为变更先写失败测试；所有任务结束前运行发布门禁。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src-tauri/src/modules/adapter/mod.rs` | 增加 `Platform::current()`，保持平台枚举集中。 |
| `src-tauri/src/commands.rs` | 使用栈生命周期上下文，保存最新报告及其 Inventory。 |
| `src-tauri/src/modules/inventory/mod.rs` | 从 `ScanReport` 构造只读 Inventory、技能汇总与矩阵状态。 |
| `src/stores/scanStore.ts` | 唯一的前端扫描状态与 `scan()` action。 |
| `src/routes/Dashboard.tsx` | 由共享 store 驱动现有扫描 UI。 |
| `src/routes/Library.tsx` | 展示按名称聚合的 Skills。 |
| `src/routes/AgentMatrix.tsx` | 展示 Skill × Agent 状态矩阵。 |
| `src/routes/Agents.tsx` | 展示每个 Agent 的发现摘要与根目录。 |
| `src/styles/global.css` | 增加上述页面所需的复用样式。 |

## Task 1：修正平台识别与扫描生命周期

**文件：**

- 修改：`src-tauri/src/modules/adapter/mod.rs:46-50`
- 修改：`src-tauri/src/commands.rs:1-180`
- 修改：`src-tauri/src/modules/adapter/claude_code.rs:151-165`
- 测试：`src-tauri/src/modules/adapter/mod.rs` 内 `#[cfg(test)]` 模块

**接口：**

- 产生：`impl Platform { pub fn current() -> Option<Self> }`
- 保持：`AgentAdapter::detect(&DetectContext)` 与 `scan(&ScanContext)` 的借用签名不变。

- [ ] **步骤 1：写出失败的当前平台映射测试**

```rust
#[test]
fn current_platform_matches_compile_target() {
    #[cfg(target_os = "macos")]
    assert_eq!(Platform::current(), Some(Platform::MacOs));
    #[cfg(target_os = "linux")]
    assert_eq!(Platform::current(), Some(Platform::Linux));
    #[cfg(target_os = "windows")]
    assert_eq!(Platform::current(), Some(Platform::Windows));
}
```

- [ ] **步骤 2：验证测试确实失败**

运行：`cargo test --manifest-path src-tauri/Cargo.toml current_platform_matches_compile_target`  
预期：编译失败，提示 `Platform::current` 不存在。

- [ ] **步骤 3：实现最小平台映射**

```rust
impl Platform {
    pub fn current() -> Option<Self> {
        if cfg!(target_os = "macos") { Some(Self::MacOs) }
        else if cfg!(target_os = "linux") { Some(Self::Linux) }
        else if cfg!(target_os = "windows") { Some(Self::Windows) }
        else { None }
    }
}
```

将 command 签名改为 `Result<ScanReport, String>`，以 `let platform = Platform::current().ok_or("unsupported platform")?;` 获取平台。构造 `PlatformContext` 为局部变量并传递 `&platform_ctx`；删除 `Box::leak`。将 `EnumerationInput::root` 与 `entry_filename` 从 `'static` 引用改为普通生命周期引用，随后将 Claude adapter 中 `canonical` 的 `Box::leak` 改为 `&root.canonical_path`。

- [ ] **步骤 4：验证平台测试和现有 adapter 测试通过**

运行：`cargo test --manifest-path src-tauri/Cargo.toml`  
预期：所有测试通过，且 `rg 'Box::leak' src-tauri/src -g '*.rs'` 只命中测试代码；生产模块没有命中。

- [ ] **步骤 5：提交该独立改动**

```bash
git add src-tauri/src/modules/adapter/mod.rs src-tauri/src/commands.rs src-tauri/src/modules/adapter/claude_code.rs src-tauri/src/modules/util/path_scan.rs
git commit -m "fix: remove scan leaks and detect host platform"
```

## Task 2：实现内存态 Inventory 投影

**文件：**

- 修改：`src-tauri/src/lib.rs:4-17`
- 修改：`src-tauri/src/commands.rs:1-180`
- 修改：`src-tauri/src/modules/inventory/mod.rs:1-6`
- 测试：`src-tauri/src/modules/inventory/mod.rs` 内 `#[cfg(test)]` 模块

**接口：**

- 消费：`crate::commands::ScanReport`、`AgentReport`、`SkillReport`。
- 产生：`pub(crate) fn project(report: &ScanReport) -> Inventory`。
- 产生：`Inventory { skills: Vec<InventorySkill>, agents: Vec<InventoryAgent>, matrix: Vec<MatrixCell> }`，其中 `MatrixState = Missing | Present | Conflict | Unknown`。

- [ ] **步骤 1：写出失败的冲突分组测试**

```rust
#[test]
fn project_marks_distinct_fingerprints_for_one_agent_as_conflict() {
    let report = report_with_skills("claude-code", vec![skill("review", "aaa"), skill("review", "bbb")]);
    let inventory = project(&report);
    assert_eq!(inventory.matrix[0].state, MatrixState::Conflict);
    assert_eq!(inventory.skills[0].installation_count, 2);
}

#[test]
fn project_treats_empty_fingerprints_as_unknown_not_conflict() {
    let report = report_with_skills("claude-code", vec![skill("review", ""), skill("review", "")]);
    assert_eq!(project(&report).matrix[0].state, MatrixState::Unknown);
}
```

在测试模块内实现 `skill(name, fingerprint)` 与 `report_with_skills(agent_id, skills)`，创建完整的 command DTO 默认值，使测试只变化名称、agent 和短指纹。

- [ ] **步骤 2：验证测试确实失败**

运行：`cargo test --manifest-path src-tauri/Cargo.toml modules::inventory::tests`  
预期：编译失败，提示 `project`、`MatrixState` 尚不存在。

- [ ] **步骤 3：实现最小投影与状态保存**

在 `lib.rs` 将 `mod commands;` 改为 `pub(crate) mod commands;`，让同 crate 的 Inventory 读取 DTO。定义：

```rust
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum MatrixState { Missing, Present, Conflict, Unknown }

#[derive(Clone, Debug)]
pub(crate) struct InventorySkill {
    pub name: String,
    pub description: String,
    pub installation_count: usize,
    pub agent_ids: Vec<String>,
    pub fingerprints: Vec<String>,
}

#[derive(Clone, Debug)]
pub(crate) struct InventoryAgent {
    pub agent_id: String,
    pub display_name: String,
    pub skill_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MatrixCell {
    pub skill_name: String,
    pub agent_id: String,
    pub state: MatrixState,
}

#[derive(Clone, Debug)]
pub(crate) struct Inventory {
    pub skills: Vec<InventorySkill>,
    pub agents: Vec<InventoryAgent>,
    pub matrix: Vec<MatrixCell>,
}
```

使用 `BTreeMap<String, ...>` 保证 Skills、Agents 和 cells 的稳定顺序。对每个 `(skill_name, agent_id)` 去重非空 `fingerprint_short`：零个为 `Unknown`，一个为 `Present`，多个为 `Conflict`；没有安装的矩阵组合为 `Missing`。`AppState` 增加 `last_inventory: Mutex<Option<Inventory>>`，扫描成功生成报告后以 `inventory::project(&report)` 保存克隆；`Inventory` 和内部 DTO 衍生 `Clone`。

- [ ] **步骤 4：验证投影测试与全套 Rust 测试通过**

运行：`cargo test --manifest-path src-tauri/Cargo.toml`  
预期：Inventory 的 4 个行为（跨 agent 聚合、冲突、空指纹、缺失 cell）和既有测试全部通过。

- [ ] **步骤 5：提交该独立改动**

```bash
git add src-tauri/src/lib.rs src-tauri/src/commands.rs src-tauri/src/modules/inventory/mod.rs
git commit -m "feat: add in-memory discovery inventory"
```

## Task 3：建立共享前端扫描状态

**文件：**

- 新建：`src/stores/scanStore.ts`
- 修改：`src/routes/Dashboard.tsx:1-150`

**接口：**

- 消费：`scanAgents(): Promise<ScanReport>`。
- 产生：`useScanStore`，包含 `report: ScanReport | null`、`scanning: boolean`、`error: string | null`、`scan(): Promise<void>`。
- 供后续任务消费：四个路由从 `useScanStore` 读取状态。

- [ ] **步骤 1：写出 TypeScript 使用契约（先让构建失败）**

将 Dashboard 的 import 替换为：

```ts
import { useScanStore } from "../stores/scanStore";
```

并把本地三个 `useState` 改为：

```ts
const { report, scanning, error, scan } = useScanStore();
```

- [ ] **步骤 2：验证构建失败**

运行：`pnpm build`  
预期：TypeScript 报错，找不到 `../stores/scanStore`。

- [ ] **步骤 3：实现最小共享 store 并接回 Dashboard**

创建：

```ts
import { create } from "zustand";
import { scanAgents } from "../ipc/commands";
import type { ScanReport } from "../ipc/types";

interface ScanState {
  report: ScanReport | null;
  scanning: boolean;
  error: string | null;
  scan: () => Promise<void>;
}

export const useScanStore = create<ScanState>((set) => ({
  report: null,
  scanning: false,
  error: null,
  scan: async () => {
    set({ scanning: true, error: null });
    try { set({ report: await scanAgents() }); }
    catch (error) { set({ error: String(error) }); }
    finally { set({ scanning: false }); }
  },
}));
```

删除 Dashboard 的 `useState` 和本地 `onScan`，让按钮调用 `scan`。保留 `homeFromAgent`、耗时计算和现有展示结构。

- [ ] **步骤 4：验证共享状态的编译契约**

运行：`pnpm build`  
预期：类型检查与 Vite 生产构建通过。

- [ ] **步骤 5：提交该独立改动**

```bash
git add src/stores/scanStore.ts src/routes/Dashboard.tsx
git commit -m "feat: share scan state across routes"
```

## Task 4：完成 Discovery 数据页面

**文件：**

- 修改：`src/routes/Library.tsx:1-8`
- 修改：`src/routes/AgentMatrix.tsx:1-8`
- 修改：`src/routes/Agents.tsx:1-8`
- 修改：`src/styles/global.css`

**接口：**

- 消费：Task 3 的 `useScanStore` 与 `ScanReport` / `AgentReport` / `SkillReport`。
- 产生：不新增 IPC、路由或持久化接口。

- [ ] **步骤 1：写出先失败的路由使用契约**

在三个页面分别加入：

```ts
import { useScanStore } from "../stores/scanStore";
```

并先调用不存在的视图函数：`groupSkills(report)`、`matrixFor(report)`、`agentSummary(agent)`。

- [ ] **步骤 2：验证构建失败**

运行：`pnpm build`  
预期：TypeScript 报错，提示三个视图函数不存在。

- [ ] **步骤 3：实现纯前端视图 helper 与三个页面**

在每个页面顶部定义仅供该页面使用的纯函数。Library 使用以下完整聚合函数：

```ts
function groupSkills(report: ScanReport) {
  const groups = new Map<string, {
    description: string; agents: Set<string>; installations: number; fingerprints: Set<string>;
  }>();
  for (const agent of report.agents) {
    for (const skill of agent.skills) {
      const group = groups.get(skill.name) ?? {
        description: skill.description, agents: new Set<string>(), installations: 0, fingerprints: new Set<string>(),
      };
      group.agents.add(agent.agent_id);
      group.installations += 1;
      if (skill.fingerprint_short) group.fingerprints.add(skill.fingerprint_short);
      if (!group.description && skill.description) group.description = skill.description;
      groups.set(skill.name, group);
    }
  }
  return [...groups.entries()].map(([name, group]) => ({ name, ...group }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function matrixFor(report: ScanReport) {
  return groupSkills(report).map((skill) => ({
    name: skill.name,
    cells: report.agents.map((agent) => {
      const matches = agent.skills.filter((candidate) => candidate.name === skill.name);
      const fingerprints = new Set(matches.map((candidate) => candidate.fingerprint_short).filter(Boolean));
      const state = matches.length === 0 ? "missing" : fingerprints.size === 0 ? "unknown"
        : fingerprints.size === 1 ? "present" : "conflict";
      return { agentId: agent.agent_id, state };
    }),
  }));
}

function agentSummary(agent: AgentReport) {
  return { roots: agent.roots.length, skills: agent.skills.length, issues: agent.issues.length };
}
```

三个页面共同遵循：`report === null` 时显示“Run scan to discover agents.”；`scanning && report === null` 时显示 “Scanning...” ；报告存在但相应列表为空时显示明确空状态。

- Library：表格列为 Name、Description、Agents、Installations、Status；状态根据非空短指纹集合为 `Consistent`、`Conflict`、`Unknown`。
- Matrix：列头来自 `report.agents`；每行一个 Skill；使用 `—`、`✓`、`!`、`?` 显示四种 cell 状态并加 `aria-label`。
- Agents：卡片显示名称、`detection_status · outcome`、计数和 `roots` 的 scope/path 列表。
- CSS：为 `.inventory-table`、`.matrix-table`、`.agent-card`、`.status-badge` 与 `.matrix-cell` 添加与现有 CSS 变量一致的紧凑桌面样式；不改动 App 路由或导航。

- [ ] **步骤 4：验证页面构建和手工行为**

运行：`pnpm build`  
预期：类型检查和生产构建通过。

运行：`pnpm tauri:dev`  
预期：扫描一次后，切换 Dashboard、Library、Agent Matrix、Agents 不会再次扫描；四处显示相同的总数与数据。

- [ ] **步骤 5：提交该独立改动**

```bash
git add src/routes/Library.tsx src/routes/AgentMatrix.tsx src/routes/Agents.tsx src/styles/global.css
git commit -m "feat: render discovery inventory views"
```

## Task 5：执行发布门禁

**文件：**

- 修改：仅在检查发现格式或 lint 问题时，修改对应文件。

**接口：**

- 消费：Task 1-4 的完整实现。
- 产生：可交付的 Discovery MVP 闭环。

- [ ] **步骤 1：运行前端生产构建**

运行：`pnpm build`  
预期：`tsc --noEmit && vite build` 退出码为 0。

- [ ] **步骤 2：运行 Rust 全量测试**

运行：`cargo test --manifest-path src-tauri/Cargo.toml`  
预期：所有单元测试通过，0 failed。

- [ ] **步骤 3：运行 Rust 格式与 lint**

运行：

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

预期：两个命令退出码均为 0；若 `fmt --check` 失败，运行 `cargo fmt --manifest-path src-tauri/Cargo.toml` 后重新执行全部门禁。

- [ ] **步骤 4：确认最终差异并提交门禁修复（如有）**

运行：`git diff --check && git status --short`  
预期：无空白错误；仅保留本计划范围内的文件。若本任务为了格式化而产生修改：

```bash
git add <formatted-files>
git commit -m "chore: verify discovery inventory MVP"
```
