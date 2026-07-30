//! TRAE IDE adapter.

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, ClineAdapter, CompareConfidence,
    DetectContext, DetectionResult, DetectionStatus, IssuePhase, IssueSeverity, Platform,
    RootScope, ScanContext, ScanIssue, ScanResult, SkillRoot, SupportLevel,
};
use std::time::SystemTime;

pub struct TraeAdapter;

impl AgentAdapter for TraeAdapter {
    fn id(&self) -> AgentId {
        AgentId("trae".into())
    }
    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "trae@1".into(),
            display_name: "TRAE".into(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://www.trae.ai/ide/".into()),
            adapter_version: "0.1.0".into(),
        }
    }
    fn capabilities(&self) -> CapabilitySet {
        capabilities("$HOME/.trae/skills")
    }
    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        detect(
            &self.id(),
            ctx,
            ".trae",
            "TRAE.app",
            "no TRAE Skills roots found",
        )
    }
    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }
    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        scan(&self.id(), "trae@1", "trae-skill", "TRAE Skill", ctx)
    }
}

pub(crate) fn capabilities(note: &str) -> CapabilitySet {
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
        notes: vec![format!("user-scope {note}")],
    }
}
pub(crate) fn detect(
    agent: &AgentId,
    ctx: &DetectContext,
    dir: &str,
    macos_bundle: &str,
    missing_message: &str,
) -> DetectionResult {
    let observed_at = SystemTime::now();

    if matches!(ctx.platform.platform, Platform::MacOs)
        && !macos_app_is_installed(ctx, macos_bundle)
    {
        return DetectionResult {
            agent: agent.clone(),
            status: DetectionStatus::Unavailable,
            roots: vec![],
            issues: vec![ScanIssue {
                code: "APP_NOT_FOUND".into(),
                severity: IssueSeverity::Info,
                phase: IssuePhase::Detect,
                path: None,
                message: format!(
                    "{} is not installed in /Applications or ~/Applications",
                    macos_bundle
                ),
                recoverable: true,
            }],
            observed_at,
        };
    }

    if let Some(path) = ctx.custom_path.filter(|p| !p.as_os_str().is_empty()) {
        return if exists(path) {
            found(
                agent.clone(),
                path.to_path_buf(),
                RootScope::Custom,
                observed_at,
            )
        } else {
            DetectionResult {
                agent: agent.clone(),
                status: DetectionStatus::Failed,
                roots: vec![],
                issues: vec![ScanIssue {
                    code: "CUSTOM_PATH_NOT_FOUND".into(),
                    severity: IssueSeverity::Error,
                    phase: IssuePhase::Detect,
                    path: Some(path.to_path_buf()),
                    message: format!("Custom path does not exist: {}", path.display()),
                    recoverable: true,
                }],
                observed_at,
            }
        };
    }

    let root = ctx.platform.home_dir.join(dir).join("skills");
    if exists(&root) {
        found(agent.clone(), root, RootScope::User, observed_at)
    } else {
        DetectionResult {
            agent: agent.clone(),
            status: DetectionStatus::Unavailable,
            roots: vec![],
            issues: vec![ScanIssue {
                code: "NO_SKILLS_ROOTS".into(),
                severity: IssueSeverity::Info,
                phase: IssuePhase::Detect,
                path: None,
                message: missing_message.into(),
                recoverable: true,
            }],
            observed_at,
        }
    }
}

fn macos_app_is_installed(ctx: &DetectContext, bundle: &str) -> bool {
    [
        std::path::PathBuf::from("/Applications").join(bundle),
        ctx.platform.home_dir.join("Applications").join(bundle),
    ]
    .iter()
    .any(|path| path.is_dir())
}
pub(crate) fn scan(
    agent: &AgentId,
    adapter_id: &str,
    format_id: &str,
    format_name: &str,
    ctx: &ScanContext,
) -> ScanResult {
    let mut result = ClineAdapter.scan(ctx);
    result.agent_id = agent.clone();
    for item in &mut result.installations {
        item.agent_id = agent.clone();
        item.adapter_id = adapter_id.into();
        item.format.id = format_id.into();
        item.format.display_name = format_name.into();
    }
    result
}
fn exists(path: &std::path::Path) -> bool {
    std::fs::metadata(path).is_ok() || std::fs::symlink_metadata(path).is_ok()
}
fn found(
    agent: AgentId,
    root: std::path::PathBuf,
    scope: RootScope,
    observed_at: SystemTime,
) -> DetectionResult {
    DetectionResult {
        agent,
        status: DetectionStatus::Detected,
        roots: vec![SkillRoot {
            root_id: if matches!(scope, RootScope::Custom) {
                "custom-skills".into()
            } else {
                "user-skills".into()
            },
            display_path: root.clone(),
            canonical_path: root,
            scope,
        }],
        issues: vec![],
        observed_at,
    }
}
