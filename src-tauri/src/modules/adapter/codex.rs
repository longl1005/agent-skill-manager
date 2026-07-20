//! Codex Adapter 占位（spec §13 明确不在 M0 范围）。

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, CompareConfidence, DetectContext,
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
