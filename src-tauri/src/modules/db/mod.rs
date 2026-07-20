//! SQLite 持久化层。
//!
//! ARCHITECTURE.md §3 "Database"：连接、迁移、仓库模块。MVP 不直接对外暴露表，
//! 仅供 Inventory 模块调用。
//!
//! M0 阶段：占位。引入 `rusqlite` 或 `sqlx` 在 M0 真正开始实现时决定。
