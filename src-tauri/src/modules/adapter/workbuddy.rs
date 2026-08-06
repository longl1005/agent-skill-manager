//! WorkBuddy adapter.
//!
//! WorkBuddy stores user skills in `$HOME/.workbuddy/skills` and its bundled
//! marketplace skills in `$HOME/.workbuddy/skills-marketplace/skills`.

use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, ClaudeCodeAdapter, CompareConfidence,
    DetectContext, DetectionResult, DetectionStatus, Platform, RootScope, ScanContext,
    ScanResult, SkillRoot, SupportLevel,
};
use crate::modules::platform::user_home_dir;

pub struct WorkBuddyAdapter;

impl AgentAdapter for WorkBuddyAdapter {
    fn id(&self) -> AgentId {
        AgentId("workbuddy".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "workbuddy@1".into(),
            display_name: "WorkBuddy".into(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: None,
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
            notes: vec!["user-scope $HOME/.workbuddy/skills + $HOME/.workbuddy/skills-marketplace/skills".into()],
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

        let base_dir = home.join(".workbuddy");
        let base_present = std::fs::metadata(&base_dir).is_ok() || std::fs::symlink_metadata(&base_dir).is_ok();

        let candidate_roots = vec![
            ("user-skills", base_dir.join("skills"), RootScope::User),
            ("marketplace-skills", base_dir.join("skills-marketplace").join("skills"), RootScope::User),
        ];

        let roots: Vec<SkillRoot> = candidate_roots.into_iter().filter_map(|(root_id, root, scope)| {
            let present = std::fs::metadata(&root).is_ok() || std::fs::symlink_metadata(&root).is_ok();
            if present {
                Some(SkillRoot {
                    root_id: root_id.into(),
                    display_path: root.clone(),
                    canonical_path: root,
                    scope,
                })
            } else {
                None
            }
        }).collect();

        let status = if base_present || !roots.is_empty() {
            DetectionStatus::Detected
        } else {
            DetectionStatus::Unavailable
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
            installation.adapter_id = "workbuddy@1".into();
        }
        result
    }
}
