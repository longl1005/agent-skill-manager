//! Grok adapter.

use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, ClineAdapter, CompareConfidence,
    DetectContext, DetectionResult, DetectionStatus, IssuePhase, IssueSeverity, Platform,
    RootScope, ScanContext, ScanIssue, ScanResult, SkillRoot, SupportLevel,
};

const ADAPTER_VERSION: &str = "0.1.0";

/// Adapter for Grok's native user-scoped skills.
pub struct GrokAdapter;

impl AgentAdapter for GrokAdapter {
    fn id(&self) -> AgentId {
        AgentId("grok".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "grok@1".to_string(),
            display_name: "Grok".to_string(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some(
                "https://docs.x.ai/build/features/skills-plugins-marketplaces".to_string(),
            ),
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
            notes: vec!["user-scope $HOME/.grok/skills".to_string()],
        }
    }

    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        let observed_at = SystemTime::now();

        if let Some(custom_path) = ctx.custom_path.filter(|path| !path.as_os_str().is_empty()) {
            if path_exists(custom_path) {
                return detected(
                    self.id(),
                    custom_path.to_path_buf(),
                    RootScope::Custom,
                    observed_at,
                );
            }

            return DetectionResult {
                agent: self.id(),
                status: DetectionStatus::Failed,
                roots: vec![],
                issues: vec![ScanIssue {
                    code: "CUSTOM_PATH_NOT_FOUND".into(),
                    severity: IssueSeverity::Error,
                    phase: IssuePhase::Detect,
                    path: Some(custom_path.to_path_buf()),
                    message: format!("Custom path does not exist: {}", custom_path.display()),
                    recoverable: true,
                }],
                observed_at,
            };
        }

        let base_dir = ctx.platform.home_dir.join(".grok");
        let root = base_dir.join("skills");
        let base_present = path_exists(&base_dir);
        let root_present = path_exists(&root);

        if base_present || root_present {
            let roots = if root_present {
                vec![SkillRoot {
                    root_id: "user-skills".into(),
                    display_path: root.clone(),
                    canonical_path: root,
                    scope: RootScope::User,
                }]
            } else {
                vec![]
            };
            DetectionResult {
                agent: self.id(),
                status: DetectionStatus::Detected,
                roots,
                issues: vec![],
                observed_at,
            }
        } else {
            DetectionResult {
                agent: self.id(),
                status: DetectionStatus::Unavailable,
                roots: vec![],
                issues: vec![ScanIssue {
                    code: "NO_SKILLS_ROOTS".into(),
                    severity: IssueSeverity::Info,
                    phase: IssuePhase::Detect,
                    path: None,
                    message: "no Grok Skills roots found".into(),
                    recoverable: true,
                }],
                observed_at,
            }
        }
    }

    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }

    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        let mut result = ClineAdapter.scan(ctx);
        result.agent_id = self.id();
        for installation in &mut result.installations {
            installation.agent_id = self.id();
            installation.adapter_id = "grok@1".to_string();
            installation.format.id = "grok-skill".to_string();
            installation.format.display_name = "Grok Skill".to_string();
        }
        result
    }
}

fn path_exists(path: &std::path::Path) -> bool {
    std::fs::metadata(path).is_ok() || std::fs::symlink_metadata(path).is_ok()
}

fn detected(
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
                "custom-skills".to_string()
            } else {
                "user-skills".to_string()
            },
            display_path: root.clone(),
            canonical_path: root,
            scope,
        }],
        issues: vec![],
        observed_at,
    }
}
