//! Claude Code Adapter。
//! T5 阶段先满足新 trait 编译；T6 阶段重写 detect/scan 为真实实现。
//! 临时 stub 返回 Detected + 0 roots + 1 issue。

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, CompareConfidence, DetectContext,
    DetectionResult, IssuePhase, IssueSeverity, Platform, ScanCompleteness, ScanContext, ScanId,
    ScanIssue, ScanOutcome, ScanResult, SkillRoot, SupportLevel,
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
                message: "claude_code adapter detect/scan not yet implemented (T5 stub)"
                    .to_string(),
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
