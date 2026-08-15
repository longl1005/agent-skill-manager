//! SQLite 持久化层。
//!
//! ARCHITECTURE.md §3 "Database"：连接、迁移、仓库模块。
//! 实现 Master Skills 元数据表、Agent Symlinks 关系表、Activity Logs 操作日志表。

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[allow(dead_code)]
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

#[allow(dead_code)]
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
pub struct DbAgentConfig {
    pub agent_id: String,
    pub custom_path: Option<String>,
    pub disabled: bool,
    pub sort_order: Option<i64>,
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
    conn.execute("CREATE TABLE IF NOT EXISTS agent_config (agent_id TEXT PRIMARY KEY, custom_path TEXT, disabled INTEGER NOT NULL DEFAULT 0, sort_order INTEGER)", [])?;
    // Migration for databases created before Agent ordering was introduced.
    let _ = conn.execute("ALTER TABLE agent_config ADD COLUMN sort_order INTEGER", []);

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
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Cleanup legacy translation table if it exists
    let _ = conn.execute("DROP TABLE IF EXISTS skill_translations", []);

    Ok(())
}

#[allow(dead_code)]
pub fn get_performance_diagnostics_enabled(conn: &Connection) -> Result<bool> {
    conn.query_row(
        "SELECT value = 'true' FROM app_settings WHERE key = 'performance_diagnostics_enabled'",
        [],
        |row| row.get(0),
    )
    .or_else(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Ok(false),
        other => Err(other),
    })
}

#[allow(dead_code)]
pub fn set_performance_diagnostics_enabled(conn: &Connection, enabled: bool) -> Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES ('performance_diagnostics_enabled', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [if enabled { "true" } else { "false" }],
    )?;
    Ok(())
}

pub fn get_network_proxy(conn: &Connection) -> Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'network_proxy'",
        [],
        |row| row.get(0),
    )
    .or_else(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other),
    })
}

pub fn set_network_proxy(conn: &Connection, proxy: Option<&str>) -> Result<()> {
    match proxy.filter(|s| !s.trim().is_empty()) {
        Some(val) => {
            let trimmed = val.trim();
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('network_proxy', ?1)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [trimmed],
            )?;
            apply_network_proxy_to_env(Some(trimmed));
        }
        None => {
            conn.execute(
                "DELETE FROM app_settings WHERE key = 'network_proxy'",
                [],
            )?;
            apply_network_proxy_to_env(None);
        }
    }
    Ok(())
}

pub fn apply_network_proxy_to_env(proxy: Option<&str>) {
    let vars = ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"];
    if let Some(proxy_val) = proxy.filter(|s| !s.trim().is_empty()) {
        let trimmed = proxy_val.trim();
        for var in vars {
            std::env::set_var(var, trimmed);
        }
    } else {
        for var in vars {
            std::env::remove_var(var);
        }
    }
}

pub fn get_agent_configs(conn: &Connection) -> Result<Vec<DbAgentConfig>> {
    let mut stmt = conn.prepare("SELECT agent_id, custom_path, disabled, sort_order FROM agent_config ORDER BY sort_order IS NULL, sort_order, agent_id")?;
    let configs = stmt
        .query_map([], |row| {
            Ok(DbAgentConfig {
                agent_id: row.get(0)?,
                custom_path: row.get(1)?,
                disabled: row.get::<_, i64>(2)? != 0,
                sort_order: row.get(3)?,
            })
        })?
        .collect();
    configs
}

pub fn set_agent_sort_order(conn: &Connection, agent_ids: &[&str]) -> Result<()> {
    let transaction = conn.unchecked_transaction()?;
    for (sort_order, agent_id) in agent_ids.iter().enumerate() {
        transaction.execute(
            "INSERT INTO agent_config (agent_id, sort_order) VALUES (?1, ?2)
             ON CONFLICT(agent_id) DO UPDATE SET sort_order = excluded.sort_order",
            params![agent_id, sort_order as i64],
        )?;
    }
    transaction.commit()
}

pub fn upsert_agent_config(
    conn: &Connection,
    agent_id: &str,
    custom_path: Option<&str>,
    disabled: bool,
) -> Result<()> {
    conn.execute("INSERT INTO agent_config (agent_id, custom_path, disabled) VALUES (?1, ?2, ?3) ON CONFLICT(agent_id) DO UPDATE SET custom_path=excluded.custom_path, disabled=excluded.disabled", params![agent_id, custom_path, disabled as i64])?;
    Ok(())
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

pub fn record_agent_unlinks(
    conn: &Connection,
    agent_id: &str,
    skill_names: &[String],
) -> Result<()> {
    let transaction = conn.unchecked_transaction()?;
    for skill_name in skill_names {
        upsert_agent_symlink(&transaction, agent_id, skill_name, "unlinked")?;
        log_activity(&transaction, "UNLINK_SKILL", skill_name, agent_id)?;
    }
    transaction.commit()
}

#[allow(dead_code)]
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

    let total_skills: i64 =
        conn.query_row("SELECT COUNT(*) FROM skills_master", [], |row| row.get(0))?;

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
    fn application_setting_defaults_to_disabled() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();
        assert!(!get_performance_diagnostics_enabled(&conn).unwrap());
    }

    #[test]
    fn application_setting_can_be_enabled_and_disabled() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();

        set_performance_diagnostics_enabled(&conn, true).unwrap();
        assert!(get_performance_diagnostics_enabled(&conn).unwrap());

        set_performance_diagnostics_enabled(&conn, false).unwrap();
        assert!(!get_performance_diagnostics_enabled(&conn).unwrap());
    }

    #[test]
    fn test_sqlite_db_init_and_operations() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();

        // 1. Upsert master skill
        upsert_master_skill(
            &conn,
            "frontend-design",
            "Create UI",
            "anthropics",
            "https://github.com/anthropics/skills",
            3,
        )
        .unwrap();
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
    }

    #[test]
    fn saves_agent_display_order_with_config_records() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();

        set_agent_sort_order(&conn, &["windsurf", "claude-code", "codex"]).unwrap();

        let configs = get_agent_configs(&conn).unwrap();
        assert_eq!(configs.iter().map(|config| config.agent_id.as_str()).collect::<Vec<_>>(), vec!["windsurf", "claude-code", "codex"]);
        assert_eq!(configs.iter().map(|config| config.sort_order).collect::<Vec<_>>(), vec![Some(0), Some(1), Some(2)]);
    }

    #[test]
    fn records_agent_unlinks_as_one_batch() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();
        let skill_names = vec!["skill-a".to_string(), "skill-b".to_string()];

        record_agent_unlinks(&conn, "codex", &skill_names).unwrap();

        let unlinked: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agent_symlinks WHERE agent_id = 'codex' AND status = 'unlinked'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let activities: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM activity_logs WHERE action = 'UNLINK_SKILL' AND target_agent = 'codex'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(unlinked, 2);
        assert_eq!(activities, 2);
    }

    #[test]
    fn application_setting_network_proxy_can_be_stored_and_retrieved() {
        let conn = open_db(Some(Path::new(":memory:"))).unwrap();
        assert_eq!(get_network_proxy(&conn).unwrap(), None);

        set_network_proxy(&conn, Some("http://127.0.0.1:7890")).unwrap();
        assert_eq!(get_network_proxy(&conn).unwrap(), Some("http://127.0.0.1:7890".to_string()));
        assert_eq!(std::env::var("HTTP_PROXY").unwrap(), "http://127.0.0.1:7890");

        set_network_proxy(&conn, None).unwrap();
        assert_eq!(get_network_proxy(&conn).unwrap(), None);
        assert!(std::env::var("HTTP_PROXY").is_err());
    }
}
