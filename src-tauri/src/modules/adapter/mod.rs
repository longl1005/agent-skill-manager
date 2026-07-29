//! Agent Adapter 注册与统一契约。
//!
//! 契约见 ADAPTER_SPEC.md §3-§7。MVP 仅 `detect` 和 `scan` 为必实现。
//! 本文件含完整 DTO + 6 方法 trait；M0 阶段 ClaudeCodeAdapter 实现全部方法，
//! CodexAdapter 仍为 stub。
//! 本文件保留 dead_code allow，因 CodexAdapter 占位导致 pub use 触发警告。
#![allow(dead_code, unused_imports)]

mod claude_code;
mod codex;
mod antigravity;
mod pi_agent;
mod opencode;
mod cursor;
mod cline;
mod oh_my_pi;

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

impl Platform {
    pub fn current() -> Option<Self> {
        if cfg!(target_os = "macos") {
            Some(Self::MacOs)
        } else if cfg!(target_os = "linux") {
            Some(Self::Linux)
        } else if cfg!(target_os = "windows") {
            Some(Self::Windows)
        } else {
            None
        }
    }
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
    pub custom_path: Option<&'a std::path::Path>,
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
pub use antigravity::AntigravityAdapter;
pub use pi_agent::PiAgentAdapter;
pub use opencode::OpenCodeAdapter;
pub use cursor::CursorAdapter;
pub use cline::ClineAdapter;
pub use oh_my_pi::OhMyPiAdapter;

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::atomic::{AtomicU64, Ordering};

    use super::{AgentAdapter, DetectContext, DetectionStatus, OhMyPiAdapter, Platform, PlatformContext};

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn tempdir() -> std::path::PathBuf {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("asm-oh-my-pi-{id}"));
        std::fs::create_dir_all(&path).unwrap();
        path
    }

    fn platform_context(home: &Path) -> PlatformContext {
        PlatformContext {
            platform: Platform::MacOs,
            home_dir: home.to_path_buf(),
            cwd: home.to_path_buf(),
        }
    }

    #[test]
    fn current_platform_matches_compile_target() {
        #[cfg(target_os = "macos")]
        assert_eq!(Platform::current(), Some(Platform::MacOs));
        #[cfg(target_os = "linux")]
        assert_eq!(Platform::current(), Some(Platform::Linux));
        #[cfg(target_os = "windows")]
        assert_eq!(Platform::current(), Some(Platform::Windows));
    }

    #[test]
    fn oh_my_pi_detects_native_user_skills_root() {
        let home = tempdir();
        let root = home.join(".omp/agent/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = OhMyPiAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots.len(), 1);
        assert_eq!(detection.roots[0].display_path, root);
    }

    #[test]
    fn oh_my_pi_is_unavailable_without_native_root() {
        let home = tempdir();
        let context = platform_context(&home);

        let detection = OhMyPiAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Unavailable);
    }
}
