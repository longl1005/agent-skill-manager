//! Windsurf adapter.
//!
//! Windsurf stores global Cascade skills in `$HOME/.codeium/windsurf/skills`.

use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, ClaudeCodeAdapter, CompareConfidence,
    DetectContext, DetectionResult, DetectionStatus, Platform, RootScope, ScanContext,
    ScanResult, SkillRoot, SupportLevel,
};
use crate::modules::platform::user_home_dir;

pub struct WindsurfAdapter;

impl AgentAdapter for WindsurfAdapter {
    fn id(&self) -> AgentId {
        AgentId("windsurf".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "windsurf@1".into(),
            display_name: "Windsurf".into(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://docs.windsurf.com/cascade/skills".into()),
            adapter_version: "0.1.0".into(),
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
            notes: vec!["user-scope $HOME/.codeium/windsurf/skills".into()],
        }
    }

    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        let now = SystemTime::now();

        if let Some(custom_path) = ctx.custom_path {
            if !custom_path.as_os_str().is_empty() {
                let exists = std::fs::metadata(custom_path).is_ok()
                    || std::fs::symlink_metadata(custom_path).is_ok();
                if exists {
                    return DetectionResult {
                        agent: self.id(),
                        status: DetectionStatus::Detected,
                        roots: vec![SkillRoot {
                            root_id: "custom-skills".into(),
                            display_path: custom_path.to_path_buf(),
                            canonical_path: custom_path.to_path_buf(),
                            scope: RootScope::Custom,
                        }],
                        issues: vec![],
                        observed_at: now,
                    };
                }
            }
        }

        let home = if !ctx.platform.home_dir.as_os_str().is_empty() {
            ctx.platform.home_dir.clone()
        } else {
            user_home_dir().unwrap_or_default()
        };

        let base_dir = home.join(".codeium").join("windsurf");
        let alt_base_dir1 = home.join(".codeium");
        let alt_base_dir2 = home.join(".windsurf");
        let root = base_dir.join("skills");
        let base_present = std::fs::metadata(&base_dir).is_ok()
            || std::fs::symlink_metadata(&base_dir).is_ok()
            || std::fs::metadata(&alt_base_dir1).is_ok()
            || std::fs::symlink_metadata(&alt_base_dir1).is_ok()
            || std::fs::metadata(&alt_base_dir2).is_ok()
            || std::fs::symlink_metadata(&alt_base_dir2).is_ok();
        let root_present = std::fs::metadata(&root).is_ok() || std::fs::symlink_metadata(&root).is_ok();

        let status = if base_present || root_present {
            DetectionStatus::Detected
        } else {
            DetectionStatus::Unavailable
        };

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
            status,
            roots,
            issues: vec![],
            observed_at: now,
        }
    }

    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }

    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        let mut result = ClaudeCodeAdapter.scan(ctx);
        result.agent_id = self.id();
        for installation in &mut result.installations {
            installation.agent_id = self.id();
            installation.adapter_id = "windsurf@1".into();
        }
        result
    }
}
