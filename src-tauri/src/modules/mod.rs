//! ASM 后端模块树。
//!
//! 按 ARCHITECTURE.md §3 切分：errors / platform / adapter / scanner / inventory / db。

pub mod adapter;
pub mod db;
pub mod errors;
pub mod inventory;
pub mod master_repo;
pub mod platform;
#[allow(dead_code)]
pub mod performance;
pub mod scanner;
pub mod util;
