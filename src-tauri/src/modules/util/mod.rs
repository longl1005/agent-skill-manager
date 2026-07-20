//! 跨 adapter 共享的辅助模块。
//!
//! 三个子模块：frontmatter (YAML 解析)、fingerprint (SHA-256 manifest)、path_scan (目录枚举)。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6。

mod fingerprint;
mod frontmatter;
mod path_scan;
