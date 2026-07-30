//! Agent Adapter 注册与统一契约。
//!
//! 契约见 ADAPTER_SPEC.md §3-§7。MVP 仅 `detect` 和 `scan` 为必实现。
//! 本文件含完整 DTO + 6 方法 trait；M0 阶段 ClaudeCodeAdapter 实现全部方法，
//! CodexAdapter 仍为 stub。
//! 本文件保留 dead_code allow，因 CodexAdapter 占位导致 pub use 触发警告。
#![allow(dead_code, unused_imports)]

mod antigravity;
mod augment;
mod claude_code;
mod cline;
mod codebuddy;
mod codex;
mod cursor;
mod droid;
mod grok;
mod github_copilot;
mod hermes;
mod kiro;
mod kimi_code;
mod oh_my_pi;
mod openclaw;
mod opencode;
mod pi_agent;
mod qoder;
mod qwen_code;
mod roo_code;
mod trae;
mod trae_cn;
mod workbuddy;
mod windsurf;

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

pub use antigravity::AntigravityAdapter;
pub use augment::AugmentAdapter;
pub use claude_code::ClaudeCodeAdapter;
pub use cline::ClineAdapter;
pub use codebuddy::CodeBuddyAdapter;
pub use codex::CodexAdapter;
pub use cursor::CursorAdapter;
pub use droid::DroidAdapter;
pub use grok::GrokAdapter;
pub use github_copilot::GitHubCopilotAdapter;
pub use hermes::HermesAdapter;
pub use kiro::KiroAdapter;
pub use kimi_code::KimiCodeAdapter;
pub use oh_my_pi::OhMyPiAdapter;
pub use openclaw::OpenClawAdapter;
pub use opencode::OpenCodeAdapter;
pub use pi_agent::PiAgentAdapter;
pub use qoder::QoderAdapter;
pub use qwen_code::QwenCodeAdapter;
pub use roo_code::RooCodeAdapter;
pub use trae::TraeAdapter;
pub use trae_cn::TraeCnAdapter;
pub use workbuddy::WorkBuddyAdapter;
pub use windsurf::WindsurfAdapter;

#[cfg(test)]
mod tests {
    use std::path::Path;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{
        AgentAdapter, AugmentAdapter, CodeBuddyAdapter, DetectContext, DetectionStatus, DroidAdapter, GitHubCopilotAdapter, GrokAdapter, HermesAdapter, KimiCodeAdapter, KiroAdapter, RooCodeAdapter, WindsurfAdapter,
        OhMyPiAdapter, OpenClawAdapter, Platform, PlatformContext, QoderAdapter, QwenCodeAdapter, TraeAdapter, TraeCnAdapter, WorkBuddyAdapter,
    };

    static TEST_COUNTER: AtomicU64 = AtomicU64::new(0);

    fn tempdir() -> std::path::PathBuf {
        let id = TEST_COUNTER.fetch_add(1, Ordering::Relaxed);
        // Include the process and timestamp: a plain counter restarts at zero on
        // each `cargo test` invocation, which previously let stale roots from an
        // earlier run leak into the negative detection cases.
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before Unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "asm-adapter-test-{}-{nonce}-{id}",
            std::process::id()
        ));
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
    fn github_copilot_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".copilot/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = GitHubCopilotAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn droid_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".factory/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = DroidAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn qoder_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".qoder/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = QoderAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn qwen_code_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".qwen/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);
        let detection = QwenCodeAdapter.detect(&DetectContext { platform: &context, custom_path: None });
        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn hermes_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".hermes/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = HermesAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn openclaw_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".openclaw/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = OpenClawAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn workbuddy_detects_personal_skills_root() {
        let home = tempdir();
        let marketplace_root = home.join(".workbuddy/skills-marketplace/skills");
        std::fs::create_dir_all(&marketplace_root).unwrap();
        let context = platform_context(&home);

        let detection = WorkBuddyAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots.len(), 1);
        assert_eq!(detection.roots[0].display_path, marketplace_root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn codebuddy_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".codebuddy/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = CodeBuddyAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn kimi_code_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".kimi-code/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = KimiCodeAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn augment_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".augment/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = AugmentAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn roo_code_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".roo/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = RooCodeAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
    }

    #[test]
    fn windsurf_detects_personal_skills_root() {
        let home = tempdir();
        let root = home.join(".codeium/windsurf/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = WindsurfAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots[0].display_path, root);
        let _ = std::fs::remove_dir_all(home);
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

    #[test]
    fn grok_detects_user_skills_root() {
        let home = tempdir();
        let root = home.join(".grok/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = GrokAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots.len(), 1);
        assert_eq!(detection.roots[0].display_path, root);
    }

    #[test]
    fn grok_is_unavailable_without_user_skills_root() {
        let home = tempdir();
        let context = platform_context(&home);

        let detection = GrokAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Unavailable);
    }

    #[test]
    fn kiro_detects_user_skills_root() {
        let home = tempdir();
        let root = home.join(".kiro/skills");
        std::fs::create_dir_all(&root).unwrap();
        let context = platform_context(&home);

        let detection = KiroAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Detected);
        assert_eq!(detection.roots.len(), 1);
        assert_eq!(detection.roots[0].display_path, root);
    }

    #[test]
    fn kiro_is_unavailable_without_user_skills_root() {
        let home = tempdir();
        let context = platform_context(&home);

        let detection = KiroAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(detection.status, DetectionStatus::Unavailable);
    }

    #[test]
    fn trae_adapters_require_their_app_bundle_in_addition_to_a_skills_root() {
        let home = tempdir();
        let trae_root = home.join(".trae/skills");
        let trae_cn_root = home.join(".trae-cn/skills");
        std::fs::create_dir_all(&trae_root).unwrap();
        std::fs::create_dir_all(&trae_cn_root).unwrap();
        let context = platform_context(&home);

        let trae = TraeAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });
        let trae_cn = TraeCnAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(trae.status, DetectionStatus::Unavailable);
        assert_eq!(trae_cn.status, DetectionStatus::Unavailable);

        std::fs::create_dir_all(home.join("Applications/TRAE.app")).unwrap();
        std::fs::create_dir_all(home.join("Applications/TRAE CN.app")).unwrap();

        let trae = TraeAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });
        let trae_cn = TraeCnAdapter.detect(&DetectContext {
            platform: &context,
            custom_path: None,
        });

        assert_eq!(trae.status, DetectionStatus::Detected);
        assert_eq!(trae.roots[0].display_path, trae_root);
        assert_eq!(trae_cn.status, DetectionStatus::Detected);
        assert_eq!(trae_cn.roots[0].display_path, trae_cn_root);
    }
}
