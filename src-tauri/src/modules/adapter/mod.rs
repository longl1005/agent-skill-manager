//! Agent Adapter 注册与统一契约。
//!
//! 契约见 ADAPTER_SPEC.md §3。MVP 仅 `detect` 和 `scan` 为必实现。
//! M0 阶段：定义 trait 骨架，提供 Claude Code / Codex 两个空实现占位。
//! 本文件为占位骨架，crate 内尚未使用，允许 dead_code。
#![allow(dead_code, unused_imports)]

mod claude_code;
mod codex;

use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct AgentId(pub String);

// --- T4 stub - to be replaced in T5 ---
// T5 will expand these into the full ScanIssue contract (adding #[derive(Serialize)]
// and any additional variants). Field/variant names here match T5's plan so
// util::path_scan and its tests compile against a stable shape.

/// 扫描过程中记录的问题。占位实现，T5 补齐完整契约。
#[derive(Debug, Clone)]
pub struct ScanIssue {
    pub code: String,
    pub severity: IssueSeverity,
    pub phase: IssuePhase,
    pub path: Option<PathBuf>,
    pub message: String,
    pub recoverable: bool,
}

/// 问题严重程度。占位实现，T5 补齐。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssueSeverity {
    Info,
    Warning,
    Error,
}

/// 问题所处扫描阶段。占位实现，T5 补齐。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IssuePhase {
    Detect,
    RootResolution,
    Enumeration,
    Read,
    Parse,
    Fingerprint,
}
// --- end T4 stub ---

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
