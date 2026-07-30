//! TRAE CN IDE adapter.

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, DetectContext, DetectionResult,
    Platform, ScanContext, ScanResult, SkillRoot,
};

pub struct TraeCnAdapter;

impl AgentAdapter for TraeCnAdapter {
    fn id(&self) -> AgentId {
        AgentId("trae-cn".into())
    }
    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "trae-cn@1".into(),
            display_name: "TRAE CN".into(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://www.trae.cn/ide/download".into()),
            adapter_version: "0.1.0".into(),
        }
    }
    fn capabilities(&self) -> CapabilitySet {
        super::trae::capabilities("$HOME/.trae-cn/skills")
    }
    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        super::trae::detect(
            &self.id(),
            ctx,
            ".trae-cn",
            "TRAE CN.app",
            "no TRAE CN Skills roots found",
        )
    }
    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }
    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        super::trae::scan(
            &self.id(),
            "trae-cn@1",
            "trae-cn-skill",
            "TRAE CN Skill",
            ctx,
        )
    }
}
