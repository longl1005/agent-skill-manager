//! Tauri 命令薄壳。命令体内只做参数转发和结果映射，业务逻辑全部下沉到 `modules/`。

use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::modules::adapter::{
    AgentAdapter, AgentId, AntigravityAdapter, AugmentAdapter, ClaudeCodeAdapter, ClineAdapter, CodeBuddyAdapter, CodexAdapter, CursorAdapter,
    DetectContext, DroidAdapter, GitHubCopilotAdapter, GrokAdapter, HermesAdapter, KimiCodeAdapter, KiroAdapter, OhMyPiAdapter, OpenClawAdapter, OpenCodeAdapter, PiAgentAdapter,
    Platform, PlatformContext, QoderAdapter, QwenCodeAdapter, RooCodeAdapter, ScanContext, ScanId, ScanIssue, ScanResult, TraeAdapter,
    TraeCnAdapter, WindsurfAdapter, WorkBuddyAdapter,
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

/// 用系统默认浏览器打开外部文档链接。
///
/// Tauri 的 WebView 不会自动处理 `target="_blank"`；统一经过这个
/// command 可以保证 skills.sh / GitHub 文档在 macOS 等桌面端可用。
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let url = url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("Only http(s) URLs can be opened".to_string());
    }

    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("cmd");
        command.args(["/C", "start", ""]);
        command
    };
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command.arg(url);
    command
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("Unable to open external link: {err}"))
}

/// Open a local skill directory in the platform file manager.
#[tauri::command]
pub fn open_skill_directory(location: String) -> Result<(), String> {
    let path = PathBuf::from(location);
    if !path.is_dir() {
        return Err(format!("Skill directory does not exist: {}", path.display()));
    }

    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");

    command
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("Unable to open skill directory: {error}"))
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
    pub modified_at: u64,
    pub fingerprint_short: String,
    pub file_count: usize,
    pub is_symlink: bool,
    pub symlink_target: Option<String>,
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

    // 注册的 adapter 列表。
    let adapters: Vec<Box<dyn AgentAdapter>> = vec![
        Box::new(ClaudeCodeAdapter),
        Box::new(ClineAdapter),
        Box::new(CodeBuddyAdapter),
        Box::new(GitHubCopilotAdapter),
        Box::new(DroidAdapter),
        Box::new(QoderAdapter),
        Box::new(QwenCodeAdapter),
        Box::new(HermesAdapter),
        Box::new(OpenClawAdapter),
        Box::new(WorkBuddyAdapter),
        Box::new(KimiCodeAdapter),
        Box::new(AugmentAdapter),
        Box::new(RooCodeAdapter),
        Box::new(WindsurfAdapter),
        Box::new(CodexAdapter),
        Box::new(AntigravityAdapter),
        Box::new(PiAgentAdapter),
        Box::new(OhMyPiAdapter),
        Box::new(GrokAdapter),
        Box::new(KiroAdapter),
        Box::new(TraeAdapter),
        Box::new(TraeCnAdapter),
        Box::new(OpenCodeAdapter),
        Box::new(CursorAdapter),
    ];

    let mut agent_reports: Vec<AgentReport> = Vec::new();
    let mut total_skills = 0usize;
    let mut total_issues = 0usize;

    for adapter in &adapters {
        let custom_path_str = custom_paths.as_ref().and_then(|m| m.get(&adapter.id().0));
        let custom_pathbuf =
            custom_path_str.map(|path| crate::modules::master_repo::expand_config_path(path));

        let custom_det = adapter.detect(&DetectContext {
            platform: &platform_ctx,
            custom_path: custom_pathbuf.as_deref(),
        });
        // A custom Skills directory augments detection, but a missing/invalid path
        // must not make an installed Agent disappear from the UI.
        let det = if custom_pathbuf.is_some() && custom_det.roots.is_empty() {
            let mut fallback = adapter.detect(&DetectContext {
                platform: &platform_ctx,
                custom_path: None,
            });
            if !fallback.roots.is_empty() {
                fallback.issues.extend(custom_det.issues);
                fallback
            } else {
                custom_det
            }
        } else {
            custom_det
        };
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
                is_symlink: std::fs::symlink_metadata(&inst.location.display_path)
                    .map(|metadata| metadata.file_type().is_symlink())
                    .unwrap_or(false),
                symlink_target: std::fs::read_link(&inst.location.display_path)
                    .ok()
                    .map(|path| path.to_string_lossy().into_owned()),
                name: inst.identity.normalized_name.clone(),
                description: inst.metadata.description.clone(),
                license: inst.metadata.license.clone(),
                location: inst.location.display_path.to_string_lossy().into_owned(),
                modified_at: std::fs::metadata(&inst.location.canonical_path)
                    .and_then(|metadata| metadata.modified())
                    .ok()
                    .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_millis() as u64)
                    .unwrap_or(0),
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

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[tauri::command]
pub fn set_tray_language(app: tauri::AppHandle, language: String) -> Result<(), String> {
    crate::tray::update_menu_language(&app, &language)
}

#[cfg(any(target_os = "macos", target_os = "windows"))]
#[tauri::command]
pub fn set_tray_statistics(
    app: tauri::AppHandle,
    language: String,
    master_skills: usize,
    connected_agents: usize,
) -> Result<(), String> {
    crate::tray::update_tray_statistics(&app, &language, master_skills, connected_agents)
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
    Ok(crate::modules::master_repo::scan_master_repo(
        custom_paths.as_ref(),
    ))
}

#[tauri::command]
pub fn toggle_agent_skill(
    agent_id: String,
    skill_name: String,
    enable: bool,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<bool, String> {
    crate::modules::master_repo::toggle_skill_symlink(
        &agent_id,
        &skill_name,
        enable,
        custom_paths.as_ref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_agent_skills_batch(
    agent_ids: Vec<String>,
    skill_name: String,
    enable: bool,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<usize, String> {
    crate::modules::master_repo::toggle_skill_symlinks_batch(
        &agent_ids,
        &skill_name,
        enable,
        custom_paths.as_ref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn replace_agent_local_skill_with_symlink(
    agent_id: String,
    skill_name: String,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<bool, String> {
    crate::modules::master_repo::replace_agent_local_skill_with_symlink(
        &agent_id,
        &skill_name,
        custom_paths.as_ref(),
    )
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn delete_agent_skill(
    agent_id: String,
    skill_name: String,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<bool, String> {
    crate::modules::master_repo::delete_agent_skill(&agent_id, &skill_name, custom_paths.as_ref())
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn unlink_all_agent_skills(
    agent_id: String,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<usize, String> {
    crate::modules::master_repo::unlink_all_agent_skills(&agent_id, custom_paths.as_ref())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn migrate_agent_skills_dir(
    agent_id: String,
    old_custom_path: Option<String>,
    new_path: String,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<usize, String> {
    crate::modules::master_repo::migrate_agent_skills_dir(
        &agent_id,
        old_custom_path.as_deref(),
        &crate::modules::master_repo::expand_config_path(&new_path),
        custom_paths.as_ref(),
    )
    .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn reset_agent_skills_dir(
    agent_id: String,
    old_custom_path: Option<String>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<usize, String> {
    let target = crate::modules::master_repo::get_agent_skills_dir(&agent_id, None)
        .ok_or_else(|| "Unknown agent".to_string())?;
    crate::modules::master_repo::migrate_agent_skills_dir(
        &agent_id,
        old_custom_path.as_deref(),
        &target,
        custom_paths.as_ref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_agent_configs() -> Result<Vec<crate::modules::db::DbAgentConfig>, String> {
    crate::modules::db::open_db(None)
        .and_then(|db| crate::modules::db::get_agent_configs(&db))
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn set_agent_config(
    agent_id: String,
    custom_path: Option<String>,
    disabled: bool,
) -> Result<(), String> {
    crate::modules::db::open_db(None)
        .and_then(|db| {
            crate::modules::db::upsert_agent_config(
                &db,
                &agent_id,
                custom_path.as_deref(),
                disabled,
            )
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_agent_sort_order(agent_ids: Vec<String>) -> Result<(), String> {
    let agent_ids: Vec<&str> = agent_ids.iter().map(String::as_str).collect();
    crate::modules::db::open_db(None)
        .and_then(|db| crate::modules::db::set_agent_sort_order(&db, &agent_ids))
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
    crate::modules::master_repo::import_skill_to_master_with_mode(
        &agent_id,
        &skill_name,
        mode,
        custom_paths.as_ref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn install_skill_to_master(
    skill_name: String,
    source: Option<String>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<String, String> {
    crate::modules::master_repo::install_skill_to_master(
        &skill_name,
        source.as_deref(),
        custom_paths.as_ref(),
    )
    .map(|path| path.to_string_lossy().into_owned())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_master_skill_zip(
    skill_name: String,
    destination: String,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<String, String> {
    crate::modules::master_repo::export_master_skill_zip(
        &skill_name,
        &PathBuf::from(destination),
        custom_paths.as_ref(),
    )
    .map(|path| path.to_string_lossy().into_owned())
    .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_db_summary() -> Result<crate::modules::db::DbSummaryReport, String> {
    let conn = crate::modules::db::open_db(None).map_err(|e| e.to_string())?;
    crate::modules::db::get_db_summary(&conn, None).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_master_skill(
    skill_name: String,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<Vec<String>, String> {
    crate::modules::master_repo::delete_master_skill(&skill_name, custom_paths.as_ref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_activity_logs(
    limit: Option<usize>,
) -> Result<Vec<crate::modules::db::DbActivityLog>, String> {
    let conn = crate::modules::db::open_db(None).map_err(|e| e.to_string())?;
    crate::modules::db::get_activity_logs(&conn, limit.unwrap_or(20)).map_err(|e| e.to_string())
}
