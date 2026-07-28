//! Tauri 命令薄壳。命令体内只做参数转发和结果映射，业务逻辑全部下沉到 `modules/`。

use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::modules::adapter::{
    AgentAdapter, AgentId, AntigravityAdapter, ClaudeCodeAdapter, CodexAdapter, CursorAdapter, DetectContext, Platform, PlatformContext,
    PiAgentAdapter, OpenCodeAdapter, ScanContext, ScanId, ScanIssue, ScanResult,
};

/// 整个 app 共享的 state。
#[derive(Default)]
pub struct AppState {
    pub last_report: Mutex<Option<ScanReport>>,
    pub last_inventory: Mutex<Option<crate::modules::inventory::Inventory>>,
}

// ============================================================
// ping 命令（脚手架阶段留下）
// ============================================================

#[derive(Serialize)]
pub struct PingResponse {
    pub message: &'static str,
}

#[tauri::command]
pub fn ping() -> PingResponse {
    PingResponse { message: "pong" }
}

// ============================================================
// scan_agents 命令（M0 新增）
// ============================================================

#[derive(Clone, Serialize)]
pub struct ScanReport {
    pub scan_id: String,
    pub started_at: u64,
    pub completed_at: u64,
    pub agents: Vec<AgentReport>,
    pub total_skills: usize,
    pub total_issues: usize,
}

#[derive(Clone, Serialize)]
pub struct AgentReport {
    pub agent_id: String,
    pub display_name: String,
    pub detection_status: String,
    pub roots: Vec<RootReport>,
    pub skills: Vec<SkillReport>,
    pub issues: Vec<IssueReport>,
    pub outcome: String,
}

#[derive(Clone, Serialize)]
pub struct RootReport {
    pub root_id: String,
    pub scope: String,
    pub display_path: String,
}

#[derive(Clone, Serialize)]
pub struct SkillReport {
    pub name: String,
    pub description: String,
    pub license: Option<String>,
    pub location: String,
    pub fingerprint_short: String,
    pub file_count: usize,
    pub issues: Vec<IssueReport>,
}

#[derive(Clone, Serialize)]
pub struct IssueReport {
    pub code: String,
    pub severity: String,
    pub phase: String,
    pub path: Option<String>,
    pub message: String,
}

#[tauri::command]
pub fn scan_agents(
    state: tauri::State<'_, AppState>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<ScanReport, String> {
    let started_at = SystemTime::now();

    // 构造 platform context
    let home = crate::modules::platform::user_home_dir().unwrap_or_else(|| PathBuf::from("/"));
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("/"));
    let platform_ctx = PlatformContext {
        platform: Platform::current().ok_or("unsupported platform")?,
        home_dir: home,
        cwd,
    };

    // 注册的 adapter 列表（ClaudeCodeAdapter, CodexAdapter, AntigravityAdapter, PiAgentAdapter & OpenCodeAdapter）
    let adapters: Vec<Box<dyn AgentAdapter>> = vec![
        Box::new(ClaudeCodeAdapter),
        Box::new(CodexAdapter),
        Box::new(AntigravityAdapter),
        Box::new(PiAgentAdapter),
        Box::new(OpenCodeAdapter),
        Box::new(CursorAdapter),
    ];

    let mut agent_reports: Vec<AgentReport> = Vec::new();
    let mut total_skills = 0usize;
    let mut total_issues = 0usize;

    for adapter in &adapters {
        let custom_path_str = custom_paths.as_ref().and_then(|m| m.get(&adapter.id().0));
        let custom_pathbuf = custom_path_str.map(PathBuf::from);

        let det = adapter.detect(&DetectContext {
            platform: &platform_ctx,
            custom_path: custom_pathbuf.as_deref(),
        });
        let roots = adapter.skill_roots(&det);
        let descriptor = adapter.descriptor();

        // 把 roots 转 DTO
        let mut root_reports: Vec<RootReport> = roots
            .iter()
            .map(|r| RootReport {
                root_id: r.root_id.clone(),
                scope: format!("{:?}", r.scope),
                display_path: r.display_path.to_string_lossy().into_owned(),
            })
            .collect();

        let scan_id = ScanId::new();
        let scan_result: ScanResult = if roots.is_empty() {
            // 跳过 scan, 但报告里仍带 issues (detect 的)
            ScanResult {
                scan_id,
                agent_id: adapter.id(),
                outcome: match det.status {
                    crate::modules::adapter::DetectionStatus::Failed => {
                        crate::modules::adapter::ScanOutcome::Failed
                    }
                    crate::modules::adapter::DetectionStatus::Unavailable => {
                        crate::modules::adapter::ScanOutcome::Completed
                    }
                    _ => crate::modules::adapter::ScanOutcome::Completed,
                },
                completeness: crate::modules::adapter::ScanCompleteness::Complete,
                installations: vec![],
                issues: det.issues.clone(),
                started_at,
                completed_at: SystemTime::now(),
            }
        } else {
            let scan_ctx = ScanContext {
                scan_id,
                agent: adapter.id(),
                roots: &roots,
                platform: &platform_ctx,
                started_at,
            };
            adapter.scan(&scan_ctx)
        };

        // 收集 detect + scan 的 issues
        let mut all_issues: Vec<&ScanIssue> = det.issues.iter().collect();
        all_issues.extend(scan_result.issues.iter());

        let skill_reports: Vec<SkillReport> = scan_result
            .installations
            .iter()
            .map(|inst| SkillReport {
                name: inst.identity.normalized_name.clone(),
                description: inst.metadata.description.clone(),
                license: inst.metadata.license.clone(),
                location: inst.location.display_path.to_string_lossy().into_owned(),
                fingerprint_short: inst
                    .content_fingerprint
                    .as_ref()
                    .map(|f| f.digest.chars().take(8).collect())
                    .unwrap_or_default(),
                file_count: inst
                    .content_fingerprint
                    .as_ref()
                    .map(|f| f.file_count)
                    .unwrap_or(0),
                issues: inst.diagnostics.iter().map(issue_to_report).collect(),
            })
            .collect();

        total_skills += skill_reports.len();
        total_issues += all_issues.len();

        // 排序 issues: Error > Warning > Info
        let mut sorted_issues: Vec<IssueReport> =
            all_issues.iter().map(|i| issue_to_report(i)).collect();
        sorted_issues.sort_by_key(|a| severity_rank(&a.severity));

        agent_reports.push(AgentReport {
            agent_id: agent_id_to_str(&adapter.id()),
            display_name: descriptor.display_name,
            detection_status: format!("{:?}", det.status),
            roots: std::mem::take(&mut root_reports),
            skills: skill_reports,
            issues: sorted_issues,
            outcome: format!("{:?}", scan_result.outcome),
        });
    }

    let completed = SystemTime::now();
    let report = ScanReport {
        scan_id: UuidWrapper::new(),
        started_at: unix_millis(started_at),
        completed_at: unix_millis(completed),
        agents: agent_reports,
        total_skills,
        total_issues,
    };

    // 存到 state
    if let Ok(mut guard) = state.last_report.lock() {
        *guard = Some(report.clone());
    }
    if let Ok(mut guard) = state.last_inventory.lock() {
        *guard = Some(crate::modules::inventory::project(&report));
    }

    Ok(report)
}

fn issue_to_report(i: &ScanIssue) -> IssueReport {
    IssueReport {
        code: i.code.clone(),
        severity: format!("{:?}", i.severity),
        phase: format!("{:?}", i.phase),
        path: i.path.as_ref().map(|p| p.to_string_lossy().into_owned()),
        message: i.message.clone(),
    }
}

fn severity_rank(s: &str) -> u8 {
    match s {
        "Error" => 0,
        "Warning" => 1,
        "Info" => 2,
        _ => 3,
    }
}

fn agent_id_to_str(id: &AgentId) -> String {
    // AgentId 是 pub struct AgentId(pub String); 从 id.0 读真实值（与 ClaudeCodeAdapter::id() 一致）
    id.0.clone()
}

fn unix_millis(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn read_skill_content(location: String) -> Result<String, String> {
    let path = PathBuf::from(&location);
    let entry_file = if path.is_file() {
        path
    } else {
        path.join("SKILL.md")
    };

    std::fs::read_to_string(&entry_file)
        .map_err(|e| format!("Failed to read SKILL.md at {:?}: {}", entry_file, e))
}

// 简易 uuid 包装, 避免在 commands.rs 引入 uuid::Uuid 的额外 import
struct UuidWrapper;
impl UuidWrapper {
    #[allow(clippy::new_ret_no_self)]
    fn new() -> String {
        uuid::Uuid::new_v4().to_string()
    }
}

// ============================================================
// Master Repo commands
// ============================================================

#[tauri::command]
pub fn get_master_skills(
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<crate::modules::master_repo::MasterSkillReport>, String> {
    Ok(crate::modules::master_repo::scan_master_repo(custom_paths.as_ref()))
}

#[tauri::command]
pub fn toggle_agent_skill(
    agent_id: String,
    skill_name: String,
    enable: bool,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<bool, String> {
    crate::modules::master_repo::toggle_skill_symlink(&agent_id, &skill_name, enable, custom_paths.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn import_to_master(
    agent_id: String,
    skill_name: String,
    mode: Option<crate::modules::master_repo::ImportMode>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<crate::modules::master_repo::ImportResult, String> {
    let mode = mode.unwrap_or(crate::modules::master_repo::ImportMode::Auto);
    crate::modules::master_repo::import_skill_to_master_with_mode(&agent_id, &skill_name, mode, custom_paths.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn install_skill_to_master(
    skill_name: String,
    source: Option<String>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<String, String> {
    crate::modules::master_repo::install_skill_to_master(&skill_name, source.as_deref(), custom_paths.as_ref())
        .map(|path| path.to_string_lossy().into_owned())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_db_summary() -> Result<crate::modules::db::DbSummaryReport, String> {
    let conn = crate::modules::db::open_db(None).map_err(|e| e.to_string())?;
    crate::modules::db::get_db_summary(&conn, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_activity_logs(limit: Option<usize>) -> Result<Vec<crate::modules::db::DbActivityLog>, String> {
    let conn = crate::modules::db::open_db(None).map_err(|e| e.to_string())?;
    crate::modules::db::get_activity_logs(&conn, limit.unwrap_or(20)).map_err(|e| e.to_string())
}
