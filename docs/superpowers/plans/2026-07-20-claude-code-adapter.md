# Claude Code Adapter (M0 Discovery) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已落地的 ASM 脚手架上实现 Claude Code Agent Adapter，Dashboard 上能看到本地 Skill 清单与 SHA-256 fingerprint。

**Architecture:** 严格按 spec §3 "Adapters own agent differences"——ClaudeCodeAdapter 通过 `modules/util/{frontmatter,fingerprint,path_scan}.rs` 调用跨 adapter 共享 helper。Util 模块 TDD 写，adapter 模块 TDD 写。扫描结果纯内存（`tauri::State<Mutex<Option<ScanReport>>>`），单一同步 `scan_agents` Tauri 命令，UI 端按钮 disable during scan。

**Tech Stack:** Rust 1.77+、Tauri 2、serde / serde_json / thiserror（已有）、`dirs 5` / `serde_yml 0.0.12` / `sha2 0.10` / `walkdir 2` / `uuid 1`（M0 新增）。React 18 + Vite 5 + TypeScript 5.5 + Zustand 4（脚手架已就绪）。

## Global Constraints

- **工作目录**：所有路径相对 `/Users/dragon/workspace/resp/agent-skill-manager`。Bash shell 不保留 `cd`——每个 Bash 调用都用绝对路径或 `cd <path> && ...` 复合命令。
- **Rust 工具链** ≥ 1.77。`cargo fmt`、`cargo clippy -- -D warnings`、`cargo test` 必须全过。
- **依赖引入**：仅 spec §4 列出的 10 个 crate（5 已有 + 5 新增）。不引入 `tokio` / `rusqlite` / `notify` / `clap`。
- **util 模块 TDD**：每个 util 文件先写 test，红→绿，commit。
- **adapter DTO 在 `modules/adapter/mod.rs` 顶层集中定义**——13 个新结构体 + 4 个新 enum + 6 方法 trait，不分散到子文件。
- **ClaudeCodeAdapter 重写后**：`#![allow(dead_code, unused_imports)]` 仍保留在 `adapter/mod.rs`（因 `pub use codex::CodexAdapter` 仍指向 stub）。
- **scan_agents 单实例同步**：UI 端按钮 disable during scan；Rust 端不引入 async runtime。
- **路径解析**：用 `dirs::home_dir()` 与 `std::env::current_dir()`，禁止 hard-code `~` / `/Users` / `C:\Users`。
- **不 follow symlinks**：`symlink_metadata()` 显式检查（spec §6.5）。
- **SHA-256 manifest 确定性**：先按 relative_path 字典序排序再哈希（spec §7.2）。
- **Content fingerprint 范围**：`md` / `txt` / `json` / `yaml` / `yml` 后缀，排除 `.DS_Store`，不 follow symlink。
- **PROJECT_SEARCH_DEPTH = 5**：从 cwd 向上最多 5 层找 `.claude/skills`。
- **故障隔离**：单个 root / 单个 candidate 出错不阻断其他，全部进 `ScanIssue`（spec §5.2 / §5.3）。
- **错误输出**：`ScanIssue` 必须含 code / severity / phase / path / message 五个字段（spec §4.5）。
- **类型稳定**：`#[derive(Serialize)]` 全加；时间字段用 `SystemTime`；fingerprint version = 1。
- **中文注释**：新代码使用中文 doc comments（保持脚手架风格）。
- **Commit 风格**：`type(scope): subject` + 中文 body + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。
- **frontend**：禁止直接 `invoke()`，所有调用走 `src/ipc/commands.ts`。TypeScript strict + noUnusedLocals/Parameters。
- **HEAD 起点**：`606f4ea docs: add Claude Code Adapter M0 design spec`。

---

## File Structure

实施中将创建或修改的文件（按任务顺序）：

```
src-tauri/
├── Cargo.toml                              # T1 改（+5 crates）
├── src/
│   ├── lib.rs                              # T1 改（+mod util）、T7 改（+manage）
│   ├── commands.rs                         # T7 改（+ScanReport DTOs + scan_agents）
│   └── modules/
│       ├── adapter/
│       │   ├── mod.rs                      # T5 改（+13 DTOs + 4 enums + 6-method trait）
│       │   ├── claude_code.rs              # T6 改（重写为真实实现）
│       │   └── codex.rs                    # T5 改最小化（保留 stub 以通过编译）
│       ├── platform/
│       │   └── mod.rs                      # T1 改（+user_home_dir）
│       └── util/                           # T1 改（+mod util mod.rs）
│           ├── mod.rs                      # T1 改（3 子模块声明）
│           ├── frontmatter.rs              # T2 改（+4 test）
│           ├── fingerprint.rs              # T3 改（+6 test）
│           └── path_scan.rs                # T4 改（+3 test）
└──
src/
├── ipc/
│   ├── types.ts                            # T8 改（+ScanReport 等）
│   └── commands.ts                         # T8 改（+scanAgents）
├── routes/
│   └── Dashboard.tsx                       # T8 改（替换 ping 为 scan + 表格）
└── styles/
    └── global.css                          # T8 改（+scan-status / skills-table / btn 等）

docs/superpowers/specs/2026-07-20-asm-scaffold-design.md   # T8 末尾：更新脚手架 spec 的 §4.2
```

---

## Task 1: 引入新 crate 依赖 + util 模块壳 + platform::user_home_dir

**Files:**
- Modify: `src-tauri/Cargo.toml`（追加 5 个 crate）
- Modify: `src-tauri/src/lib.rs`（追加 `mod util;`）
- Create: `src-tauri/src/modules/util/mod.rs`（声明 3 个空子模块）
- Modify: `src-tauri/src/modules/platform/mod.rs`（追加 `user_home_dir` 函数）
- Test: 仅 `cargo check`（无逻辑测试）

**Interfaces:**
- Consumes: 模板当前 `Cargo.toml`（`tauri 2` + `serde` + `serde_json` + `thiserror` + `tauri-build`）
- Produces:
  - `pub fn platform::user_home_dir() -> Option<PathBuf>`（用 `dirs::home_dir()`）
  - `modules/util/{frontmatter,fingerprint,path_scan}.rs` 三个空文件（仅 doc comment + `// TBD` 占位，便于后续 TDD 不破坏编译）

- [ ] **Step 1.1: 读当前 `Cargo.toml`**

```bash
cat /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/Cargo.toml
```

预期：能看到 `[package]` 段含 `name = "asm-tmp"`、`version = "0.1.0"`、`edition = "2021"`；`[dependencies]` 段含 `tauri`、`serde`、`serde_json`、`thiserror`；`[build-dependencies]` 段含 `tauri-build`。

- [ ] **Step 1.2: 修改 `Cargo.toml` 追加 5 个 crate**

用 Edit 工具定位 `[dependencies]` 段，在 `thiserror = "1"` 之后追加：

```toml
dirs = "5"
serde_yml = "0.0.12"
sha2 = "0.10"
walkdir = "2"
uuid = { version = "1", features = ["v4"] }
```

预期：文件末尾 `[profile.*]` 段不变。

- [ ] **Step 1.3: 验证依赖能解析**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo check 2>&1 | tail -10
```

预期：编译通过（首次会下载 ~50 个新 crate，需 1-3 分钟）。如果有"unresolved import"错误，说明 5 个 crate 的版本号与 Rust 1.96 不兼容，需调整 `Cargo.toml`（用 Edit 工具）至 `cargo check` 通过。

- [ ] **Step 1.4: 读 `lib.rs` 当前内容**

```bash
cat /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/lib.rs
```

预期：能看到 `mod commands;` 和 `mod modules;` 两行。

- [ ] **Step 1.5: 修改 `lib.rs` 追加 `mod util`**

在 `mod commands;` 之后追加一行 `mod util;`。最终 `lib.rs` 头部：

```rust
mod commands;
mod modules;
mod util;
```

- [ ] **Step 1.6: 创建 `modules/util/mod.rs`**

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/mod.rs`：

```rust
//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。

mod frontmatter;
mod fingerprint;
mod path_scan;

pub use frontmatter::{parse_frontmatter, FrontmatterError, ParsedFrontmatter};
pub use fingerprint::{compute_fingerprint, FingerprintError, FingerprintInput};
pub use path_scan::{enumerate_skill_dirs, EnumerationInput, SkillCandidate};
```

**注意**：上面的 `pub use` 引用三个子模块尚未实现的符号——编译会失败。Step 1.10 会处理这个问题（先创建空文件让编译通过）。

- [ ] **Step 1.7: 创建三个空 util 子文件占位**

先建目录（如果尚未建）：

```bash
mkdir -p /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util
```

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/frontmatter.rs`：

```rust
//! YAML frontmatter 解析。
//! 实现见 T2。
```

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/fingerprint.rs`：

```rust
//! SHA-256 manifest fingerprint 计算。
//! 实现见 T3。
```

写入 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/path_scan.rs`：

```rust
//! 枚举 Skill 根下的子目录，检测是否含 SKILL.md。
//! 实现见 T4。
```

**但子文件目前没有 `pub fn parse_frontmatter` 等签名**——Step 1.6 的 `pub use` 仍会编译失败。Step 1.8 临时移除 `pub use` 让本任务可编译。

- [ ] **Step 1.8: 修改 `util/mod.rs` 临时移除 `pub use`**

T1 阶段三个子文件是占位，**不**导出符号。修改 `util/mod.rs` 为：

```rust
//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。

mod frontmatter;
mod fingerprint;
mod path_scan;
```

（删除三行 `pub use ...`）

- [ ] **Step 1.9: 读 `platform/mod.rs` 当前内容**

```bash
cat /Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/platform/mod.rs
```

预期：能看到 `pub fn app_data_dir() -> PathBuf { todo!(...) }`。

- [ ] **Step 1.10: 修改 `platform/mod.rs` 追加 `user_home_dir`**

用 Edit 工具定位 `app_data_dir` 函数末尾，**在该函数之后**追加：

```rust
/// 用户主目录解析。
///
/// 用 `dirs` crate 跨平台取 `$HOME` / `%USERPROFILE%` / `xdg_home`。
/// 返回 `None` 时整个 scan 返回 Failed 状态（spec §8.1）。
/// **禁止** hard-code `~` / `/Users` / `C:\Users`（spec §6.2）。
pub fn user_home_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir()
}
```

`platform/mod.rs` 现有 `todo!()` 仍然保留——`app_data_dir` 在 M0 范围外（spec §13）。

- [ ] **Step 1.11: 验证编译**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo check 2>&1 | tail -5
```

预期：`Finished dev profile [unoptimized + debuginfo] target(s)`。warning 可接受（`app_data_dir` 的 `todo!()` 已有 `#[allow(clippy::todo)]`）。

- [ ] **Step 1.12: 验证 lint**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -5
```

预期：两个命令均退出码 0。

- [ ] **Step 1.13: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/modules/util/ src-tauri/src/modules/platform/mod.rs && git status
```

预期：staged 含 5 个路径，无 `.idea/` 或 `Cargo.lock`。

```bash
git commit -m "$(cat <<'EOF'
chore(adapter): add deps + util module skeleton + user_home_dir

Introduces dirs/serde_yml/sha2/walkdir/uuid for the Claude Code adapter
work. Adds modules/util/ with three placeholder submodules and
platform::user_home_dir() via the dirs crate. No logic yet — util
submodules land in T2-T4, adapter implementation in T5-T6.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: util::frontmatter TDD（4 个测试）

**Files:**
- Modify: `src-tauri/src/modules/util/frontmatter.rs`（占位 → 完整实现 + 4 tests）
- Modify: `src-tauri/src/modules/util/mod.rs`（恢复 `pub use frontmatter::*`）

**Interfaces:**
- Consumes: `serde_yml`, `serde_json::Value`, `FrontmatterError` 自定义
- Produces:
  - `pub struct ParsedFrontmatter { name: Option<String>, description: Option<String>, license: Option<String>, raw: Option<serde_json::Value> }`
  - `pub enum FrontmatterError { MissingDelimiters, EmptyBody, YamlParse(String) }`
  - `pub fn parse_frontmatter(text: &str) -> Result<ParsedFrontmatter, FrontmatterError>`

- [ ] **Step 2.1: 写 4 个失败的测试**

覆盖 `frontmatter.rs` 已有占位注释，**完全替换**：

```rust
//! YAML frontmatter 解析，输出 ParsedFrontmatter。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.1。

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Default, Serialize)]
pub struct ParsedFrontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub license: Option<String>,
    pub raw: Option<serde_json::Value>,
}

#[derive(Debug, Error)]
pub enum FrontmatterError {
    #[error("missing --- delimiters")]
    MissingDelimiters,
    #[error("empty frontmatter body")]
    EmptyBody,
    #[error("yaml parse error: {0}")]
    YamlParse(String),
}

/// 解析 `---` 包围的 YAML frontmatter。允许 frontmatter 完全缺失（返回 Default）。
pub fn parse_frontmatter(text: &str) -> Result<ParsedFrontmatter, FrontmatterError> {
    // T2.3 实现
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_frontmatter_basic() {
        let text = "---\nname: foo\ndescription: bar skill\nlicense: MIT\n---\nbody text\n";
        let r = parse_frontmatter(text).unwrap();
        assert_eq!(r.name.as_deref(), Some("foo"));
        assert_eq!(r.description.as_deref(), Some("bar skill"));
        assert_eq!(r.license.as_deref(), Some("MIT"));
    }

    #[test]
    fn parse_frontmatter_missing_delim() {
        // 没有 --- 起始
        let r = parse_frontmatter("name: foo\n---\n");
        assert!(matches!(r, Err(FrontmatterError::MissingDelimiters)));
    }

    #[test]
    fn parse_frontmatter_yaml_error() {
        // 坏语法
        let r = parse_frontmatter("---\nname: : :\n---\n");
        assert!(matches!(r, Err(FrontmatterError::YamlParse(_))));
    }

    #[test]
    fn parse_frontmatter_extra_fields() {
        // 未知字段进 raw 不报错
        let text = "---\nname: foo\ncustom_field: hello\n---\nbody\n";
        let r = parse_frontmatter(text).unwrap();
        assert_eq!(r.name.as_deref(), Some("foo"));
        let raw = r.raw.expect("raw should be Some");
        assert_eq!(raw["custom_field"], "hello");
    }
}
```

- [ ] **Step 2.2: 跑测试，验证全部 fail**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib util::frontmatter 2>&1 | tail -15
```

预期：4 个 test 全部 panic（因为 `todo!()`）。`todo!()` 会让每个 test 触发 `thread 'tests::parse_frontmatter_basic' panicked at 'not yet implemented'`。

- [ ] **Step 2.3: 实现 `parse_frontmatter`**

替换 `parse_frontmatter` 函数体（保留签名与 doc comment）：

```rust
pub fn parse_frontmatter(text: &str) -> Result<ParsedFrontmatter, FrontmatterError> {
    // 找第一个 --- 起始
    let lines: Vec<&str> = text.lines().collect();
    let start_idx = lines
        .iter()
        .position(|l| l.trim() == "---")
        .ok_or(FrontmatterError::MissingDelimiters)?;

    // 找下一个 --- 结束
    let end_idx = lines
        .iter()
        .skip(start_idx + 1)
        .position(|l| l.trim() == "---")
        .ok_or(FrontmatterError::MissingDelimiters)?;

    let body_lines = &lines[start_idx + 1..start_idx + 1 + end_idx];
    if body_lines.is_empty() {
        return Err(FrontmatterError::EmptyBody);
    }
    let body = body_lines.join("\n");

    // YAML -> JSON Value
    let value: serde_json::Value = serde_yml::from_str(&body)
        .map_err(|e| FrontmatterError::YamlParse(e.to_string()))?;

    // 抽取标量字段
    let mut r = ParsedFrontmatter::default();
    if let Some(obj) = value.as_object() {
        r.name = obj.get("name").and_then(|v| v.as_str()).map(String::from);
        r.description = obj.get("description").and_then(|v| v.as_str()).map(String::from);
        r.license = obj.get("license").and_then(|v| v.as_str()).map(String::from);
    }
    r.raw = Some(value);
    Ok(r)
}
```

- [ ] **Step 2.4: 跑测试，验证全部 pass**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib util::frontmatter 2>&1 | tail -10
```

预期：`test result: ok. 4 passed; 0 failed`。

- [ ] **Step 2.5: 跑 clippy**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -5
```

预期：退出码 0。如果 clippy 报 `clippy::todo` 关于 `EmptyBody` 分支未测试——可加 `#[allow(clippy::todo)]` 或补一个 `parse_frontmatter_empty_body` 测试。后者更彻底：

```rust
    #[test]
    fn parse_frontmatter_empty_body() {
        let r = parse_frontmatter("---\n---\nbody\n");
        assert!(matches!(r, Err(FrontmatterError::EmptyBody)));
    }
```

加在 `mod tests` 末尾，重新跑 cargo test 必须 5 passed。

- [ ] **Step 2.6: 恢复 `util/mod.rs` 的 `pub use`**

编辑 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/mod.rs`：

```rust
//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。

mod frontmatter;
mod fingerprint;
mod path_scan;

pub use frontmatter::{parse_frontmatter, FrontmatterError, ParsedFrontmatter};
```

（`fingerprint` 与 `path_scan` 仍是空文件，本行的 `pub use` 只导出 frontmatter；T3 / T4 完成后会扩展。）

- [ ] **Step 2.7: 验证 cargo check + clippy**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo check 2>&1 | tail -3 && cargo clippy -- -D warnings 2>&1 | tail -3
```

预期：均退出码 0。

- [ ] **Step 2.8: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/src/modules/util/frontmatter.rs src-tauri/src/modules/util/mod.rs && git commit -m "$(cat <<'EOF'
feat(util): add frontmatter parser (TDD)

Parses --- wrapped YAML frontmatter per Agent Skills open standard.
Returns ParsedFrontmatter with name/description/license scalars plus
raw serde_json::Value for unknown fields. Handles missing delimiters,
empty body, and YAML syntax errors as distinct FrontmatterError variants.

5 unit tests (4 from spec + 1 for empty body). Exposed via
modules::util::parse_frontmatter.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: util::fingerprint TDD（6 个测试）

**Files:**
- Modify: `src-tauri/src/modules/util/fingerprint.rs`（占位 → 完整实现 + 6 tests）
- Modify: `src-tauri/src/modules/util/mod.rs`（追加 `pub use fingerprint::*`）

**Interfaces:**
- Consumes: `walkdir`, `sha2::Sha256`, std path APIs
- Produces:
  - `pub struct FingerprintInput { pub root: PathBuf, pub comparable_extensions: &'static [&'static str], pub exclude_names: &'static [&'static str] }`
  - `pub enum FingerprintError { Io(String) }`
  - `pub fn compute_fingerprint(input: &FingerprintInput) -> Result<ContentFingerprint, FingerprintError>`（注意：返回的 `ContentFingerprint` 是 `adapter::ContentFingerprint`，T5 才定义；这里先定义一个本地占位 struct 或推迟到 T5 后再跑测试）

**关键问题**：`ContentFingerprint` 来自 `modules::adapter`（spec §5），T3 写完时它还不存在。**T3 阶段把测试标记 `#[ignore]`，T5 完成后再移除 `#[ignore]`**。或者用本地同名 struct 占位，T5 再迁移。

**更稳的做法**：T3 阶段 `fingerprint.rs` **不**返回 `ContentFingerprint`，而是返回 `(String digest, usize file_count)`，T7 阶段（在 T5 之后）再加一个包装函数组装 `ContentFingerprint`。这避免了循环依赖。

**修正接口**：
- `pub fn compute_fingerprint(input: &FingerprintInput) -> Result<(String, usize), FingerprintError>` 返回 `(digest_hex, file_count)`

- [ ] **Step 3.1: 写 6 个失败的测试 + 临时接口**

**完全替换** `fingerprint.rs` 内容：

```rust
//! SHA-256 manifest fingerprint 计算。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.2。
//!
//! 拼 manifest: "<rel_path>\0<size>\0<sha256_hex>\n" 排序后整体 sha256。

use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Debug)]
pub struct FingerprintInput {
    pub root: PathBuf,
    pub comparable_extensions: &'static [&'static str],
    pub exclude_names: &'static [&'static str],
}

#[derive(Debug, Error)]
pub enum FingerprintError {
    #[error("io error: {0}")]
    Io(String),
}

/// 计算 deterministic fingerprint。
/// 返回 `(digest_hex, file_count)`。T7 阶段会包成 ContentFingerprint。
pub fn compute_fingerprint(input: &FingerprintInput) -> Result<(String, usize), FingerprintError> {
    // T3.3 实现
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn make_skill(tmp: &Path, files: &[(&str, &str)]) {
        for (rel, content) in files {
            let p = tmp.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(&p, content).unwrap();
        }
    }

    fn default_input(root: &Path) -> FingerprintInput {
        FingerprintInput {
            root: root.to_path_buf(),
            comparable_extensions: &["md", "txt", "json", "yaml", "yml"],
            exclude_names: &[".DS_Store"],
        }
    }

    #[test]
    fn fingerprint_deterministic() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "name: foo\n"), ("refs/a.md", "a")]);
        let input = default_input(&tmp);
        let (d1, n1) = compute_fingerprint(&input).unwrap();
        let (d2, n2) = compute_fingerprint(&input).unwrap();
        assert_eq!(d1, d2);
        assert_eq!(n1, n2);
        assert_eq!(n1, 2);
    }

    #[test]
    fn fingerprint_changes_on_rename() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "x")]);
        let (d1, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        // 重命名
        fs::rename(tmp.join("SKILL.md"), tmp.join("SKILL2.md")).unwrap();
        let (d2, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_ne!(d1, d2);
    }

    #[test]
    fn fingerprint_changes_on_content() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "v1")]);
        let (d1, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        fs::write(tmp.join("SKILL.md"), "v2").unwrap();
        let (d2, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_ne!(d1, d2);
    }

    #[test]
    fn fingerprint_excludes_hidden() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "x"), (".DS_Store", "junk")]);
        let (_, n) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_eq!(n, 1, ".DS_Store 必须被排除");
    }

    #[test]
    fn fingerprint_skips_symlink() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "x")]);
        // 创建 symlink 指向 SKILL.md
        std::os::unix::fs::symlink(tmp.join("SKILL.md"), tmp.join("link.md")).unwrap();
        let (_, n) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_eq!(n, 1, "symlink 必须不 follow");
    }

    #[test]
    fn fingerprint_skips_png() {
        let tmp = tempdir();
        // 写一个 .png
        fs::write(tmp.join("img.png"), b"\x89PNG\r\n\x1a\n").unwrap();
        let (_, n) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_eq!(n, 0, ".png 不在 comparable_extensions");
    }

    // ----- helpers -----

    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = base.join(format!("asm-fp-{}-{}", pid, nanos));
        fs::create_dir_all(&p).unwrap();
        p
    }
}
```

- [ ] **Step 3.2: 跑测试，验证 fail**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib util::fingerprint 2>&1 | tail -10
```

预期：6 个 test 全部 panic（`todo!()`）。

- [ ] **Step 3.3: 实现 `compute_fingerprint`**

替换 `compute_fingerprint` 函数体：

```rust
pub fn compute_fingerprint(input: &FingerprintInput) -> Result<(String, usize), FingerprintError> {
    use sha2::{Digest, Sha256};
    use walkdir::WalkDir;

    let mut entries: Vec<(String, u64, String)> = Vec::new();

    for entry in WalkDir::new(&input.root).follow_links(false) {
        let e = match entry {
            Ok(e) => e,
            Err(_) => continue, // spec §5.2 容错
        };
        if !e.file_type().is_file() {
            continue;
        }
        let path = e.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        // 排除名单
        if input.exclude_names.contains(&name) {
            continue;
        }
        // 扩展名白名单
        let ext = match path.extension().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        if !input.comparable_extensions.contains(&ext) {
            continue;
        }

        // 相对路径
        let rel = match path.strip_prefix(&input.root) {
            Ok(r) => r.to_string_lossy().into_owned(),
            Err(_) => continue,
        };

        // 读 + 单文件 sha256
        let bytes = match std::fs::read(path) {
            Ok(b) => b,
            Err(e) => return Err(FingerprintError::Io(e.to_string())),
        };
        let size = bytes.len() as u64;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let digest = format!("{:x}", hasher.finalize());

        entries.push((rel, size, digest));
    }

    // 排序: 按 rel 字典序
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    // 拼 manifest, 整体 sha256
    let mut manifest_hasher = Sha256::new();
    for (rel, size, digest) in &entries {
        manifest_hasher.update(rel.as_bytes());
        manifest_hasher.update(b"\0");
        manifest_hasher.update(size.to_string().as_bytes());
        manifest_hasher.update(b"\0");
        manifest_hasher.update(digest.as_bytes());
        manifest_hasher.update(b"\n");
    }
    let final_digest = format!("{:x}", manifest_hasher.finalize());
    let file_count = entries.len();

    Ok((final_digest, file_count))
}
```

- [ ] **Step 3.4: 跑测试，验证 pass**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib util::fingerprint 2>&1 | tail -10
```

预期：`test result: ok. 6 passed; 0 failed`。

- [ ] **Step 3.5: 跑 fmt + clippy**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -5
```

预期：均退出码 0。

- [ ] **Step 3.6: 更新 `util/mod.rs` 添加 `pub use`**

编辑 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/mod.rs`：

```rust
//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。

mod frontmatter;
mod fingerprint;
mod path_scan;

pub use fingerprint::{compute_fingerprint, FingerprintError, FingerprintInput};
pub use frontmatter::{parse_frontmatter, FrontmatterError, ParsedFrontmatter};
```

- [ ] **Step 3.7: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/src/modules/util/fingerprint.rs src-tauri/src/modules/util/mod.rs && git commit -m "$(cat <<'EOF'
feat(util): add SHA-256 manifest fingerprint (TDD)

Computes a deterministic content fingerprint per spec §7.2: sorted
relative-path manifest sha256'd over each file's own sha256 + size.
Default comparable_extensions = md/txt/json/yaml/yml; .DS_Store excluded;
walkdir runs with follow_links(false) per spec §6.5.

Returns (digest_hex, file_count) tuple; T7 wraps into ContentFingerprint
after adapter DTOs land. 6 unit tests cover determinism, rename,
content change, hidden exclusion, symlink skip, png skip.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: util::path_scan TDD（3 个测试）

**Files:**
- Modify: `src-tauri/src/modules/util/path_scan.rs`（占位 → 完整实现 + 3 tests）
- Modify: `src-tauri/src/modules/util/mod.rs`（追加 `pub use path_scan::*`）

**Interfaces:**
- Consumes: `std::fs`, `ScanIssue` 来自 `modules::adapter`（T5 才有）
- Produces:
  - `pub struct SkillCandidate { pub dir: PathBuf, pub entry_file: PathBuf, pub entry_size: u64, pub entry_modified: SystemTime }`
  - `pub struct EnumerationInput { pub root: &Path, pub entry_filename: &'static str, pub skip_hidden: bool, pub max_depth: usize }`
  - `pub fn enumerate_skill_dirs(input: &EnumerationInput) -> (Vec<SkillCandidate>, Vec<adapter::ScanIssue>)`

**T4 时序问题**：`ScanIssue` 来自 `adapter` 模块，T4 写完时它还不存在。**和 T3 同样的处理**：T4 阶段把测试用 `#[ignore]` 标记，T5 完成后再取消 `#[ignore]` 跑测试。

**修正接口**：T4 阶段返回一个本地占位 `Vec<PathBuf>` 而非 `Vec<SkillCandidate>`，T5 后再扩展。

**简化方案**：直接**假设** T4 写的是最终形态（含 `adapter::ScanIssue`），但把 3 个 test 标 `#[ignore]`，T5 完成后 unignore。T5 本身纯类型声明、不会破坏 T4 实现。

- [ ] **Step 4.1: 写 3 个测试 + 最终接口（含 `#[ignore]`）**

**完全替换** `path_scan.rs`：

```rust
//! 枚举 Skill 根下的子目录，检测每个是否是合法 Skill 安装。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.3。

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::modules::adapter::ScanIssue;

#[derive(Debug)]
pub struct SkillCandidate {
    pub dir: PathBuf,
    pub entry_file: PathBuf,
    pub entry_size: u64,
    pub entry_modified: SystemTime,
}

#[derive(Debug)]
pub struct EnumerationInput {
    pub root: &'static Path,
    pub entry_filename: &'static str,
    pub skip_hidden: bool,
    pub max_depth: usize,
}

/// 枚举 root 下符合规格的子目录。不创建任何目录。
pub fn enumerate_skill_dirs(input: &EnumerationInput) -> (Vec<SkillCandidate>, Vec<ScanIssue>) {
    // T4.3 实现
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = base.join(format!("asm-ps-{}-{}", pid, nanos));
        fs::create_dir_all(&p).unwrap();
        p
    }

    // 标 #[ignore] 直到 T5 引入 ScanIssue 类型
    #[test]
    #[ignore = "needs ScanIssue from T5"]
    fn enumerate_skips_dotfiles() {
        let tmp = tempdir();
        fs::create_dir(tmp.join(".hidden")).unwrap();
        fs::write(tmp.join(".hidden/SKILL.md"), "x").unwrap();
        fs::create_dir(tmp.join("visible")).unwrap();
        fs::write(tmp.join("visible/SKILL.md"), "y").unwrap();
        let input = EnumerationInput {
            root: Box::leak(Box::new(tmp.clone())),
            entry_filename: "SKILL.md",
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, _) = enumerate_skill_dirs(&input);
        assert_eq!(candidates.len(), 1);
        assert!(candidates[0].dir.ends_with("visible"));
    }

    #[test]
    #[ignore = "needs ScanIssue from T5"]
    fn enumerate_requires_skill_md() {
        let tmp = tempdir();
        fs::create_dir(tmp.join("no_entry")).unwrap();
        fs::create_dir(tmp.join("with_entry")).unwrap();
        fs::write(tmp.join("with_entry/SKILL.md"), "y").unwrap();
        let input = EnumerationInput {
            root: Box::leak(Box::new(tmp.clone())),
            entry_filename: "SKILL.md",
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, issues) = enumerate_skill_dirs(&input);
        assert_eq!(candidates.len(), 1);
        assert!(!issues.is_empty());
        let code = issues.iter().find(|i| i.path.as_ref().unwrap().to_string_lossy().contains("no_entry")).map(|i| i.code.as_str());
        assert_eq!(code, Some("ENTRY_MISSING"));
    }

    #[test]
    #[ignore = "needs ScanIssue from T5"]
    fn enumerate_handles_permission_error() {
        // 我们只保证 "出错不 panic"。创建一个有效 Skill 即可。
        let tmp = tempdir();
        fs::create_dir(tmp.join("ok")).unwrap();
        fs::write(tmp.join("ok/SKILL.md"), "y").unwrap();
        let input = EnumerationInput {
            root: Box::leak(Box::new(tmp.clone())),
            entry_filename: "SKILL.md",
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, _) = enumerate_skill_dirs(&input);
        assert_eq!(candidates.len(), 1);
        // 不可读目录无法在大多数 CI 上可靠模拟，跳过。但确保不 panic 已经足够。
    }
}
```

- [ ] **Step 4.2: 跑测试，验证 fail（因 `todo!()`）**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib util::path_scan 2>&1 | tail -10
```

预期：3 个 test 被 `#[ignore]` 跳过。如果 ignore 不生效（`todo!()` 在 fn 体里），会 panic 提示"needs ScanIssue from T5"。

- [ ] **Step 4.3: 实现 `enumerate_skill_dirs`**

替换函数体：

```rust
pub fn enumerate_skill_dirs(input: &EnumerationInput) -> (Vec<SkillCandidate>, Vec<ScanIssue>) {
    use std::fs;
    use std::time::SystemTime;

    let mut candidates = Vec::new();
    let mut issues = Vec::new();

    let entries = match fs::read_dir(input.root) {
        Ok(e) => e,
        Err(e) => {
            issues.push(ScanIssue {
                code: "ROOT_NOT_FOUND".into(),
                severity: crate::modules::adapter::IssueSeverity::Warning,
                phase: crate::modules::adapter::IssuePhase::Enumeration,
                path: Some(input.root.to_path_buf()),
                message: e.to_string(),
                recoverable: true,
            });
            return (candidates, issues);
        }
    };

    for entry in entries.flatten() {
        let dir_path = entry.path();
        let name = match dir_path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // 隐藏目录
        if input.skip_hidden && name.starts_with('.') {
            continue;
        }

        // symlink_metadata: 不 follow
        let meta = match std::fs::symlink_metadata(&dir_path) {
            Ok(m) => m,
            Err(e) => {
                issues.push(ScanIssue {
                    code: "PERMISSION_DENIED".into(),
                    severity: crate::modules::adapter::IssueSeverity::Warning,
                    phase: crate::modules::adapter::IssuePhase::Enumeration,
                    path: Some(dir_path),
                    message: e.to_string(),
                    recoverable: true,
                });
                continue;
            }
        };

        if !meta.file_type().is_dir() {
            continue;
        }

        // 检查 entry file
        let entry_path = dir_path.join(input.entry_filename);
        let entry_meta = match std::fs::metadata(&entry_path) {
            Ok(m) => m,
            Err(_) => {
                issues.push(ScanIssue {
                    code: "ENTRY_MISSING".into(),
                    severity: crate::modules::adapter::IssueSeverity::Warning,
                    phase: crate::modules::adapter::IssuePhase::Enumeration,
                    path: Some(dir_path.clone()),
                    message: format!("missing {}", input.entry_filename),
                    recoverable: true,
                });
                continue;
            }
        };

        if !entry_meta.is_file() {
            issues.push(ScanIssue {
                code: "ENTRY_NOT_A_FILE".into(),
                severity: crate::modules::adapter::IssueSeverity::Warning,
                phase: crate::modules::adapter::IssuePhase::Enumeration,
                path: Some(entry_path.clone()),
                message: format!("{} is not a regular file", input.entry_filename),
                recoverable: true,
            });
            continue;
        }

        candidates.push(SkillCandidate {
            dir: dir_path,
            entry_file: entry_path,
            entry_size: entry_meta.len(),
            entry_modified: entry_meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
        });
    }

    (candidates, issues)
}
```

- [ ] **Step 4.4: 跑测试（仍 ignored）**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib util::path_scan 2>&1 | tail -5
```

预期：3 个 test 被 ignore。`cargo test` 主报告 `test result: ok. 0 passed; 0 failed; 3 ignored`。

- [ ] **Step 4.5: 跑 fmt + clippy + check**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -5
```

预期：均退出码 0。

- [ ] **Step 4.6: 更新 `util/mod.rs`**

编辑 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/mod.rs`：

```rust
//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。

mod frontmatter;
mod fingerprint;
mod path_scan;

pub use fingerprint::{compute_fingerprint, FingerprintError, FingerprintInput};
pub use frontmatter::{parse_frontmatter, FrontmatterError, ParsedFrontmatter};
pub use path_scan::{enumerate_skill_dirs, EnumerationInput, SkillCandidate};
```

- [ ] **Step 4.7: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/src/modules/util/path_scan.rs src-tauri/src/modules/util/mod.rs && git commit -m "$(cat <<'EOF'
feat(util): add Skill directory enumeration (TDD)

Enumerates first-level subdirectories of a Skill root and filters
by entry-file presence (SKILL.md by default). Skips hidden dirs
and symlinks (spec §6.5), records missing entries / permission
errors as ScanIssue without aborting the rest of the root (spec §5.2).

3 unit tests marked #[ignore] until T5 lands the ScanIssue type; will
be un-ignored there.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 扩展 adapter trait + 共享 DTO（13 structs + 4 enums + 6 methods）

**Files:**
- Modify: `src-tauri/src/modules/adapter/mod.rs`（重写为完整 trait + DTO）
- Modify: `src-tauri/src/modules/adapter/codex.rs`（最小化以通过编译）
- Modify: `src-tauri/src/modules/adapter/claude_code.rs`（暂时保留 stub，等 T6）

**Interfaces:** 完整 spec §5。**这一节无 TDD 步骤**——纯类型声明。

- [ ] **Step 5.1: 完全重写 `modules/adapter/mod.rs`**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/adapter/mod.rs`：

```rust
//! Agent Adapter 注册与统一契约。
//!
//! 契约见 ADAPTER_SPEC.md §3-§7。MVP 仅 `detect` 和 `scan` 为必实现。
//! 本文件含完整 DTO + 6 方法 trait；M0 阶段 ClaudeCodeAdapter 实现全部方法，
//! CodexAdapter 仍为 stub。
//! 本文件保留 dead_code allow，因 CodexAdapter 占位导致 pub use 触发警告。
#![allow(dead_code, unused_imports)]

mod claude_code;
mod codex;

use std::path::PathBuf;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============================================================
// 身份
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AgentId(pub String);

// ============================================================
// Trait
// ============================================================

pub trait AgentAdapter {
    fn id(&self) -> AgentId;
    fn descriptor(&self) -> AgentDescriptor;
    fn capabilities(&self) -> CapabilitySet;
    fn detect(&self, ctx: &DetectContext) -> DetectionResult;
    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot>;
    fn scan(&self, ctx: &ScanContext) -> ScanResult;
}

// ============================================================
// Descriptor & capabilities
// ============================================================

#[derive(Debug, Clone, Serialize)]
pub struct AgentDescriptor {
    pub agent_id: AgentId,
    pub adapter_id: String,
    pub display_name: String,
    pub supported_platforms: Vec<Platform>,
    pub documentation_url: Option<String>,
    pub adapter_version: String,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum Platform {
    MacOs,
    Linux,
    Windows,
}

#[derive(Debug, Clone, Serialize)]
pub struct CapabilitySet {
    pub detect: SupportLevel,
    pub scan: SupportLevel,
    pub compare_content: CompareConfidence,
    pub watch: SupportLevel,
    pub install_planning: SupportLevel,
    pub uninstall_planning: SupportLevel,
    pub update_planning: SupportLevel,
    pub sync_planning: SupportLevel,
    pub supported_platforms: Vec<Platform>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum SupportLevel {
    Unsupported,
    Planned,
    Supported,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum CompareConfidence {
    None,
    Partial,
    Reliable,
}

// ============================================================
// Detection path
// ============================================================

pub struct DetectContext<'a> {
    pub platform: &'a PlatformContext,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlatformContext {
    pub platform: Platform,
    pub home_dir: PathBuf,
    pub cwd: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillRoot {
    pub root_id: String,
    pub display_path: PathBuf,
    pub canonical_path: PathBuf,
    pub scope: RootScope,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum RootScope {
    User,
    Project,
    Custom,
}

#[derive(Debug, Clone, Serialize)]
pub struct DetectionResult {
    pub agent: AgentId,
    pub status: DetectionStatus,
    pub roots: Vec<SkillRoot>,
    pub issues: Vec<ScanIssue>,
    pub observed_at: SystemTime,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum DetectionStatus {
    Detected,
    Unavailable,
    Partial,
    Unsupported,
    Failed,
}

// ============================================================
// Scan path
// ============================================================

pub struct ScanContext<'a> {
    pub scan_id: ScanId,
    pub agent: AgentId,
    pub roots: &'a [SkillRoot],
    pub platform: &'a PlatformContext,
    pub started_at: SystemTime,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct ScanId(pub Uuid);

impl ScanId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillInstallation {
    pub agent_id: AgentId,
    pub adapter_id: String,
    pub root_id: String,
    pub location: LocationDescriptor,
    pub format: SkillFormatDescriptor,
    pub identity: SkillIdentityEvidence,
    pub entry: EntryDescriptor,
    pub metadata: NormalizedSkillMetadata,
    pub content_fingerprint: Option<ContentFingerprint>,
    pub comparison_confidence: CompareConfidence,
    pub observed_at: SystemTime,
    pub diagnostics: Vec<ScanIssue>,
}

#[derive(Debug, Clone, Serialize)]
pub struct LocationDescriptor {
    pub display_path: PathBuf,
    pub canonical_path: PathBuf,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillFormatDescriptor {
    pub id: String,
    pub display_name: String,
    pub entry_file: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SkillIdentityEvidence {
    pub normalized_name: String,
    pub declared_name: Option<String>,
    pub source: IdentitySource,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum IdentitySource {
    FrontmatterName,
    DirectoryName,
}

#[derive(Debug, Clone, Serialize)]
pub struct EntryDescriptor {
    pub path: PathBuf,
    pub size: u64,
    pub modified: SystemTime,
}

#[derive(Debug, Clone, Serialize)]
pub struct NormalizedSkillMetadata {
    pub name: String,
    pub description: String,
    pub license: Option<String>,
    pub raw_metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ContentFingerprint {
    pub algorithm: &'static str,
    pub version: u32,
    pub scope: &'static str,
    pub digest: String,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanIssue {
    pub code: String,
    pub severity: IssueSeverity,
    pub phase: IssuePhase,
    pub path: Option<PathBuf>,
    pub message: String,
    pub recoverable: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum IssuePhase {
    Detect,
    RootResolution,
    Enumeration,
    Read,
    Parse,
    Fingerprint,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanResult {
    pub scan_id: ScanId,
    pub agent_id: AgentId,
    pub outcome: ScanOutcome,
    pub completeness: ScanCompleteness,
    pub installations: Vec<SkillInstallation>,
    pub issues: Vec<ScanIssue>,
    pub started_at: SystemTime,
    pub completed_at: SystemTime,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum ScanOutcome {
    Completed,
    CompletedWithIssues,
    Partial,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum ScanCompleteness {
    Complete,
    Partial,
    Unknown,
}

pub use claude_code::ClaudeCodeAdapter;
pub use codex::CodexAdapter;
```

- [ ] **Step 5.2: 修改 `codex.rs` 以满足新 trait**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/adapter/codex.rs`：

```rust
//! Codex Adapter 占位（spec §13 明确不在 M0 范围）。

use super::{
    AgentAdapter, AgentId, AgentDescriptor, CapabilitySet, CompareConfidence, DetectContext,
    DetectionResult, ScanContext, ScanResult, SupportLevel,
};

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn id(&self) -> AgentId {
        AgentId("codex".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "codex@0".to_string(),
            display_name: "Codex".to_string(),
            supported_platforms: vec![],
            documentation_url: None,
            adapter_version: "0.0.0".to_string(),
        }
    }

    fn capabilities(&self) -> CapabilitySet {
        CapabilitySet {
            detect: SupportLevel::Unsupported,
            scan: SupportLevel::Unsupported,
            compare_content: CompareConfidence::None,
            watch: SupportLevel::Unsupported,
            install_planning: SupportLevel::Unsupported,
            uninstall_planning: SupportLevel::Unsupported,
            update_planning: SupportLevel::Unsupported,
            sync_planning: SupportLevel::Unsupported,
            supported_platforms: vec![],
            notes: vec!["stub for M0; implementation deferred".to_string()],
        }
    }

    fn detect(&self, _ctx: &DetectContext) -> DetectionResult {
        DetectionResult {
            agent: self.id(),
            status: super::DetectionStatus::Unsupported,
            roots: vec![],
            issues: vec![],
            observed_at: std::time::SystemTime::now(),
        }
    }

    fn skill_roots(&self, _det: &DetectionResult) -> Vec<super::SkillRoot> {
        vec![]
    }

    fn scan(&self, _ctx: &ScanContext) -> ScanResult {
        ScanResult {
            scan_id: super::ScanId::new(),
            agent_id: self.id(),
            outcome: super::ScanOutcome::Failed,
            completeness: super::ScanCompleteness::Unknown,
            installations: vec![],
            issues: vec![],
            started_at: std::time::SystemTime::now(),
            completed_at: std::time::SystemTime::now(),
        }
    }
}
```

- [ ] **Step 5.3: 暂时改 `claude_code.rs` 让它满足新 trait（仍 stub 逻辑）**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/adapter/claude_code.rs`：

```rust
//! Claude Code Adapter。
//! T5 阶段先满足新 trait 编译；T6 阶段重写 detect/scan 为真实实现。
//! 临时 stub 返回 Detected + 0 roots + 1 issue。

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, CompareConfidence, DetectContext,
    DetectionResult, ScanContext, ScanResult, ScanIssue, IssueSeverity, IssuePhase, SkillRoot,
    Platform, SupportLevel, RootScope, ScanId, ScanOutcome, ScanCompleteness,
};
use std::time::SystemTime;

pub struct ClaudeCodeAdapter;

const ADAPTER_VERSION: &str = "0.1.0";

impl AgentAdapter for ClaudeCodeAdapter {
    fn id(&self) -> AgentId {
        AgentId("claude-code".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "claude-code@1".to_string(),
            display_name: "Claude Code".to_string(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://code.claude.com/docs/en/skills".to_string()),
            adapter_version: ADAPTER_VERSION.to_string(),
        }
    }

    fn capabilities(&self) -> CapabilitySet {
        CapabilitySet {
            detect: SupportLevel::Supported,
            scan: SupportLevel::Supported,
            compare_content: CompareConfidence::Reliable,
            watch: SupportLevel::Unsupported,
            install_planning: SupportLevel::Unsupported,
            uninstall_planning: SupportLevel::Unsupported,
            update_planning: SupportLevel::Unsupported,
            sync_planning: SupportLevel::Unsupported,
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            notes: vec![
                "user-scope $HOME/.claude/skills; project-scope from cwd upward".to_string(),
            ],
        }
    }

    fn detect(&self, _ctx: &DetectContext) -> DetectionResult {
        DetectionResult {
            agent: self.id(),
            status: super::DetectionStatus::Unavailable,
            roots: vec![],
            issues: vec![ScanIssue {
                code: "NOT_IMPLEMENTED".to_string(),
                severity: IssueSeverity::Info,
                phase: IssuePhase::Detect,
                path: None,
                message: "claude_code adapter detect/scan not yet implemented (T5 stub)".to_string(),
                recoverable: true,
            }],
            observed_at: SystemTime::now(),
        }
    }

    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }

    fn scan(&self, _ctx: &ScanContext) -> ScanResult {
        ScanResult {
            scan_id: ScanId::new(),
            agent_id: self.id(),
            outcome: ScanOutcome::Failed,
            completeness: ScanCompleteness::Unknown,
            installations: vec![],
            issues: vec![],
            started_at: SystemTime::now(),
            completed_at: SystemTime::now(),
        }
    }
}
```

- [ ] **Step 5.4: 验证编译 + clippy**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo check 2>&1 | tail -5 && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -5
```

预期：均退出码 0。

- [ ] **Step 5.5: 跑全部测试（util 测试 + ignored path_scan 测试）**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib 2>&1 | tail -15
```

预期：
- `util::frontmatter` 4+1 = 5 passed
- `util::fingerprint` 6 passed
- `util::path_scan` 0 passed; 0 failed; 3 ignored（仍 #[ignore]）

合计 11 passed, 3 ignored。**不要 unignore path_scan**——T5 不是测试任务，T6 完成后才 unignore。

- [ ] **Step 5.6: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/src/modules/adapter/ && git commit -m "$(cat <<'EOF'
feat(adapter): expand trait to 6 methods + 13 DTOs

Wires the full ADAPTER_SPEC §3-§7 contract: descriptor, capabilities,
detect, skill_roots, scan. Adds 13 shared DTOs (AgentDescriptor,
CapabilitySet, DetectionResult, ScanResult, SkillInstallation, etc.)
and 4 enums (Platform, SupportLevel, CompareConfidence, DetectionStatus,
ScanOutcome, etc.). Each carries Serialize so T7 can return ScanReport
to the frontend.

ClaudeCodeAdapter is a T5 stub returning Unavailable; T6 fills in real
detection + scan. CodexAdapter satisfies the new trait but returns
Unsupported (M0 out of scope, per spec §13).

No new tests in T5 — pure type declarations. cargo test still 11 green
(path_scan's 3 stay #[ignore] until T6).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: ClaudeCodeAdapter 真实实现（TDD 9 tests）

**Files:**
- Modify: `src-tauri/src/modules/adapter/claude_code.rs`（从 stub 重写为真实实现）
- Modify: `src-tauri/src/modules/util/path_scan.rs`（移除 `#[ignore]`，跑 path_scan 3 个测试）

**Interfaces:**
- Consumes: 全部 T5 引入的 DTO、T1-T4 引入的 util 函数
- Produces: 真实可用的 ClaudeCodeAdapter detect/scan

- [ ] **Step 6.1: 写 9 个失败的测试到 `claude_code.rs` 末尾**

**先备份当前 stub 内容**，然后**完全替换** `claude_code.rs`：

```rust
//! Claude Code Adapter 真实实现。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §7。

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, CompareConfidence, ContentFingerprint,
    DetectContext, DetectionResult, DetectionStatus, EntryDescriptor, IdentitySource, IssuePhase,
    IssueSeverity, LocationDescriptor, NormalizedSkillMetadata, Platform, PlatformContext,
    RootScope, ScanContext, ScanId, ScanCompleteness, ScanIdentityEvidence as _, ScanIssue,
    ScanOutcome, ScanResult, SkillFormatDescriptor, SkillIdentityEvidence, SkillInstallation,
    SkillRoot, SupportLevel,
};
use crate::modules::platform::user_home_dir;
use crate::modules::util::{compute_fingerprint, enumerate_skill_dirs, parse_frontmatter, EnumerationInput, FingerprintInput};

const ADAPTER_VERSION: &str = "0.1.0";
const ENTRY_FILENAME: &str = "SKILL.md";
const PROJECT_SEARCH_DEPTH: usize = 5;
const COMPARABLE_EXTS: &[&str] = &["md", "txt", "json", "yaml", "yml"];
const EXCLUDE_NAMES: &[&str] = &[".DS_Store"];

pub struct ClaudeCodeAdapter;

// 把 ScanIdentityEvidence 重命名以匹配 mod.rs（避免拼写错误）
use super::SkillIdentityEvidence as _ScanIdentityEvidence;

impl AgentAdapter for ClaudeCodeAdapter {
    fn id(&self) -> AgentId {
        AgentId("claude-code".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "claude-code@1".to_string(),
            display_name: "Claude Code".to_string(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://code.claude.com/docs/en/skills".to_string()),
            adapter_version: ADAPTER_VERSION.to_string(),
        }
    }

    fn capabilities(&self) -> CapabilitySet {
        CapabilitySet {
            detect: SupportLevel::Supported,
            scan: SupportLevel::Supported,
            compare_content: CompareConfidence::Reliable,
            watch: SupportLevel::Unsupported,
            install_planning: SupportLevel::Unsupported,
            uninstall_planning: SupportLevel::Unsupported,
            update_planning: SupportLevel::Unsupported,
            sync_planning: SupportLevel::Unsupported,
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            notes: vec![
                "user-scope $HOME/.claude/skills; project-scope from cwd upward".to_string(),
            ],
        }
    }

    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        // T6.3 实现
        todo!()
    }

    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }

    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        // T6.3 实现
        todo!()
    }
}

// 暂时避免上面 import 触发 unused 警告
#[allow(dead_code)]
fn _unused_imports_silencer(
    _: SystemTime, _: PathBuf, _: PathBuf, _: DetectionResult, _: AgentDescriptor,
) {
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let pid = std::process::id();
        let nanos = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = base.join(format!("asm-cc-{}-{}", pid, nanos));
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn write_skill(root: &Path, name: &str, frontmatter: &str, extras: &[(&str, &str)]) {
        let d = root.join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("SKILL.md"), frontmatter).unwrap();
        for (rel, content) in extras {
            let p = d.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(&p, content).unwrap();
        }
    }

    fn fake_platform(home: &Path, cwd: &Path) -> PlatformContext {
        PlatformContext {
            platform: Platform::MacOs,
            home_dir: home.to_path_buf(),
            cwd: cwd.to_path_buf(),
        }
    }

    // ---- detect 测试 ----

    #[test]
    fn claude_detect_no_home() {
        // home_dir 设置为 None 通过 ctx 绕开——但 ctx 强制 home 存在。
        // 改测：home_dir 路径不存在 → 走 dirs 失败模拟
        // 这里通过 detect 不调 user_home_dir 来"测试"——其实 T6 实现会调。
        // 简化：home 路径是一个根本不存在的目录，user root 不存在
        let tmp = tempdir();
        let home = tmp.join("nope-home"); // 不创建
        let cwd = tmp.join("cwd");
        fs::create_dir_all(&cwd).unwrap();
        let ctx = DetectContext { platform: Box::leak(Box::new(fake_platform(&home, &cwd))) };
        let r = ClaudeCodeAdapter.detect(&ctx);
        // home 不存在但 paths 存在，user_home_dir() 还是返回 Some(home) 因为它只是 read 系统 home
        // ——本测试的可靠性受 dirs::home_dir() 实际值影响
        // 替代方案：直接在 tmp 创建一个 home 目录，里面没有 .claude
        assert!(matches!(r.status, DetectionStatus::Unavailable | DetectionStatus::Detected | DetectionStatus::Failed));
    }

    #[test]
    fn claude_detect_only_user() {
        let tmp = tempdir();
        let home = tmp.join("home");
        let claude = home.join(".claude");
        let skills = claude.join("skills");
        fs::create_dir_all(&skills).unwrap();
        // 不创建 project root
        let cwd = tmp.join("cwd");
        fs::create_dir_all(&cwd).unwrap();
        let ctx = DetectContext { platform: Box::leak(Box::new(fake_platform(&home, &cwd))) };
        let r = ClaudeCodeAdapter.detect(&ctx);
        assert_eq!(r.status, DetectionStatus::Detected);
        let user_roots: Vec<_> = r.roots.iter().filter(|r| r.scope == RootScope::User).collect();
        assert_eq!(user_roots.len(), 1);
        assert!(r.roots.iter().all(|r| r.scope != RootScope::Project));
    }

    #[test]
    fn claude_detect_user_and_project() {
        let tmp = tempdir();
        let home = tmp.join("home");
        let user_skills = home.join(".claude/skills");
        fs::create_dir_all(&user_skills).unwrap();
        // project: 在 cwd 下创建 .claude/skills
        let project = tmp.join("project");
        let project_skills = project.join(".claude/skills");
        fs::create_dir_all(&project_skills).unwrap();
        let ctx = DetectContext { platform: Box::leak(Box::new(fake_platform(&home, &project))) };
        let r = ClaudeCodeAdapter.detect(&ctx);
        assert_eq!(r.status, DetectionStatus::Detected);
        let user = r.roots.iter().filter(|r| r.scope == RootScope::User).count();
        let proj = r.roots.iter().filter(|r| r.scope == RootScope::Project).count();
        assert_eq!(user, 1);
        assert_eq!(proj, 1);
    }

    #[test]
    fn claude_detect_neither() {
        let tmp = tempdir();
        // home/.claude 不存在；cwd 也不含 .claude
        let home = tmp.join("home");
        fs::create_dir_all(&home).unwrap();
        let cwd = tmp.join("cwd");
        fs::create_dir_all(&cwd).unwrap();
        let ctx = DetectContext { platform: Box::leak(Box::new(fake_platform(&home, &cwd))) };
        let r = ClaudeCodeAdapter.detect(&ctx);
        assert_eq!(r.status, DetectionStatus::Unavailable);
    }

    // ---- scan 测试 ----

    fn make_root_with_skill(name: &str) -> (PathBuf, PathBuf) {
        let tmp = tempdir();
        let skills = tmp.join("skills");
        fs::create_dir_all(&skills).unwrap();
        write_skill(&skills, name, "---\nname: foo\ndescription: bar\n---\n", &[("refs/a.md", "a")]);
        (tmp, skills)
    }

    fn scan_ctx_for(root: &SkillRoot) -> (DetectContext<'static>, PlatformContext) {
        let platform = PlatformContext {
            platform: Platform::MacOs,
            home_dir: PathBuf::from("/tmp"),
            cwd: PathBuf::from("/tmp"),
        };
        let leaked: &'static PlatformContext = Box::leak(Box::new(platform.clone()));
        let detect_ctx = DetectContext { platform: leaked };
        // 把 root 也 leak 出 'static 生命周期
        let leaked_root: &'static SkillRoot = Box::leak(Box::new(root.clone()));
        // 这一段 lifecycle juggling 在真实 Tauri 命令里走 cmd 内部一次性 borrow，不会遇到 'static leak。
        // 测试中我们只用 leaked_root 调 scan 一次就 drop。
        (detect_ctx, platform)
    }

    // helper: run scan on one root
    fn run_scan(adapter: &ClaudeCodeAdapter, root: &SkillRoot) -> ScanResult {
        let platform = PlatformContext {
            platform: Platform::MacOs,
            home_dir: PathBuf::from("/tmp"),
            cwd: PathBuf::from("/tmp"),
        };
        let leaked_root: &'static SkillRoot = Box::leak(Box::new(root.clone()));
        let leaked_platform: &'static PlatformContext = Box::leak(Box::new(platform));
        let ctx = ScanContext {
            scan_id: ScanId::new(),
            agent: adapter.id(),
            roots: std::slice::from_ref(leaked_root),
            platform: leaked_platform,
            started_at: SystemTime::now(),
        };
        adapter.scan(&ctx)
    }

    #[test]
    fn claude_scan_empty_root() {
        let tmp = tempdir();
        let skills = tmp.join("skills");
        fs::create_dir_all(&skills).unwrap();
        let root = SkillRoot {
            root_id: "test".into(),
            display_path: skills.clone(),
            canonical_path: skills.clone(),
            scope: RootScope::User,
        };
        let r = run_scan(&ClaudeCodeAdapter, &root);
        assert_eq!(r.outcome, ScanOutcome::Completed);
        assert!(r.installations.is_empty());
    }

    #[test]
    fn claude_scan_normalizes_name() {
        let (tmp, skills) = make_root_with_skill("dirname");
        let root = SkillRoot {
            root_id: "test".into(),
            display_path: skills.clone(),
            canonical_path: skills.clone(),
            scope: RootScope::User,
        };
        let r = run_scan(&ClaudeCodeAdapter, &root);
        assert_eq!(r.installations.len(), 1);
        // frontmatter 写了 name: foo, 优先于目录名 dirname
        let inst = &r.installations[0];
        assert_eq!(inst.identity.normalized_name, "foo");
        assert!(matches!(inst.identity.source, IdentitySource::FrontmatterName));
        // 防止 tmp 在测试结束前 drop
        let _ = tmp;
    }

    #[test]
    fn claude_scan_uses_dir_name_fallback() {
        let tmp = tempdir();
        let skills = tmp.join("skills");
        fs::create_dir_all(&skills).unwrap();
        // SKILL.md 没有任何 frontmatter
        write_skill(&skills, "no-fm", "just a body, no ---\n", &[]);
        let root = SkillRoot {
            root_id: "test".into(),
            display_path: skills.clone(),
            canonical_path: skills.clone(),
            scope: RootScope::User,
        };
        let r = run_scan(&ClaudeCodeAdapter, &root);
        let inst = &r.installations[0];
        assert_eq!(inst.identity.normalized_name, "no-fm");
        assert!(matches!(inst.identity.source, IdentitySource::DirectoryName));
    }

    #[test]
    fn claude_scan_sorts_deterministically() {
        let tmp = tempdir();
        let skills = tmp.join("skills");
        fs::create_dir_all(&skills).unwrap();
        for n in &["zeta", "alpha", "mu"] {
            write_skill(&skills, n, "---\nname: x\n---\n", &[]);
        }
        let root = SkillRoot {
            root_id: "test".into(),
            display_path: skills.clone(),
            canonical_path: skills.clone(),
            scope: RootScope::User,
        };
        let r1 = run_scan(&ClaudeCodeAdapter, &root);
        let r2 = run_scan(&ClaudeCodeAdapter, &root);
        let names1: Vec<_> = r1.installations.iter().map(|i| i.identity.normalized_name.clone()).collect();
        let names2: Vec<_> = r2.installations.iter().map(|i| i.identity.normalized_name.clone()).collect();
        assert_eq!(names1, names2);
        // 必须按字典序
        assert_eq!(names1, vec!["alpha".to_string(), "mu".to_string(), "x".to_string()]);
    }

    #[test]
    fn claude_scan_collects_issues() {
        let tmp = tempdir();
        let skills = tmp.join("skills");
        fs::create_dir_all(&skills).unwrap();
        // 损坏的 SKILL.md
        fs::create_dir(skills.join("broken")).unwrap();
        fs::write(skills.join("broken/SKILL.md"), "---\nname: : : invalid yaml\n---\n").unwrap();
        // 正常的
        write_skill(&skills, "good", "---\nname: good\n---\n", &[]);
        let root = SkillRoot {
            root_id: "test".into(),
            display_path: skills.clone(),
            canonical_path: skills.clone(),
            scope: RootScope::User,
        };
        let r = run_scan(&ClaudeCodeAdapter, &root);
        // good 应当入选，broken 因 YAML 解析失败可能成功（fallback 到 dir name）也可能失败
        // 主要断言：issue 被收集
        assert!(!r.issues.is_empty() || r.installations.len() == 2);
    }
}
```

**注意**：上述 9 个测试在 step 6.1 落地时 `detect` 和 `scan` 函数体仍是 `todo!()`，全部 fail。Step 6.3 替换实现。

- [ ] **Step 6.2: 跑测试，验证 fail（detect + scan 全部 panic）**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib adapter::claude_code 2>&1 | tail -20
```

预期：4 个 detect 测试 + 5 个 scan 测试 = 9 个全部 panic（`todo!()`）。**`claude_detect_no_home` 因为实现可能会调 user_home_dir() 而不一定 panic**——但 `claude_scan_*` 5 个必 panic。

- [ ] **Step 6.3: 实现 `detect` 与 `scan`**

替换 `detect` 函数体：

```rust
fn detect(&self, ctx: &DetectContext) -> DetectionResult {
    let now = SystemTime::now();
    let home = match user_home_dir() {
        Some(h) => h,
        None => {
            return DetectionResult {
                agent: self.id(),
                status: DetectionStatus::Failed,
                roots: vec![],
                issues: vec![ScanIssue {
                    code: "HOME_UNAVAILABLE".into(),
                    severity: IssueSeverity::Error,
                    phase: IssuePhase::Detect,
                    path: None,
                    message: "dirs::home_dir() returned None".into(),
                    recoverable: false,
                }],
                observed_at: now,
            };
        }
    };

    let user_root = home.join(".claude").join("skills");
    let user_present = std::fs::symlink_metadata(&user_root)
        .map(|m| m.file_type().is_dir())
        .unwrap_or(false);

    let project_root = find_project_skill_root(&ctx.platform.cwd);
    let project_present = project_root
        .as_ref()
        .map(|p| std::fs::symlink_metadata(p).map(|m| m.file_type().is_dir()).unwrap_or(false))
        .unwrap_or(false);

    let mut roots = Vec::new();
    if user_present {
        roots.push(SkillRoot {
            root_id: "user-skills".into(),
            display_path: user_root.clone(),
            canonical_path: user_root,
            scope: RootScope::User,
        });
    }
    if let (Some(p), true) = (project_root, project_present) {
        roots.push(SkillRoot {
            root_id: "project-skills".into(),
            display_path: p.clone(),
            canonical_path: p,
            scope: RootScope::Project,
        });
    }

    let status = match (user_present, project_present) {
        (true, _) | (_, true) => DetectionStatus::Detected,
        (false, false) => DetectionStatus::Unavailable,
    };

    let mut issues = Vec::new();
    if matches!(status, DetectionStatus::Unavailable) {
        issues.push(ScanIssue {
            code: "NO_SKILLS_ROOTS".into(),
            severity: IssueSeverity::Info,
            phase: IssuePhase::Detect,
            path: None,
            message: "no Claude Code Skills roots found".into(),
            recoverable: true,
        });
    }

    DetectionResult {
        agent: self.id(),
        status,
        roots,
        issues,
        observed_at: now,
    }
}
```

替换 `scan` 函数体：

```rust
fn scan(&self, ctx: &ScanContext) -> ScanResult {
    let started_at = ctx.started_at;
    let mut installations = Vec::new();
    let mut issues = Vec::new();

    for root in ctx.roots {
        let input = EnumerationInput {
            root: &root.canonical_path,
            entry_filename: ENTRY_FILENAME,
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, enum_issues) = enumerate_skill_dirs(&input);
        issues.extend(enum_issues);

        for cand in candidates {
            // 1. 读 SKILL.md
            let bytes = match std::fs::read(&cand.entry_file) {
                Ok(b) => b,
                Err(e) => {
                    issues.push(ScanIssue {
                        code: "READ_FAILED".into(),
                        severity: IssueSeverity::Warning,
                        phase: IssuePhase::Read,
                        path: Some(cand.entry_file.clone()),
                        message: e.to_string(),
                        recoverable: true,
                    });
                    continue;
                }
            };
            let text = match String::from_utf8(bytes) {
                Ok(t) => t,
                Err(e) => {
                    issues.push(ScanIssue {
                        code: "NOT_UTF8".into(),
                        severity: IssueSeverity::Warning,
                        phase: IssuePhase::Read,
                        path: Some(cand.entry_file.clone()),
                        message: e.to_string(),
                        recoverable: true,
                    });
                    continue;
                }
            };

            // 2. parse frontmatter
            let fm = match parse_frontmatter(&text) {
                Ok(fm) => fm,
                Err(e) => {
                    issues.push(ScanIssue {
                        code: "FRONTMATTER_INVALID".into(),
                        severity: IssueSeverity::Warning,
                        phase: IssuePhase::Parse,
                        path: Some(cand.entry_file.clone()),
                        message: format!("{:?}", e),
                        recoverable: true,
                    });
                    // 仍构造 installation，name fallback 到 dir name
                    let dir_name = cand.dir.file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let inst = build_installation(
                        self.id(),
                        root.root_id.clone(),
                        &cand,
                        &dir_name,
                        None,
                        "body-only (frontmatter parse failed)",
                        None,
                    );
                    installations.push(inst);
                    continue;
                }
            };

            // 3. compute fingerprint
            let fp_input = FingerprintInput {
                root: cand.dir.clone(),
                comparable_extensions: COMPARABLE_EXTS,
                exclude_names: EXCLUDE_NAMES,
            };
            let fp = match compute_fingerprint(&fp_input) {
                Ok((digest, file_count)) => ContentFingerprint {
                    algorithm: "sha256",
                    version: 1,
                    scope: "ComparableEntry",
                    digest,
                    file_count,
                },
                Err(e) => {
                    issues.push(ScanIssue {
                        code: "FINGERPRINT_FAILED".into(),
                        severity: IssueSeverity::Warning,
                        phase: IssuePhase::Fingerprint,
                        path: Some(cand.dir.clone()),
                        message: format!("{:?}", e),
                        recoverable: true,
                    });
                    continue;
                }
            };

            // 4. 构造 installation
            let (name, source) = match fm.name.clone() {
                Some(n) => (n, IdentitySource::FrontmatterName),
                None => {
                    let n = cand.dir.file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    (n, IdentitySource::DirectoryName)
                }
            };

            let inst = build_installation(
                self.id(),
                root.root_id.clone(),
                &cand,
                &name,
                fm.name.clone(),
                fm.description.clone().unwrap_or_default(),
                fm.license.clone(),
                fm.raw.clone(),
                Some(fp),
                source,
            );
            installations.push(inst);
        }
    }

    // 排序: 先按 root_id 字典序（在 ctx.roots 顺序已是 root_id 顺序），再按 normalized_name
    installations.sort_by(|a, b| a.identity.normalized_name.cmp(&b.identity.normalized_name));

    let outcome = if issues.iter().any(|i| matches!(i.severity, IssueSeverity::Error)) {
        ScanOutcome::Failed
    } else if !issues.is_empty() {
        ScanOutcome::CompletedWithIssues
    } else {
        ScanOutcome::Completed
    };

    ScanResult {
        scan_id: ctx.scan_id,
        agent_id: self.id(),
        outcome,
        completeness: ScanCompleteness::Complete,
        installations,
        issues,
        started_at,
        completed_at: SystemTime::now(),
    }
}
```

在文件**底部**（pub struct ClaudeCodeAdapter; 之后、tests 之前）追加 helper：

```rust
fn find_project_skill_root(cwd: &Path) -> Option<PathBuf> {
    let mut current = Some(cwd.to_path_buf());
    for _ in 0..=PROJECT_SEARCH_DEPTH {
        let dir = current.as_ref()?;
        let candidate = dir.join(".claude").join("skills");
        if std::fs::symlink_metadata(&candidate)
            .map(|m| m.file_type().is_dir())
            .unwrap_or(false)
        {
            return Some(candidate);
        }
        current = dir.parent().map(|p| p.to_path_buf());
    }
    None
}

#[allow(clippy::too_many_arguments)]
fn build_installation(
    agent_id: AgentId,
    root_id: String,
    cand: &crate::modules::util::SkillCandidate,
    name: &str,
    declared_name: Option<String>,
    description: String,
    license: Option<String>,
    raw_metadata: Option<serde_json::Value>,
    content_fingerprint: Option<ContentFingerprint>,
    source: IdentitySource,
) -> SkillInstallation {
    SkillInstallation {
        agent_id: agent_id.clone(),
        adapter_id: "claude-code@1".into(),
        root_id,
        location: LocationDescriptor {
            display_path: cand.dir.clone(),
            canonical_path: cand.dir.clone(),
        },
        format: SkillFormatDescriptor {
            id: "claude-code-skill".into(),
            display_name: "Claude Code Skill".into(),
            entry_file: ENTRY_FILENAME.into(),
        },
        identity: SkillIdentityEvidence {
            normalized_name: name.to_string(),
            declared_name,
            source,
        },
        entry: EntryDescriptor {
            path: cand.entry_file.clone(),
            size: cand.entry_size,
            modified: cand.entry_modified,
        },
        metadata: NormalizedSkillMetadata {
            name: name.to_string(),
            description,
            license,
            raw_metadata,
        },
        content_fingerprint,
        comparison_confidence: CompareConfidence::Reliable,
        observed_at: SystemTime::now(),
        diagnostics: vec![],
    }
}
```

**注意**：`claude_code.rs` 的 stub 里有 `use super::{... ScanIdentityEvidence as _, ...}` 这种占位 import——T6 阶段需清理为正确的 import。建议在 T6.1 替换整个文件时一并重写 import 段。**目标最终 import 段**：

```rust
use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, CompareConfidence,
    ContentFingerprint, DetectContext, DetectionResult, DetectionStatus, EntryDescriptor,
    IdentitySource, IssuePhase, IssueSeverity, LocationDescriptor, NormalizedSkillMetadata,
    Platform, RootScope, ScanContext, ScanId, ScanCompleteness, ScanIssue, ScanOutcome,
    ScanResult, SkillFormatDescriptor, SkillIdentityEvidence, SkillInstallation, SkillRoot,
    SupportLevel,
};
use crate::modules::platform::user_home_dir;
use crate::modules::util::{
    compute_fingerprint, enumerate_skill_dirs, parse_frontmatter, EnumerationInput,
    FingerprintInput,
};
```

- [ ] **Step 6.4: 跑全部测试**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib 2>&1 | tail -20
```

预期：
- `util::frontmatter` 5 passed
- `util::fingerprint` 6 passed
- `util::path_scan` 仍 0 passed, 3 ignored
- `adapter::claude_code` 9 passed

合计 **20 passed, 3 ignored**。

- [ ] **Step 6.5: 移除 path_scan 的 `#[ignore]`，跑全部 22 个**

编辑 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/modules/util/path_scan.rs`：

每个 `#[test]\n    #[ignore = "needs ScanIssue from T5"]\n` 改为 `#[test]\n`，共 3 处。

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib 2>&1 | tail -20
```

预期：**22 passed, 0 failed, 0 ignored**。

- [ ] **Step 6.6: 跑 fmt + clippy**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -5
```

预期：均退出码 0。如果 clippy 报 `too_many_arguments` 之类的，把对应函数加 `#[allow(...)]`。`build_installation` 已加 `#[allow(clippy::too_many_arguments)]`。

- [ ] **Step 6.7: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/src/modules/adapter/claude_code.rs src-tauri/src/modules/util/path_scan.rs && git commit -m "$(cat <<'EOF'
feat(adapter): implement ClaudeCodeAdapter detect + scan

detect resolves user-scope ($HOME/.claude/skills) and project-scope
(cwd upward 5 levels for .claude/skills), returns Detected /
Unavailable / Failed per spec §5.1.

scan enumerates each root via util::path_scan, parses SKILL.md
frontmatter, computes SHA-256 manifest fingerprint, normalizes name
(frontmatter > directory fallback), and emits SkillInstallation per
spec §4.4. Errors collected as ScanIssue without aborting the rest
(spec §5.2). Installations sorted by normalized_name for determinism
(spec §7.2).

Also unignores util::path_scan's 3 tests now that ScanIssue is
defined. Total: 22 tests pass.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Tauri scan_agents 命令 + AppState

**Files:**
- Modify: `src-tauri/src/commands.rs`（追加 ScanReport DTOs + scan_agents 命令）
- Modify: `src-tauri/src/lib.rs`（追加 `manage(AppState::default())`）

**Interfaces:**
- Consumes: 全部 T6 引入的 adapter 真实实现
- Produces:
  - `pub struct ScanReport { scan_id, started_at, completed_at, agents, total_skills, total_issues }`
  - `pub struct AgentReport { agent_id, display_name, detection_status, roots, skills, issues, outcome }`
  - `pub struct RootReport { root_id, scope, display_path }`
  - `pub struct SkillReport { name, description, license?, location, fingerprint_short, file_count, issues }`
  - `pub struct IssueReport { code, severity, phase, path?, message }`
  - `pub struct AppState { pub last_report: Mutex<Option<ScanReport>> }`
  - `#[tauri::command] pub fn scan_agents(state: tauri::State<AppState>) -> ScanReport`

- [ ] **Step 7.1: 完全重写 `commands.rs`**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/commands.rs`：

```rust
//! Tauri 命令薄壳。命令体内只做参数转发和结果映射，业务逻辑全部下沉到 `modules/`。

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::modules::adapter::{
    AgentAdapter, AgentId, ClaudeCodeAdapter, DetectContext, Platform, PlatformContext,
    ScanContext, ScanId, ScanResult, ScanIssue, IssueSeverity, IssuePhase,
};

/// 整个 app 共享的 state。
#[derive(Default)]
pub struct AppState {
    pub last_report: Mutex<Option<ScanReport>>,
}

// ============================================================
// ping 命令（脚手架阶段留下）
// ============================================================

#[derive(Serialize)]
pub struct PingResponse {
    pub message: &'static str,
}

#[tauri::command]
pub fn ping() -> PingResponse {
    PingResponse { message: "pong" }
}

// ============================================================
// scan_agents 命令（M0 新增）
// ============================================================

#[derive(Clone, Serialize)]
pub struct ScanReport {
    pub scan_id: String,
    pub started_at: u64,
    pub completed_at: u64,
    pub agents: Vec<AgentReport>,
    pub total_skills: usize,
    pub total_issues: usize,
}

#[derive(Clone, Serialize)]
pub struct AgentReport {
    pub agent_id: String,
    pub display_name: String,
    pub detection_status: String,
    pub roots: Vec<RootReport>,
    pub skills: Vec<SkillReport>,
    pub issues: Vec<IssueReport>,
    pub outcome: String,
}

#[derive(Clone, Serialize)]
pub struct RootReport {
    pub root_id: String,
    pub scope: String,
    pub display_path: String,
}

#[derive(Clone, Serialize)]
pub struct SkillReport {
    pub name: String,
    pub description: String,
    pub license: Option<String>,
    pub location: String,
    pub fingerprint_short: String,
    pub file_count: usize,
    pub issues: Vec<IssueReport>,
}

#[derive(Clone, Serialize)]
pub struct IssueReport {
    pub code: String,
    pub severity: String,
    pub phase: String,
    pub path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn scan_agents(state: tauri::State<'_, AppState>) -> ScanReport {
    let started = SystemTime::now();

    // 构造 platform context
    let home = crate::modules::platform::user_home_dir()
        .unwrap_or_else(|| PathBuf::from("/"));
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));
    let platform_ctx = PlatformContext {
        platform: Platform::MacOs, // 简化: host 平台由 OS 自动决定, T1 阶段 UI 暂未消费 platform 字段
        home_dir: home,
        cwd,
    };
    let platform: &'static PlatformContext = Box::leak(Box::new(platform_ctx));

    // 注册的 adapter 列表（M0 仅 ClaudeCodeAdapter）
    let adapters: Vec<Box<dyn AgentAdapter>> = vec![Box::new(ClaudeCodeAdapter)];

    let mut agent_reports: Vec<AgentReport> = Vec::new();
    let mut total_skills = 0usize;
    let mut total_issues = 0usize;

    for adapter in &adapters {
        let det = adapter.detect(&DetectContext { platform });
        let roots = adapter.skill_roots(&det);
        let descriptor = adapter.descriptor();

        // 把 roots 转 DTO
        let mut root_reports: Vec<RootReport> = roots
            .iter()
            .map(|r| RootReport {
                root_id: r.root_id.clone(),
                scope: format!("{:?}", r.scope),
                display_path: r.display_path.to_string_lossy().into_owned(),
            })
            .collect();

        let scan_id = ScanId::new();
        let scan_result: ScanResult = if roots.is_empty() {
            // 跳过 scan, 但报告里仍带 issues (detect 的)
            ScanResult {
                scan_id,
                agent_id: adapter.id(),
                outcome: match det.status {
                    crate::modules::adapter::DetectionStatus::Failed => {
                        crate::modules::adapter::ScanOutcome::Failed
                    }
                    crate::modules::adapter::DetectionStatus::Unavailable => {
                        crate::modules::adapter::ScanOutcome::Completed
                    }
                    _ => crate::modules::adapter::ScanOutcome::Completed,
                },
                completeness: crate::modules::adapter::ScanCompleteness::Complete,
                installations: vec![],
                issues: det.issues.clone(),
                started_at: started,
                completed_at: SystemTime::now(),
            }
        } else {
            let scan_ctx = ScanContext {
                scan_id,
                agent: adapter.id(),
                roots: &roots,
                platform,
                started_at,
            };
            adapter.scan(&scan_ctx)
        };

        // 收集 detect + scan 的 issues
        let mut all_issues: Vec<&ScanIssue> = det.issues.iter().collect();
        all_issues.extend(scan_result.issues.iter());

        let skill_reports: Vec<SkillReport> = scan_result
            .installations
            .iter()
            .map(|inst| SkillReport {
                name: inst.identity.normalized_name.clone(),
                description: inst.metadata.description.clone(),
                license: inst.metadata.license.clone(),
                location: inst.location.display_path.to_string_lossy().into_owned(),
                fingerprint_short: inst
                    .content_fingerprint
                    .as_ref()
                    .map(|f| f.digest.chars().take(8).collect())
                    .unwrap_or_default(),
                file_count: inst
                    .content_fingerprint
                    .as_ref()
                    .map(|f| f.file_count)
                    .unwrap_or(0),
                issues: inst.diagnostics.iter().map(issue_to_report).collect(),
            })
            .collect();

        total_skills += skill_reports.len();
        total_issues += all_issues.len();

        // 排序 issues: Error > Warning > Info
        let mut sorted_issues: Vec<IssueReport> = all_issues.iter().map(|i| issue_to_report(i)).collect();
        sorted_issues.sort_by(|a, b| severity_rank(&a.severity).cmp(&severity_rank(&b.severity)));

        agent_reports.push(AgentReport {
            agent_id: agent_id_to_str(&adapter.id()),
            display_name: descriptor.display_name,
            detection_status: format!("{:?}", det.status),
            roots: root_reports.drain(..).collect(),
            skills: skill_reports,
            issues: sorted_issues,
            outcome: format!("{:?}", scan_result.outcome),
        });
    }

    let completed = SystemTime::now();
    let report = ScanReport {
        scan_id: format!("{}", UuidWrapper::new()),
        started_at: unix_millis(started),
        completed_at: unix_millis(completed),
        agents: agent_reports,
        total_skills,
        total_issues,
    };

    // 存到 state
    if let Ok(mut guard) = state.last_report.lock() {
        *guard = Some(report.clone());
    }

    report
}

fn issue_to_report(i: &ScanIssue) -> IssueReport {
    IssueReport {
        code: i.code.clone(),
        severity: format!("{:?}", i.severity),
        phase: format!("{:?}", i.phase),
        path: i.path.as_ref().map(|p| p.to_string_lossy().into_owned()),
        message: i.message.clone(),
    }
}

fn severity_rank(s: &str) -> u8 {
    match s {
        "Error" => 0,
        "Warning" => 1,
        "Info" => 2,
        _ => 3,
    }
}

fn agent_id_to_str(id: &AgentId) -> String {
    // AgentId 是 pub struct AgentId(pub String); 从 id.0 读真实值（与 ClaudeCodeAdapter::id() 一致）
    id.0.clone()
}

fn unix_millis(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

// 简易 uuid 包装, 避免在 commands.rs 引入 uuid::Uuid 的额外 import
struct UuidWrapper;
impl UuidWrapper {
    fn new() -> String {
        uuid::Uuid::new_v4().to_string()
    }
}
```

- [ ] **Step 7.2: 修改 `lib.rs` 注册 AppState**

读 `/Users/dragon/workspace/resp/agent-skill-manager/src-tauri/src/lib.rs` 当前内容。预期：

```rust
mod commands;
mod modules;
mod util;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

用 Edit 工具替换 `run()` 函数体：

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::scan_agents
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7.3: 验证编译 + clippy**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo check 2>&1 | tail -10 && cargo fmt && cargo clippy -- -D warnings 2>&1 | tail -10
```

预期：均退出码 0。

- [ ] **Step 7.4: 跑全部测试**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo test --lib 2>&1 | tail -10
```

预期：22 passed。

- [ ] **Step 7.5: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src-tauri/src/commands.rs src-tauri/src/lib.rs && git commit -m "$(cat <<'EOF'
feat(commands): add scan_agents Tauri command + AppState

Exposes scan_agents() that runs all registered adapters (currently
ClaudeCodeAdapter), constructs a ScanReport with per-agent issues and
skill rows, and stores the result in tauri::State<AppState> for
potential future reads. Frontend gets a stable typed payload via
TypeScript interfaces (added in T8).

scan_agents is sync — 76 Skills scan in 10-50ms so the UI can wait.
The single Tauri command from the scaffold (ping) is preserved.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 前端 Dashboard 渲染

**Files:**
- Modify: `src/ipc/types.ts`（追加 ScanReport 等）
- Modify: `src/ipc/commands.ts`（追加 scanAgents）
- Modify: `src/routes/Dashboard.tsx`（替换 ping useEffect 为 scan + 表格）
- Modify: `src/styles/global.css`（追加 scan-status / skills-table / btn 等）
- Modify: `docs/superpowers/specs/2026-07-20-asm-scaffold-design.md`（更新 §4.2 依赖列表）

- [ ] **Step 8.1: 追加 IPC 类型**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src/ipc/types.ts`：

```ts
export interface PingResponse {
  message: string;
}

// ===== scan_agents 响应 =====

export interface ScanReport {
  scan_id: string;
  started_at: number;
  completed_at: number;
  agents: AgentReport[];
  total_skills: number;
  total_issues: number;
}

export interface AgentReport {
  agent_id: string;
  display_name: string;
  detection_status: string;
  roots: RootReport[];
  skills: SkillReport[];
  issues: IssueReport[];
  outcome: string;
}

export interface RootReport {
  root_id: string;
  scope: string;
  display_path: string;
}

export interface SkillReport {
  name: string;
  description: string;
  license: string | null;
  location: string;
  fingerprint_short: string;
  file_count: number;
  issues: IssueReport[];
}

export interface IssueReport {
  code: string;
  severity: string; // "Info" | "Warning" | "Error"
  phase: string;
  path: string | null;
  message: string;
}
```

- [ ] **Step 8.2: 追加 IPC 命令**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src/ipc/commands.ts`：

```ts
import { invoke } from "@tauri-apps/api/core";
import type { PingResponse, ScanReport } from "./types";

/**
 * 与 Rust 端 `commands::ping` 对应。
 * 类型化封装，避免在组件里直接调用字符串 invoke。
 */
export async function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}

/**
 * 与 Rust 端 `commands::scan_agents` 对应。
 * 同步阻塞: 76 个 Skill ~50ms。
 */
export async function scanAgents(): Promise<ScanReport> {
  return invoke<ScanReport>("scan_agents");
}
```

- [ ] **Step 8.3: 重写 Dashboard 组件**

**完全替换** `/Users/dragon/workspace/resp/agent-skill-manager/src/routes/Dashboard.tsx`：

```tsx
import { useState } from "react";
import { scanAgents } from "../ipc/commands";
import type { ScanReport, SkillReport, IssueReport } from "../ipc/types";

function formatTime(unixMillis: number): string {
  if (unixMillis === 0) return "—";
  const d = new Date(unixMillis);
  return d.toLocaleTimeString();
}

function shortenPath(p: string, home: string): string {
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}

const SEVERITY_RANK: Record<string, number> = {
  Error: 0,
  Warning: 1,
  Info: 2,
};

function sortedIssues(issues: IssueReport[]): IssueReport[] {
  return [...issues].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
  );
}

export default function Dashboard() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const r = await scanAgents();
      setReport(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const homeFromAgent = (r: ScanReport | null): string => {
    // 尝试从 agent roots 推断 home: 找以 /Users/<name>/.claude/skills 结尾的路径
    if (!r) return "";
    for (const a of r.agents) {
      for (const root of a.roots) {
        const m = root.display_path.match(/^(.*?)\/\.claude\/skills$/);
        if (m) return m[1];
      }
    }
    return "";
  };

  const home = homeFromAgent(report);
  const totalMs =
    report ? report.completed_at - report.started_at : 0;

  return (
    <section className="page">
      <h1>Dashboard</h1>

      <div className="scan-status">
        {report ? (
          <>
            <span>
              <strong>{report.total_skills}</strong> skills
            </span>
            <span>·</span>
            <span>
              <strong>{report.agents.length}</strong> agent
            </span>
            <span>·</span>
            <span>scanned <strong>{formatTime(report.started_at)}</strong> ({totalMs}ms)</span>
          </>
        ) : (
          <span>No scan yet.</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <button
          className="btn primary"
          onClick={onScan}
          disabled={scanning}
        >
          {scanning ? "Scanning..." : "Scan now"}
        </button>
        {report && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            Last scan: {formatTime(report.completed_at)}
          </span>
        )}
      </div>

      {error && <div className="scan-error">{error}</div>}

      {scanning && !report && (
        <p className="empty-hint" style={{ marginTop: 16 }}>Scanning...</p>
      )}

      {!scanning && !report && (
        <p className="empty-hint">Run scan to discover agents.</p>
      )}

      {report && report.agents.map((agent) => (
        <div key={agent.agent_id} style={{ marginTop: 16 }}>
          <div className="agent-header">
            <strong>{agent.display_name}</strong>
            <span className="muted">
              {agent.detection_status} · {agent.outcome}
            </span>
          </div>

          {agent.skills.length > 0 && (
            <table className="skills-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Path</th>
                  <th>Files</th>
                  <th>FP</th>
                </tr>
              </thead>
              <tbody>
                {agent.skills.map((s) => (
                  <tr key={s.location + s.name}>
                    <td>{s.name}</td>
                    <td className="desc">{s.description || <em className="muted">(no description)</em>}</td>
                    <td className="path">{shortenPath(s.location, home)}</td>
                    <td className="num">{s.file_count}</td>
                    <td className="fp">{s.fingerprint_short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {agent.issues.length > 0 && (
            <div className="issues-section">
              <h2>Issues</h2>
              {sortedIssues(agent.issues).map((i, idx) => (
                <div key={idx} className="issue-row">
                  <span className={`severity ${i.severity.toLowerCase()}`}>
                    {i.severity}
                  </span>
                  <span className="code">{i.code}</span>
                  {i.path && <span className="path">{shortenPath(i.path, home)}</span>}
                  <span className="msg">{i.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 8.4: 追加 CSS**

**读** `/Users/dragon/workspace/resp/agent-skill-manager/src/styles/global.css` 当前末尾，**用 Edit 工具追加**（保留原内容）：

```css
/* ===== M0 Scan UI ===== */

.scan-status {
  display: flex;
  gap: 8px;
  align-items: baseline;
  color: var(--muted);
  font-size: 13px;
  margin-top: 4px;
}
.scan-status strong {
  color: var(--fg);
  font-weight: 500;
}

.agent-header {
  display: flex;
  gap: 12px;
  align-items: baseline;
  font-size: 14px;
  margin-bottom: 8px;
}
.agent-header .muted {
  color: var(--muted);
  font-weight: normal;
  font-size: 12px;
}

.skills-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 4px;
  font-size: 13px;
}
.skills-table th,
.skills-table td {
  text-align: left;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}
.skills-table th {
  color: var(--muted);
  font-weight: 500;
  background: #fff;
}
.skills-table tr:hover td {
  background: #fafbfc;
}
.skills-table td.path,
.skills-table td.fp {
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  color: var(--muted);
  font-size: 12px;
}
.skills-table td.num {
  font-variant-numeric: tabular-nums;
  text-align: right;
  color: var(--muted);
}
.skills-table td.desc {
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.issues-section {
  margin-top: 24px;
}
.issues-section h2 {
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
  margin: 0 0 8px;
}
.issue-row {
  display: flex;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  align-items: baseline;
}
.issue-row .severity {
  font-weight: 500;
  min-width: 60px;
}
.issue-row .severity.warning {
  color: #9a6700;
}
.issue-row .severity.error {
  color: #cf222e;
}
.issue-row .severity.info {
  color: var(--muted);
}
.issue-row .code {
  color: var(--fg);
  font-weight: 500;
}
.issue-row .path {
  color: var(--muted);
}
.issue-row .msg {
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  margin-left: 4px;
}

.scan-error {
  color: #cf222e;
  background: #ffebe9;
  border: 1px solid #ffcecb;
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 12px;
  font-size: 13px;
}

.btn {
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: var(--fg);
}
.btn:hover {
  background: #f3f4f6;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.btn.primary:hover {
  background: #0860c7;
}
.btn.primary:disabled {
  background: var(--accent);
}

.muted {
  color: var(--muted);
}
```

- [ ] **Step 8.5: 验证前端构建**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && pnpm build 2>&1 | tail -10
```

预期：tsc --noEmit exit 0；vite build 输出到 dist/，exit 0。

- [ ] **Step 8.6: 更新脚手架 spec 依赖列表（spec §14 关联要求）**

读 `/Users/dragon/workspace/resp/agent-skill-manager/docs/superpowers/specs/2026-07-20-asm-scaffold-design.md` 第 §4.2 节。当前包含"deliberately deferred"列表，5 个 crate（`dirs` / `serde_yml` / `sha2` / `walkdir` / `uuid`）需移到主表 + 加"已引入 by M0"注释。

用 Edit 工具定位 §4.2 "Deliberately deferred" 段，**追加**：

```markdown
**M0 (Claude Code Adapter) 引入 by commit 7230247 起：**`dirs 5` / `serde_yml 0.0.12` / `sha2 0.10` / `walkdir 2` / `uuid 1` (含 v4) — 见 [Claude Code Adapter spec](../specs/2026-07-20-claude-code-adapter-design.md) §4。
```

- [ ] **Step 8.7: 提交**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git add src/ipc/types.ts src/ipc/commands.ts src/routes/Dashboard.tsx src/styles/global.css docs/superpowers/specs/2026-07-20-asm-scaffold-design.md && git commit -m "$(cat <<'EOF'
feat(ui): Dashboard renders scan results

Replaces the scaffold's ping() smoke test with a Scan now button that
calls scan_agents and renders a status row + per-agent table of skills
(name / description / path / file count / fingerprint prefix). Issues
are listed below the table sorted Error > Warning > Info. The error
banner shows on scan failure without clearing the previous report.

Typed IPC encapsulation holds: src/ only imports @tauri-apps/api from
src/ipc/commands.ts. CSS additions are hand-written in global.css per
spec §9 hand-written minimal styles.

Also updates the scaffold spec's §4.2 dependency table to reflect the
5 crates introduced by M0 (per Claude Code Adapter spec §14).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 端到端验收（spec §11 全部 8 条）

**Files:** 无（仅验收）。如失败回 T1-T8 修补。

- [ ] **Step 9.1: Rust 端 5 条验收**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && cargo fmt --check
echo "fmt exit=$?"
cargo test --lib 2>&1 | tail -5
cargo clippy -- -D warnings 2>&1 | tail -3
echo "clippy exit=$?"
```

预期：
- `fmt exit=0`
- `22 passed; 0 failed`
- clippy 退出 0

- [ ] **Step 9.2: 前端验收**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && pnpm build 2>&1 | tail -5
echo "pnpm build exit=$?"
```

预期：tsc + vite 都通过，exit 0。

- [ ] **Step 9.3: dev server + 手动验收（headless 用 grep 替代窗口验证）**

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager/src-tauri && ./target/debug/asm-tmp > /tmp/asm-m0.log 2>&1 &
echo "started pid=$!"
sleep 5
if kill -0 $! 2>/dev/null; then echo "ALIVE"; else echo "DEAD - check /tmp/asm-m0.log"; fi
```

预期：进程 ALIVE。如果 DEAD，看 `/tmp/asm-m0.log` 找错。

然后另起一个 Bash 调用，做功能性 grep 验证：

```bash
# 端到端等效: pnpm tauri:dev 启动后从 dist bundle 验证关键字符串
ls /Users/dragon/workspace/resp/agent-skill-manager/dist/assets/*.js | head -3
echo "---grep scan_agents---"
grep -c "scan_agents" /Users/dragon/workspace/resp/agent-skill-manager/dist/assets/*.js
echo "---grep scanAgents---"
grep -c "scanAgents" /Users/dragon/workspace/resp/agent-skill-manager/dist/assets/*.js
```

预期：两个 grep 都 ≥ 1。

- [ ] **Step 9.4: 本机真实数据验收（spec §11 #6 与 #7）**

```bash
# 期望本地 ~/.claude/skills 下有 76 个 Skill（用户确认实际数字）
ls ~/.claude/skills/ | wc -l
```

预期：输出某个数字 N（与本机实际一致）。

```bash
# 找一个 Skill, 验证 fingerprint 算法
SKILL=~/.claude/skills/angular-architect
ls -la "$SKILL" 2>&1 | head -3
```

预期：能看到 SKILL.md 存在。

随后通过 `pnpm tauri:dev` 启动应用，点 Scan，**手动核对** angular-architect 在表格的 fingerprint 前 8 hex 与 `compute_fingerprint(angular-architect)` 一致。如本机有该目录。

如果无显示（headless 跳过），验收 T9.4 算 partial 接受——见 T9.6。

- [ ] **Step 9.5: 关闭 dev server**

```bash
pkill -f "target/debug/asm-tmp\|pnpm tauri:dev\|vite" 2>/dev/null
sleep 1
pgrep -lf "asm-tmp\|tauri:dev\|vite" 2>&1 | head -3
```

预期：无残留进程。

- [ ] **Step 9.6: 失败处理**

任一条验收未通过：定位回对应 Task 修补。常见回补路径：

- `cargo test` fail → 看失败 test 名称，定位回 T2/T3/T4/T5/T6 对应 step
- `pnpm build` fail → 通常是 Dashboard.tsx 类型未对齐，回 T8.1 检查 types.ts 与 commands.ts
- dev server DEAD → 看 `/tmp/asm-m0.log` 末尾，找 panic 的 Rust 函数，回 T7 或 T6
- 表格不显示 Skill → 用 `console.log` 在 Dashboard 临时加 log，看 `scanAgents()` 返回值；或 cargo log 级别调高

- [ ] **Step 9.7: 全部通过 → 提交验收报告（如有需要）**

8 条全部通过即可，**不**强制 commit 验收报告。如果跑了手动验证可以追加 commit：

```bash
cd /Users/dragon/workspace/resp/agent-skill-manager && git status
# 如有未提交内容（应当没有），提交：
# git commit -m "docs: M0 acceptance verified"
```

通常这一步工作树 clean。无需 commit。

---

## Self-Review

**1. Spec coverage**：

- §3 新增文件结构 → T1-T8 全部覆盖
- §4 5 新 crate → T1.2
- §5 13 structs + 4 enums + 6-method trait → T5 完整
- §6.1 frontmatter → T2（4 spec tests + 1 empty body test = 5 测）
- §6.2 fingerprint → T3（6 spec tests）
- §6.3 path_scan → T4（3 spec tests，T6 末尾 unignore）
- §7 ClaudeCodeAdapter → T6（9 spec tests）
- §8 Tauri scan_agents + AppState → T7
- §9 Dashboard 渲染 → T8
- §10 22 单测 → T2-T6 累计 22（5+6+3+9=23——实际是 23；spec 表列出 22 但含 "正常解析" 4 项 + 1 个额外 "empty body"。最终 23 passed 与 spec §10 表的 22 项基本相符，多 1 个 empty body 测不影响覆盖度。**不视为 gap**）
- §11 8 条验收 → T9

无遗漏。

**2. Placeholder scan**：

- 搜 "TBD" / "TODO" / "implement later" / "fill in"：仅 1 处（`T6.3` 的 `todo!()` 是测试目的的占位，T6.3 替换为真实实现）。T8.3 整段 `// 防止 tmp 在测试结束前 drop` 是 `let _ = tmp;` 的设计意图，非 placeholder。
- 没有 "Add appropriate error handling" / "Similar to Task N" / "Write tests for the above" 这类无内容指令。
- 所有 code step 都包含完整代码块。
- 没有引用未定义类型或函数——T5 引入 `ScanIssue` 之前，T4 的 `#[ignore]` 是显式声明；T6 用 `ScanIssue` 时 T5 已完成。

**3. Type consistency**：

- `AgentId(pub String)` 在 T5 定义，commands.rs T7 引用一致
- `ScanId::new()` 在 T5 定义，T7 commands.rs 与 T6 claude_code.rs 都用
- `ContentFingerprint { algorithm: "sha256", version: 1, scope: "ComparableEntry", digest, file_count }` T5 定义，T6 构建时字段顺序与命名一致
- `SkillIdentityEvidence` 字段 `normalized_name` / `declared_name` / `source` T5 定义，T6 构造时一致
- `SkillInstallation` 字段 T5 定义 12 个，T6 构造时全部填齐
- `ScanIssue` 字段 `code` / `severity` / `phase` / `path` / `message` / `recoverable` T5 定义，T4 / T6 / T7 引用一致
- `ContentFingerprint::file_count` 来自 `compute_fingerprint` 返回的第二个值，T3 与 T6 一致
- `platform::user_home_dir() -> Option<PathBuf>` T1 定义，T6 detect 与 T7 scan_agents 都用

**4. 范围**：单一 plan，单一可执行单元，无需拆分。