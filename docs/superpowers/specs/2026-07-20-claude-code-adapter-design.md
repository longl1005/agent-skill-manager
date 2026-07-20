# Claude Code Adapter (M0 Discovery) Design

**日期**：2026-07-20
**状态**：已批准（等待用户对书面 spec 的最终审阅）
**范围**：在已落地的脚手架上，实现 Claude Code Agent Adapter（detect + scan），并在 Dashboard 上能看到本地 Skill 清单。
**不在范围**：Codex adapter、SQLite 持久化、Inventory reconciliation、Analyzer 派生 status、File Watcher、Sync Engine 任何形式、UI Matrix / Library / Agents / Settings 页的真实数据流（仍为占位）。

## 1. 目标

1. 实现 `AgentAdapter` trait 的 6 个方法（`id` / `descriptor` / `capabilities` / `detect` / `skill_roots` / `scan`），让 ClaudeCodeAdapter 不再是空 struct。
2. 引入共用 util 模块（frontmatter / fingerprint / path_scan），按 spec §3 "Adapters own agent differences" 隔离 Claude Code 特定逻辑。
3. 添加 Tauri 命令 `scan_agents`，调用 ClaudeCodeAdapter 扫描本地 Skill 根（user + project），把结果以 `ScanReport` 形式返回前端。
4. Dashboard 加 "Scan now" 按钮 + 扫描状态 + 表格 + Issues 区域，渲染扫描结果。
5. 关键路径单测覆盖解析、指纹、枚举、detect、scan。
6. 8 条验收全部通过（见第 9 节）。

## 2. 思路

按 brainstorming 决策：
- **方案 2 架构**：ClaudeCodeAdapter 通过 `modules/util/{frontmatter,fingerprint,path_scan}.rs` 调用共享 helper，避免 Codex adapter 未来复制粘贴。
- **数据存储** 纯内存：`tauri::State<Mutex<Option<ScanReport>>>`，重启即丢。
- **触发方式** 手动：UI 按钮。
- **YAML 解析** 用 `serde_yml`（`serde_yaml` 的活跃 fork）。
- **Content fingerprint** SHA-256 over sorted manifest，覆盖 SKILL.md + 子目录下 `md` / `txt` / `json` / `yaml` / `yml`，排除 `.DS_Store` 与图片/二进制。
- **Skills 根** 包含 user-scope（`$HOME/.claude/skills`）与 project-scope（从 cwd 向上最多 5 层找 `.claude/skills`）。
- **Platform 解析** 用 `dirs` crate。
- **测试** 关键路径单测 22 个。
- **错误呈现** 成功安装与 issues 分区显示。
- **Tauri 命令** 单一同步 `scan_agents`，UI 端按钮 disable during scan（10-50ms 级别）。

## 3. 新增文件结构

```
src-tauri/
├── Cargo.toml                              # + dirs / serde_yml / sha2 / walkdir / uuid
└── src/
    ├── lib.rs                              # + mod util; manage(AppState::default())
    ├── commands.rs                         # + ScanReport DTOs + scan_agents 命令
    └── modules/
        ├── adapter/
        │   ├── mod.rs                      # trait 扩到 6 方法 + 共享 DTO
        │   ├── claude_code.rs              # 重写为真实实现
        │   └── codex.rs                    # 保持占位
        ├── platform/
        │   └── mod.rs                      # 加 user_home_dir (dirs crate)
        └── util/                           # ★ 新建
            ├── mod.rs
            ├── frontmatter.rs
            ├── fingerprint.rs
            └── path_scan.rs

src/
├── ipc/
│   ├── types.ts                            # + ScanReport / SkillReport / IssueReport
│   └── commands.ts                         # + scanAgents()
├── routes/
│   └── Dashboard.tsx                       # 替换 ping useEffect 为 scan, 渲染表格
└── styles/
    └── global.css                          # + .scan-status / .skills-table / .btn 等
```

## 4. 依赖（更新脚手架 spec §4.2）

| Crate | Version | 用途 |
| --- | --- | --- |
| `tauri` | ^2.0 | 桌面壳（已有） |
| `tauri-build` | ^2.0 | 构建脚本（已有） |
| `serde` | ^1 (+ derive) | 序列化（已有） |
| `serde_json` | ^1 | JSON 互转（已有） |
| `thiserror` | ^1 | 错误类型（已有） |
| `dirs` | 5 | home_dir / config_dir 跨平台解析 |
| `serde_yml` | 0.0.12 | YAML frontmatter 解析（serde_yaml 的活跃 fork） |
| `sha2` | 0.10 | SHA-256 |
| `walkdir` | 2 | 目录遍历（默认不 follow symlinks） |
| `uuid` | 1 (+ v4) | ScanId 唯一标识 |

**移除原脚手架 spec §4.2 "故意推迟" 列表中**：`dirs` / `serde_yml` / `sha2` / `walkdir` / `uuid` 都从推迟改为引入（仅 M0 这一处）。`rusqlite` / `notify` / `tokio` / `clap` 继续推迟。

## 5. Adapter trait 与共享 DTO

```rust
// modules/adapter/mod.rs
pub trait AgentAdapter {
    fn id(&self) -> AgentId;
    fn descriptor(&self) -> AgentDescriptor;
    fn capabilities(&self) -> CapabilitySet;
    fn detect(&self, ctx: &DetectContext) -> DetectionResult;
    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot>;
    fn scan(&self, ctx: &ScanContext) -> ScanResult;
}
```

### 共享 DTO

| 类型 | 字段 | 来源 |
| --- | --- | --- |
| `AgentId(String)` | `id: String` | 已有 |
| `AgentDescriptor` | `agent_id, adapter_id ("claude-code@1"), display_name, supported_platforms, documentation_url, adapter_version` | spec §4.1 |
| `Platform` | `MacOs \| Linux \| Windows` | spec §6 |
| `CapabilitySet` | `detect, scan, compare_content, watch, install_planning, uninstall_planning, update_planning, sync_planning, supported_platforms, notes` | spec §4.2，所有 write 类操作保持 `Unsupported` |
| `SupportLevel` | `Unsupported \| Planned \| Supported` | spec §4.2 |
| `CompareConfidence` | `None \| Partial \| Reliable` | spec §4.2 |
| `DetectContext` | `platform: &PlatformContext` | spec §4.3 简化版 |
| `PlatformContext` | `platform, home_dir, cwd` | spec §6 |
| `SkillRoot` | `root_id, display_path, canonical_path, scope` | spec §4 |
| `RootScope` | `User \| Project \| Custom` | spec §4 |
| `DetectionResult` | `agent, status, roots, issues, observed_at` | spec §4.6 |
| `DetectionStatus` | `Detected \| Unavailable \| Partial \| Unsupported \| Failed` | spec §4.6 |
| `ScanContext` | `scan_id, agent, roots, platform, started_at` | spec §4.3 简化（`readPolicy` 不暴露，无人调用写） |
| `ScanId(Uuid)` | `0: Uuid` | spec §4 |
| `SkillInstallation` | `agent_id, adapter_id, root_id, location, format, identity, entry, metadata, content_fingerprint, comparison_confidence, observed_at, diagnostics` | spec §4.4 |
| `LocationDescriptor` | `display_path, canonical_path` | spec §6.4 |
| `SkillFormatDescriptor` | `id ("claude-code-skill"), display_name ("Claude Code Skill"), entry_file ("SKILL.md")` | spec §4 |
| `SkillIdentityEvidence` | `normalized_name, declared_name, source` | spec §7.1 |
| `IdentitySource` | `FrontmatterName \| DirectoryName` | spec §7.1 |
| `EntryDescriptor` | `path, size, modified` | spec §4 |
| `NormalizedSkillMetadata` | `name, description, license, raw_metadata: Option<serde_json::Value>` | spec §4 |
| `ContentFingerprint` | `algorithm: "sha256", version: 1, scope: "ComparableEntry", digest, file_count` | spec §7.2 |
| `ScanIssue` | `code, severity, phase, path, message, recoverable` | spec §4.5 |
| `IssueSeverity` | `Info \| Warning \| Error` | spec §4.5 |
| `IssuePhase` | `Detect \| RootResolution \| Enumeration \| Read \| Parse \| Fingerprint` | spec §4.5 |
| `ScanResult` | `scan_id, agent_id, outcome, completeness, installations, issues, started_at, completed_at` | spec §4.6 |
| `ScanOutcome` | `Completed \| CompletedWithIssues \| Partial \| Failed \| Cancelled` | spec §4.6 |
| `ScanCompleteness` | `Complete \| Partial \| Unknown` | spec §4.6 |

**关键设计选择**：

- `AgentDescriptor::adapter_id` 用 `"claude-code@1"` 格式（实现版本号），spec §4.1 允许；未来多版本并存时区分。
- `SkillRoot` 与 `LocationDescriptor` 都分离 `display_path` / `canonical_path`（spec §6.4）。
- `ContentFingerprint::version = 1`：算法变更时递增。
- 所有时间用 `SystemTime`（非 `Instant`），便于序列化。
- 13 个新结构体、4 个新 enum，全部在 `modules/adapter/mod.rs` 顶层定义（不分散到子文件——M0 阶段单文件读懂最重）。

## 6. Util 模块

### 6.1 `modules/util/frontmatter.rs`

```rust
pub struct ParsedFrontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub license: Option<String>,
    pub raw: Option<serde_json::Value>,    // 保留 metadata 块原值
}

pub fn parse_frontmatter(text: &str) -> Result<ParsedFrontmatter, FrontmatterError>;

pub enum FrontmatterError {
    MissingDelimiters,
    EmptyBody,
    YamlParse(String),
}
```

**策略**：
1. 找第一个 trim 后正好 3 dash 的行作为起始 `---`。
2. 找下一个 `---` 作为结束。
3. 中间内容交给 `serde_yml::from_str::<serde_json::Value>`。
4. 从 Value 抽 `name` / `description` / `license` 三个标量；其他字段进 `raw`。

**为什么不直接 deserialize 到 `NormalizedSkillMetadata`**：SKILL.md frontmatter 是开放集（用户可加自定义 `metadata` 块），用 `serde_json::Value` 兜底比 strict deserialize 更鲁棒，符合 spec §7.1 "trusted declared name plus format and adapter context"——只信任 3 个已知字段。

### 6.2 `modules/util/fingerprint.rs`

```rust
pub struct FingerprintInput {
    pub root: PathBuf,
    pub comparable_extensions: &'static [&'static str],  // 默认 ["md","txt","json","yaml","yml"]
    pub exclude_names: &'static [&'static str],           // [".DS_Store"]
}

pub fn compute_fingerprint(input: &FingerprintInput)
    -> Result<ContentFingerprint, FingerprintError>;
```

**策略**（spec §7.2）：
1. `walkdir::WalkDir::new(root).follow_links(false)` 枚举。
2. 过滤：常规文件 + 后缀在 `comparable_extensions` + 文件名不在 `exclude_names`。
3. 收集 `(relative_path_str, file_size, sha256_hex)` 三元组，**按 relative_path 字符串排序**（保证确定性）。
4. 拼 manifest：`"<rel>\0<size>\0<sha256_hex>\n"` for each entry。
5. 最终 `sha256(manifest_string)` 作为 digest。

**确定性**（单测必覆盖）：同一目录调两次同 digest；改文件名 / 改内容 → digest 变。

### 6.3 `modules/util/path_scan.rs`

```rust
pub struct SkillCandidate {
    pub dir: PathBuf,
    pub entry_file: PathBuf,
    pub entry_size: u64,
    pub entry_modified: SystemTime,
}

pub struct EnumerationInput {
    pub root: &Path,
    pub entry_filename: &'static str,         // "SKILL.md"
    pub skip_hidden: bool,                    // 默认 true
    pub max_depth: usize,                     // 默认 1
}

pub fn enumerate_skill_dirs(input: &EnumerationInput)
    -> (Vec<SkillCandidate>, Vec<ScanIssue>);
```

**策略**：
1. `read_dir(root)` 列第一层。
2. 跳过以 `.` 开头的（隐藏目录）。
3. 每个 entry：`symlink_metadata()` 必须是 dir；不是 symlink（spec §6.5）；不是隐藏。
4. 检查 `<dir>/<entry_filename>` 存在且可读。
5. 返回 `(candidates, issues)`：candidates 是合格的；issues 记录被跳过的原因。
6. 单个目录错误不阻断其他（spec §5.2 "continue scanning sibling roots"）。

## 7. ClaudeCodeAdapter 真实实现

```rust
// modules/adapter/claude_code.rs
const ADAPTER_VERSION: &str = "0.1.0";
const ENTRY_FILENAME: &str = "SKILL.md";
const PROJECT_SEARCH_DEPTH: usize = 5;
const COMPARABLE_EXTS: &[&str] = &["md","txt","json","yaml","yml"];
const EXCLUDE_NAMES: &[&str] = &[".DS_Store"];
```

### detect 策略

1. `platform::user_home_dir(ctx.platform)`（用 `dirs::home_dir()`，None → `Failed` + 1 Error issue）。
2. 用户根 = `home/.claude/skills`，`symlink_metadata().is_dir()` 检查。
3. 项目根 = `find_project_skill_root(ctx.platform.cwd)`：从 cwd 向上，深度 ≤ 5，每层检查 `<dir>/.claude/skills/`。
4. **状态规则**：
   - `home_dir = None` → `Failed`，1 Error issue
   - 都不存在 → `Unavailable`，1 Info issue
   - 只有一边 → `Detected`，1 root
   - 两边都有 → `Detected`，2 roots
5. `observed_at = SystemTime::now()`

### skill_roots 策略

直接返回 detect 阶段找到的所有 root，每个标 User / Project scope。**不重新做路径发现**——UI 不应有机会注入任意路径。

### scan 策略

```
for each root in ctx.roots:
    1. enumerate_skill_dirs(root, ENTRY_FILENAME) → (candidates, enum_issues)
    2. for each candidate:
        a. read SKILL.md bytes
        b. parse_frontmatter(text) → ParsedFrontmatter
        c. normalize name = frontmatter.name ?? dir_name (case-preserved)
        d. compute_fingerprint(skill_dir) → ContentFingerprint
        e. 构造 SkillInstallation, push
    3. 错误候选不 push installation, 而 push 1 条 ScanIssue (severity=Warning)

排序: 先按 root_id 字典序, 再按 skill dir_name 字典序
```

**outcome 判定**：
- 全无 root → `Failed` + 1 Error issue
- 所有 root 都没找到 candidate → `Completed`（空清单合法）
- 部分 candidate 出错 → `CompletedWithIssues`
- 致命 IO 错误 → `Partial`

**determinism**（单测必覆盖）：同文件系统状态、context 调两次结果一致；installation 顺序固定。

## 8. Tauri 命令 + 内存状态

### 8.1 `commands.rs` 新增

```rust
#[derive(Serialize)]
pub struct ScanReport {
    pub scan_id: String,
    pub started_at: u64,           // unix millis
    pub completed_at: u64,
    pub agents: Vec<AgentReport>,
    pub total_skills: usize,
    pub total_issues: usize,
}

#[derive(Serialize)]
pub struct AgentReport {
    pub agent_id: String,
    pub display_name: String,
    pub detection_status: String,
    pub roots: Vec<RootReport>,
    pub skills: Vec<SkillReport>,
    pub issues: Vec<IssueReport>,
    pub outcome: String,
}

#[derive(Serialize)] pub struct RootReport { pub root_id, scope, display_path }
#[derive(Serialize)] pub struct SkillReport {
    pub name, description, license?, location, fingerprint_short, file_count,
    pub issues: Vec<IssueReport>,
}
#[derive(Serialize)] pub struct IssueReport {
    pub code, severity, phase, path?, message,
}

#[tauri::command]
pub fn scan_agents(state: tauri::State<'_, AppState>) -> ScanReport {
    // 1. PlatformContext { home: dirs::home_dir(), cwd: std::env::current_dir() }
    // 2. 对每个 [ClaudeCodeAdapter].iter(): detect + skill_roots + scan
    //    CodexAdapter 暂未注册 (M0 范围外)
    // 3. 拼 ScanReport
    // 4. state.last_report = Some(report.clone())
    // 5. return report
}
```

### 8.2 `AppState`（`lib.rs`）

```rust
#[derive(Default)]
pub struct AppState {
    pub last_report: Mutex<Option<ScanReport>>,
}
// Builder::default().manage(AppState::default()).invoke_handler(...)
```

### 8.3 Frontend

```ts
// src/ipc/types.ts 新增
export interface ScanReport { scan_id: string; ... }
export interface SkillReport { name: string; description: string; ... }
export interface IssueReport { code: string; severity: string; ... }

// src/ipc/commands.ts 新增
export async function scanAgents(): Promise<ScanReport> {
  return invoke<ScanReport>("scan_agents");
}
```

**并发模型**：scan 整段同步运行，主线程占 10-50ms（76 个 Skill 估算）；UI 端按钮 disable during scan。**不**做 Rust 端并发；不 emit 进度事件。

## 9. Dashboard 渲染

```
┌─ 顶部 ─────────────────────────────────────────────────┐
│  Dashboard    76 skills · 1 agent · scanned 14:23:01    │ ← status row
│  [Scan now]   [Last scan: 23ms ago]                     │ ← action row
├─ 表格 ──────────────────────────────────────────────────┤
│ Name             Description           Path        Files  FP    │
│ angular-architect  Use when building...  ~/.claude   6    a3f2.. │
│ api-designer     ...                    ...        3    b1c4.. │
│ ...                                                       │
├─ Issues ────────────────────────────────────────────────┤
│ ⚠ Warning  EntryMissing  ~/.claude/skills/foo/         │
└─────────────────────────────────────────────────────────┘
```

**状态机**：
- 初始：`report = null`，显示 "Run scan to discover agents."
- 点 Scan：`scanning = true`，按钮 disable + "Scanning..."，表格区域 placeholder
- 成功：`report` 替换；渲染 status row + 表格 + issues
- 失败：红字 `scan-error` 显示，**不**清空旧 report
- 长路径截断：把 `$HOME` 替换为 `~`（用 `Path::starts_with` 比对）

**CSS 新增**（`src/styles/global.css`）：`.scan-status` / `.skills-table` / `.btn` / `.btn.primary` / `.scan-error` / `.issue-row` / `.issue-row .severity.warning` / `.issue-row .severity.error`。Issue 按 Error > Warning > Info 排序。

## 10. 关键路径单测（22 个）

| 测试 | 文件 | 验证 |
| --- | --- | --- |
| `parse_frontmatter_basic` | `util/frontmatter.rs` | 标准 frontmatter 解析 |
| `parse_frontmatter_missing_delim` | 同上 | 无 `---` → MissingDelimiters |
| `parse_frontmatter_yaml_error` | 同上 | 坏语法 → YamlParse 带 msg |
| `parse_frontmatter_extra_fields` | 同上 | `custom: x` 进 raw 不报错 |
| `fingerprint_deterministic` | `util/fingerprint.rs` | 同一目录调两次同 digest |
| `fingerprint_changes_on_rename` | 同上 | 改文件名 digest 变 |
| `fingerprint_changes_on_content` | 同上 | 改内容 digest 变 |
| `fingerprint_excludes_hidden` | 同上 | `.DS_Store` 不参与 |
| `fingerprint_skips_symlink` | 同上 | symlink 不 follow |
| `fingerprint_skips_png` | 同上 | `.png` 排除 |
| `enumerate_skips_dotfiles` | `util/path_scan.rs` | `.foo/` 不入选 |
| `enumerate_requires_skill_md` | 同上 | 缺 SKILL.md → issue 记录 |
| `enumerate_handles_permission_error` | 同上 | 不可读目录 → issue 不 panic |
| `claude_detect_no_home` | `adapter/claude_code.rs` | `dirs::home_dir()=None` → Failed |
| `claude_detect_only_user` | 同上 | 仅 user 根 → Detected + 1 root |
| `claude_detect_user_and_project` | 同上 | 都有 → Detected + 2 roots |
| `claude_detect_neither` | 同上 | 都没有 → Unavailable |
| `claude_scan_empty_root` | 同上 | 根存在但空 → Completed + 0 installation |
| `claude_scan_normalizes_name` | 同上 | frontmatter name 优先于 dir name |
| `claude_scan_uses_dir_name_fallback` | 同上 | 无 frontmatter → 用目录名 |
| `claude_scan_sorts_deterministically` | 同上 | 两调用同结果 |
| `claude_scan_collects_issues` | 同上 | 损坏的 SKILL.md → Warning issue |

**集成测试不做**（已确认关键路径单测 + 手动 dev 验证）。

## 11. 验收（必须全部通过）

1. `cargo fmt --check` 退出码 0
2. `cargo clippy -- -D warnings` 退出码 0
3. `cargo test` 22 个测试全部通过
4. `pnpm build`（tsc + vite）退出码 0
5. `pnpm tauri:dev` 启动后 Dashboard 出现 "Scan now" 按钮
6. 点 Scan 后，76 个 Skill 出现在表格（与 `ls ~/.claude/skills/ | wc -l` 一致）
7. 表格 fingerprint 前 8 hex：在未改文件的前提下对同一 Skill 目录重新 `compute_fingerprint` 必须得到相同前 8 hex（manifest sha256 算法的等价复现）
8. 重启应用后 `report = null`（纯内存，无持久化）

## 12. 风险与待决

- **Tauri 命令阻塞 UI**：scan 期间主线程占 10-50ms（76 个 Skill 估算）。UI 按钮 disable during scan 可接受。**未来 1000+ Skills 时再考虑异步 + 进度事件**。
- **`serde_yml` 0.0.12 维护活跃度**：它是 `serde_yaml` 的社区 fork，目前 GitHub 仍有 commit。如 M0 实施发现 bug，可手写 frontmatter parser 替换（M0 后）。
- **macOS TCC 权限**：`~/.claude/skills/` 首次访问可能弹 TCC 权限框。用户需手动授权。M0 阶段若弹窗，记录到 README。
- **`scan_agents` 不接参数**：M0 只扫全部。M1+ 再加 `agent_id_filter` 或 `root_filter`。
- **`AppState` 用 `Mutex<Option<ScanReport>>` 而非 `RwLock`**：scan 是短临界区，Mutex 简单且无饥饿风险。`scan_agents` 命令在临界区内只做 write，其他命令（ping）不读 ScanReport。
- **不引入 `tauri::async_runtime`**：scan 同步足够，不引入 tokio 到 M0。

## 13. 不在本 spec 范围

- Codex adapter 任何形式
- SQLite / Inventory / Analyzer / File Watcher / Sync Engine
- Library / AgentMatrix / Agents / Settings / ScanHistory 路由的真实数据流（仍为占位）
- 异步 scan + 进度事件
- 路径规范化差异（symlink 跟随策略、case sensitivity）— 仅按 spec §6.5 不 follow symlink
- 多 `AgentAdapter` 动态注册表（仅静态 `&[ClaudeCodeAdapter]`）

## 14. 验收后自动重读的 spec

实施完成后，必须更新 [docs/superpowers/specs/2026-07-20-asm-scaffold-design.md](../specs/2026-07-20-asm-scaffold-design.md) 的 §4.2，把 `dirs` / `serde_yml` / `sha2` / `walkdir` / `uuid` 从"故意推迟"列表移到"已引入"列表——脚手架 spec 的依赖白名单需要后续 M0 spec 主动覆盖。
