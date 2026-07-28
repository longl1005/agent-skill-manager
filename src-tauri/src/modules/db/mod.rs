//! SQLite 持久化层。
//!
//! ARCHITECTURE.md §3 "Database"：连接、迁移、仓库模块。
//! 实现 Master Skills 元数据表、Agent Symlinks 关系表、Activity Logs 操作日志表。

use std::path::{Path, PathBuf};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DbMasterSkill {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub author: String,
    pub repo_url: String,
    pub file_count: usize,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DbAgentSymlink {
    pub id: i64,
    pub agent_id: String,
    pub skill_name: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DbActivityLog {
    pub id: i64,
    pub action: String,
    pub target_skill: String,
    pub target_agent: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DbSkillTranslation {
    pub skill_name: String,
    pub name_zh: String,
    pub description_zh: String,
    pub body_zh: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DbSummaryReport {
    pub db_path: String,
    pub total_skills: usize,
    pub total_symlinks: usize,
    pub recent_activities: Vec<DbActivityLog>,
}

pub fn get_db_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".asm")
        .join("asm_database.db")
}

pub fn ensure_db_dir(path: &Path) -> std::io::Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    Ok(())
}

pub fn open_db(custom_path: Option<&Path>) -> Result<Connection> {
    let db_path = custom_path
        .map(|p| p.to_path_buf())
        .unwrap_or_else(get_db_path);

    if db_path.to_string_lossy() != ":memory:" {
        let _ = ensure_db_dir(&db_path);
    }

    let conn = Connection::open(&db_path)?;
    init_db_tables(&conn)?;
    Ok(conn)
}

pub fn init_db_tables(conn: &Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS skills_master (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            author TEXT NOT NULL DEFAULT '',
            repo_url TEXT NOT NULL DEFAULT '',
            file_count INTEGER NOT NULL DEFAULT 0,
            installed_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_symlinks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT NOT NULL,
            skill_name TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'linked',
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(agent_id, skill_name)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS activity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            target_skill TEXT NOT NULL,
            target_agent TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS skill_translations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            skill_name TEXT UNIQUE NOT NULL,
            name_zh TEXT NOT NULL DEFAULT '',
            description_zh TEXT NOT NULL DEFAULT '',
            body_zh TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
        [],
    )?;

    Ok(())
}

pub fn upsert_skill_translation(
    conn: &Connection,
    skill_name: &str,
    name_zh: &str,
    description_zh: &str,
    body_zh: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO skill_translations (skill_name, name_zh, description_zh, body_zh, updated_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(skill_name) DO UPDATE SET
            name_zh = excluded.name_zh,
            description_zh = excluded.description_zh,
            body_zh = excluded.body_zh,
            updated_at = datetime('now')",
        params![skill_name, name_zh, description_zh, body_zh],
    )?;
    Ok(())
}

pub fn get_skill_translation(conn: &Connection, skill_name: &str) -> Result<Option<DbSkillTranslation>> {
    let mut stmt = conn.prepare(
        "SELECT skill_name, name_zh, description_zh, body_zh, updated_at
         FROM skill_translations WHERE skill_name = ?1",
    )?;

    let mut rows = stmt.query(params![skill_name])?;
    if let Some(row) = rows.next()? {
        Ok(Some(DbSkillTranslation {
            skill_name: row.get(0)?,
            name_zh: row.get(1)?,
            description_zh: row.get(2)?,
            body_zh: row.get(3)?,
            updated_at: row.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn upsert_master_skill(
    conn: &Connection,
    name: &str,
    description: &str,
    author: &str,
    repo_url: &str,
    file_count: usize,
) -> Result<()> {
    conn.execute(
        "INSERT INTO skills_master (name, description, author, repo_url, file_count, installed_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(name) DO UPDATE SET
            description = excluded.description,
            author = excluded.author,
            repo_url = excluded.repo_url,
            file_count = excluded.file_count,
            installed_at = datetime('now')",
        params![name, description, author, repo_url, file_count as i64],
    )?;
    Ok(())
}

pub fn upsert_agent_symlink(
    conn: &Connection,
    agent_id: &str,
    skill_name: &str,
    status: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO agent_symlinks (agent_id, skill_name, status, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(agent_id, skill_name) DO UPDATE SET
            status = excluded.status,
            updated_at = datetime('now')",
        params![agent_id, skill_name, status],
    )?;
    Ok(())
}

pub fn log_activity(
    conn: &Connection,
    action: &str,
    target_skill: &str,
    target_agent: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO activity_logs (action, target_skill, target_agent, created_at)
         VALUES (?1, ?2, ?3, datetime('now'))",
        params![action, target_skill, target_agent],
    )?;
    Ok(())
}

pub fn get_all_master_skills(conn: &Connection) -> Result<Vec<DbMasterSkill>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, author, repo_url, file_count, installed_at
         FROM skills_master ORDER BY id DESC",
    )?;

    let skill_iter = stmt.query_map([], |row| {
        Ok(DbMasterSkill {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            author: row.get(3)?,
            repo_url: row.get(4)?,
            file_count: row.get::<_, i64>(5)? as usize,
            installed_at: row.get(6)?,
        })
    })?;

    let mut skills = Vec::new();
    for skill in skill_iter {
        skills.push(skill?);
    }
    Ok(skills)
}

pub fn get_activity_logs(conn: &Connection, limit: usize) -> Result<Vec<DbActivityLog>> {
    let mut stmt = conn.prepare(
        "SELECT id, action, target_skill, target_agent, created_at
         FROM activity_logs ORDER BY id DESC LIMIT ?",
    )?;

    let log_iter = stmt.query_map(params![limit as i64], |row| {
        Ok(DbActivityLog {
            id: row.get(0)?,
            action: row.get(1)?,
            target_skill: row.get(2)?,
            target_agent: row.get(3)?,
            created_at: row.get(4)?,
        })
    })?;

    let mut logs = Vec::new();
    for log in log_iter {
        logs.push(log?);
    }
    Ok(logs)
}

pub fn get_db_summary(conn: &Connection, custom_path: Option<&Path>) -> Result<DbSummaryReport> {
    let db_path = custom_path
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| get_db_path().to_string_lossy().to_string());

    let total_skills: i64 = conn.query_row(
        "SELECT COUNT(*) FROM skills_master",
        [],
        |row| row.get(0),
    )?;

    let total_symlinks: i64 = conn.query_row(
        "SELECT COUNT(*) FROM agent_symlinks WHERE status = 'linked'",
        [],
        |row| row.get(0),
    )?;

    let recent_activities = get_activity_logs(conn, 10)?;

    Ok(DbSummaryReport {
        db_path,
        total_skills: total_skills as usize,
        total_symlinks: total_symlinks as usize,
        recent_activities,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sqlite_db_init_and_operations() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();

        // 1. Upsert master skill
        upsert_master_skill(&conn, "frontend-design", "Create UI", "anthropics", "https://github.com/anthropics/skills", 3).unwrap();
        let skills = get_all_master_skills(&conn).unwrap();
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].name, "frontend-design");

        // 2. Upsert symlink
        upsert_agent_symlink(&conn, "claude-code", "frontend-design", "linked").unwrap();

        // 3. Log activity
        log_activity(&conn, "INSTALL", "frontend-design", "claude-code").unwrap();
        let logs = get_activity_logs(&conn, 5).unwrap();
        assert_eq!(logs.len(), 1);
        assert_eq!(logs[0].action, "INSTALL");

        // 4. Summary report
        let summary = get_db_summary(&conn, Some(Path::new(":memory:"))).unwrap();
        assert_eq!(summary.total_skills, 1);
        assert_eq!(summary.total_symlinks, 1);

        // 5. Skill translation persistence
        upsert_skill_translation(&conn, "frontend-design", "前端视觉美化", "针对 UI 提供美化指导", "# 前端 Visual Design").unwrap();
        let trans = get_skill_translation(&conn, "frontend-design").unwrap().unwrap();
        assert_eq!(trans.name_zh, "前端视觉美化");
        assert_eq!(trans.description_zh, "针对 UI 提供美化指导");
    }
}
