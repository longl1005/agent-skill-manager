//! Codex Adapter 占位。
//!
//! 完整 detect / scan 见 ADAPTER_SPEC.md。M0 阶段仅实现 trait 必需方法。
//! 本文件为占位骨架，crate 内尚未使用，允许 dead_code。
#![allow(dead_code)]

use super::{AgentAdapter, AgentId};

pub struct CodexAdapter;

impl AgentAdapter for CodexAdapter {
    fn id(&self) -> AgentId {
        AgentId("codex".to_string())
    }
}
