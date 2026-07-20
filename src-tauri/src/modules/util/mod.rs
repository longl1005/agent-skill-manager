//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。
//!
//! 本文件 re-export 由 T5+ 的 ClaudeCodeAdapter 消费；当前 crate 内尚未使用，
//! 允许 unused_imports 以通过 `-D warnings`。

#![allow(unused_imports)]

mod fingerprint;
mod frontmatter;
mod path_scan;

pub use frontmatter::{parse_frontmatter, FrontmatterError, ParsedFrontmatter};
