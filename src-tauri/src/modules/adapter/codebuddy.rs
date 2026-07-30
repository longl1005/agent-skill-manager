//! CodeBuddy CLI adapter.
//!
//! CodeBuddy stores user skills in `$HOME/.codebuddy/skills`, using the same
//! one-directory-per-skill `SKILL.md` package layout as Claude Code.

use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, ClaudeCodeAdapter, CompareConfidence,
    DetectContext, DetectionResult, DetectionStatus, Platform, RootScope, ScanContext,
    ScanResult, SkillRoot, SupportLevel,
};
use crate::modules::platform::user_home_dir;

pub struct CodeBuddyAdapter;

impl AgentAdapter for CodeBuddyAdapter {
    fn id(&self) -> AgentId {
        AgentId("codebuddy".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "codebuddy@1".into(),
            display_name: "CodeBuddy".into(),
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
            notes: vec!["user-scope $HOME/.codebuddy/skills".into()],
        }
    }

    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        let now = SystemTime::now();
        let root = ctx.custom_path.map(|path| path.to_path_buf()).unwrap_or_else(|| {
            let home = if ctx.platform.home_dir.as_os_str().is_empty() {
                user_home_dir().unwrap_or_default()
            } else {
                ctx.platform.home_dir.clone()
            };
            home.join(".codebuddy").join("skills")
        });
        let exists = std::fs::symlink_metadata(&root)
            .map(|metadata| metadata.file_type().is_dir())
            .unwrap_or(false);

        DetectionResult {
            agent: self.id(),
            status: if exists { DetectionStatus::Detected } else { DetectionStatus::Unavailable },
            roots: if exists {
                vec![SkillRoot {
                    root_id: if ctx.custom_path.is_some() { "custom-skills".into() } else { "user-skills".into() },
                    display_path: root.clone(),
                    canonical_path: root,
                    scope: if ctx.custom_path.is_some() { RootScope::Custom } else { RootScope::User },
                }]
            } else {
                vec![]
            },
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
            installation.adapter_id = "codebuddy@1".into();
        }
        result
    }
}
