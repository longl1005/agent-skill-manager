# Discovery Inventory UI（M0）设计

**日期：**2026-07-22  
**状态：**设计已确认，等待书面 Spec 审阅  
**范围：**完成可用的内存态发现闭环：扫描一次 Claude Code Skills，并在 Dashboard、Library、Agent Matrix 和 Agents 中展示同一份归一化结果。

## 目标

在不引入持久化、写操作或新的 Agent adapter 的前提下，将现有的单页面扫描演示升级为完整的 Discovery MVP。

## 边界

本次包含：

- 根据运行/编译目标解析宿主平台，不再默认 macOS。
- 移除生产扫描路径中的全部 `Box::leak`。
- 将扫描报告归一化为只读的内存态 Inventory。
- 通过前端 store 共享最新扫描报告。
- 在 Dashboard、Library、Agent Matrix 和 Agents 中展示真实数据。

本次不包含：

- SQLite、扫描历史、文件监听、迁移代码或数据库依赖。
- Codex adapter 实现、同步计划、安装、更新、删除，或任何针对 Agent 所有文件的写入。
- 修改已有 Claude Code adapter 已测试覆盖的 Skill 识别和指纹算法。

## 架构

Rust command 仍是调用已注册 adapter 的边界。它持有短生命周期的 `PlatformContext`、根目录和扫描上下文，并向 adapter 方法传递普通借用。`Platform::current()` 使用 `cfg!(target_os)` 映射到 `MacOs`、`Linux` 或 `Windows`；不支持的平台返回明确的 command 错误，而不是伪造平台值。

`modules::inventory` 新增纯内存投影函数。它消费 `ScanReport`，生成包含 Skills、Agents 和 Matrix cells 的归一化 Inventory。command 仅在 `last_report` 中保存最新的原始报告，不赋予其数据库语义。Tauri 仍返回 `ScanReport`，以保持 IPC 契约精简并兼容现有 Dashboard。

前端使用 Zustand scan store，状态为 `{ report, scanning, error, scan() }`。App shell 下的所有路由共享该 store。页面不再直接调用 Tauri：Dashboard 触发 `scan()`，四个数据页面读取同一份 `report`，并展示一致的空、加载与错误状态。

## 领域投影

后端 Inventory 投影产生：

| 视图 | 标识 | 内容 |
| --- | --- | --- |
| Skill | 精确的 `SkillReport.name` | 名称、描述、安装记录、去重后的 Agents、去重后的指纹 |
| Agent | `AgentReport.agent_id` | 检测状态、根目录、Skills、Issues、结果状态 |
| Matrix cell | `(skill name, agent id)` | `Missing`、`Present` 或 `Conflict` |

`Present` 表示同一个 agent/skill 对恰好有一个指纹。`Conflict` 表示同一个 agent/skill 对存在多个不同且非空的指纹，用于预判用户级和项目级副本不一致。缺失指纹显示为 `Unknown` 元数据，而不视为冲突。此阶段以相同名称为明确分组键，跨名称的语义匹配后置。

前端可以从 `ScanReport` 推导等价的展示数据，但 Rust 持有规范化投影并测试分组规则。IPC 响应在页面确实需要原始报告无法提供的聚合字段前不扩展。

## 页面行为

### Dashboard

保留现有的扫描按钮、耗时、Agent 分区、Skills 表格和 Issues 列表。将本地组件状态替换为共享 store，使用户离开并返回页面时仍能看到扫描结果。

### Library

每个 Skill 名称对应一行。每行展示描述、Agent 数量、安装数量和状态：`Consistent`、`Conflict` 或 `Unknown`。本次不增加行选择、详情路由或详情页。

### Agent Matrix

以 Skill 名称为行、检测到的 Agents 为列展示表格。单元格分别显示 `—`（缺失）、`✓`（存在）和 `!`（冲突）。首次扫描前显示扫描提示；扫描完成但未发现 Skill 时，明确显示“未发现 Skills”。

### Agents

每个已注册/扫描 Agent 显示一张卡片：显示名称、检测状态、结果状态、根目录数量、Skill 数量和 Issue 数量。可展开详情不在本次范围内；根目录直接列在卡片下方。

## 错误与空状态

- command 调用失败时设置一个共享错误消息，已有扫描数据仍保留展示。
- Agent 不可用的扫描仍是成功的发现结果，应展示该 adapter 的 Issues，而不是作为前端异常。
- 首次扫描前，每个数据页面都提示用户执行扫描。
- 扫描期间，Dashboard 禁用按钮；所有数据页面保留上次报告，若没有报告则显示加载提示。

## 测试与验收

Rust 单元测试覆盖：

1. 当前编译平台的宿主平台映射。
2. 跨两个 Agents 的 Inventory 分组。
3. 同一 Agent 中同名但指纹不同的副本产生 `Conflict`。
4. 空指纹不会误判为冲突。

前端类型检查和生产构建必须通过。发布门禁为：

```bash
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

手工验收：执行一次扫描后，在 Dashboard、Library、Agent Matrix 和 Agents 之间切换，四个页面展示同一份扫描时间戳及由数据推导的数量，且不再次触发扫描。

## 决策

- 采用推荐的内存态优先方案；持久化作为独立里程碑处理。
- 本次不引入通用异步 scanner。现有 adapter 扫描快速且同步，前端 `scanning` 状态可防止重复调用。
- 本次不增加任何依赖。
- 维持原始 `ScanReport` IPC 字段，避免过早重构 API。
