//! 平台服务。
//!
//! 负责解析应用数据目录、用户主目录、跨平台路径标准化。
//! 严格遵循 ARCHITECTURE.md §7：绝不硬编码路径分隔符或 home 字符串。
//!
//! M0 阶段：仅占位，提供 `app_data_dir()` 一个常量返回函数。
//! 本文件为占位骨架，crate 内尚未使用，允许 dead_code。
#![allow(dead_code)]

use std::path::PathBuf;

/// ASM 应用数据目录的解析入口。
///
/// 调用方（如 Inventory 模块）按签名调用即可；具体解析逻辑在 M0 实现阶段补齐。
#[allow(clippy::todo)]
pub fn app_data_dir() -> PathBuf {
    todo!("platform::app_data_dir 在 M0 实现阶段补齐")
}

/// 用户主目录解析。
///
/// 用 `dirs` crate 跨平台取 `$HOME` / `%USERPROFILE%` / `xdg_home`。
/// 返回 `None` 时整个 scan 返回 Failed 状态（spec §8.1）。
/// **禁止** hard-code `~` / `/Users` / `C:\Users`（spec §6.2）。
pub fn user_home_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir()
}
