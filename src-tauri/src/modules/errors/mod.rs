//! 统一错误类型。
//!
//! 后续 Adapter / Scanner / Inventory 的错误统一收敛为 `AsmError`，
//! 通过 `serde` 序列化为前端可读结构。MVP 阶段先占位，不暴露具体变体。
//! 本文件为占位骨架，crate 内尚未使用，允许 dead_code。
#![allow(dead_code)]

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AsmError {
    pub kind: &'static str,
    pub message: String,
}

pub type AsmResult<T> = Result<T, AsmError>;
