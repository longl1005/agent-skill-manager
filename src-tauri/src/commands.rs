//! Tauri 命令薄壳。命令体内只做参数转发和结果映射，业务逻辑全部下沉到 `modules/`。

use std::path::PathBuf;
use std::process::Command;
use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::modules::adapter::{
    AgentAdapter, AgentId, AntigravityAdapter, AugmentAdapter, ClaudeCodeAdapter, ClineAdapter, CodeBuddyAdapter, CodexAdapter, CursorAdapter,
    DetectContext, DroidAdapter, GitHubCopilotAdapter, GrokAdapter, HermesAdapter, KimiCodeAdapter, KiroAdapter, OhMyPiAdapter, OpenClawAdapter, OpenCodeAdapter, PiAgentAdapter,
    Platform, PlatformContext, QoderAdapter, QwenCodeAdapter, RooCodeAdapter, ScanContext, ScanId, ScanIssue, ScanResult, TraeAdapter,
    TraeCnAdapter, WindsurfAdapter, WorkBuddyAdapter,
};
use crate::modules::performance::{
    DiagnosticContext, DiagnosticErrorCategory, DiagnosticOperation, DiagnosticOutcome,
    DiagnosticPhase, EventCounters, OperationRecorder,
};

/// 整个 app 共享的 state。
#[derive(Default)]
pub struct AppState {
    pub last_report: Mutex<Option<ScanReport>>,
    pub last_inventory: Mutex<Option<crate::modules::inventory::Inventory>>,
    pub performance_diagnostics_enabled: AtomicBool,
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceDiagnosticsSummary {
    pub enabled: bool,
    pub report_count: usize,
    pub newest_event_at_ms: Option<u128>,
    pub report_directory_label: &'static str,
}

#[tauri::command]
pub fn get_performance_diagnostics_enabled(
    state: tauri::State<'_, AppState>,
) -> Result<bool, String> {
    let conn = crate::modules::db::open_db(None).map_err(|error| error.to_string())?;
    get_diagnostics_enabled(&conn, &state)
}

#[tauri::command]
pub fn set_performance_diagnostics_enabled(
    state: tauri::State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    let conn = crate::modules::db::open_db(None).map_err(|error| error.to_string())?;
    set_diagnostics_enabled(&conn, &state, enabled)
}

fn get_diagnostics_enabled(
    conn: &rusqlite::Connection,
    state: &AppState,
) -> Result<bool, String> {
    let enabled = crate::modules::db::get_performance_diagnostics_enabled(conn)
        .map_err(|error| error.to_string())?;
    state
        .performance_diagnostics_enabled
        .store(enabled, Ordering::Release);
    Ok(enabled)
}

fn set_diagnostics_enabled(
    conn: &rusqlite::Connection,
    state: &AppState,
    enabled: bool,
) -> Result<(), String> {
    crate::modules::db::set_performance_diagnostics_enabled(conn, enabled)
        .map_err(|error| error.to_string())?;
    state
        .performance_diagnostics_enabled
        .store(enabled, Ordering::Release);
    Ok(())
}

#[tauri::command]
pub fn get_performance_diagnostics_summary() -> Result<PerformanceDiagnosticsSummary, String> {
    let conn = crate::modules::db::open_db(None).map_err(|error| error.to_string())?;
    let enabled = crate::modules::db::get_performance_diagnostics_enabled(&conn)
        .map_err(|error| error.to_string())?;
    let summary = crate::modules::performance::summarize_reports().map_err(|error| error.to_string())?;

    Ok(diagnostics_summary_response(enabled, summary))
}

fn diagnostics_summary_response(
    enabled: bool,
    summary: crate::modules::performance::PerformanceDiagnosticsSummary,
) -> PerformanceDiagnosticsSummary {
    PerformanceDiagnosticsSummary {
        enabled,
        report_count: summary.report_count,
        newest_event_at_ms: summary.newest_event_at_ms,
        report_directory_label: "~/.asm/diagnostics",
    }
}

#[tauri::command]
pub fn export_performance_diagnostics(destination: String) -> Result<(), String> {
    crate::modules::performance::export_reports(&PathBuf::from(destination))
        .map(|_| ())
        .map_err(|_| "Unable to export performance diagnostics".to_string())
}

#[tauri::command]
pub fn clear_performance_diagnostics() -> Result<(), String> {
    crate::modules::performance::clear_reports()
        .map(|_| ())
        .map_err(|_| "Unable to clear performance diagnostics".to_string())
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
    diagnostic_context: Option<DiagnosticContext>,
) -> Result<ScanReport, String> {
    let recorder = operation_recorder(&state, DiagnosticOperation::ScanAgents, diagnostic_context);
    scan_agents_with_recorder(&state, custom_paths, recorder)
}

fn operation_recorder(
    state: &AppState,
    operation: DiagnosticOperation,
    diagnostic_context: Option<DiagnosticContext>,
) -> OperationRecorder {
    if state.performance_diagnostics_enabled.load(Ordering::Acquire) {
        OperationRecorder::enabled(operation, diagnostic_context)
    } else {
        OperationRecorder::disabled()
    }
}

fn scan_agents_with_recorder(
    state: &AppState,
    custom_paths: Option<std::collections::HashMap<String, String>>,
    mut recorder: OperationRecorder,
) -> Result<ScanReport, String> {
    let result: Result<ScanReport, String> = (|| {
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

        let det = {
            let _detect_phase = recorder.start_phase(DiagnosticPhase::AdapterDetect, None);
            let custom_det = adapter.detect(&DetectContext {
                platform: &platform_ctx,
                custom_path: custom_pathbuf.as_deref(),
            });
            // A custom Skills directory augments detection, but a missing/invalid path
            // must not make an installed Agent disappear from the UI.
            if custom_pathbuf.is_some() && custom_det.roots.is_empty() {
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
            }
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
        let scan_result: ScanResult = {
            let _scan_phase = recorder.start_phase(DiagnosticPhase::AdapterScan, None);
            if roots.is_empty() {
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
            }
        };

        // 收集 detect + scan 的 issues
        let mut all_issues: Vec<&ScanIssue> = det.issues.iter().collect();
        all_issues.extend(scan_result.issues.iter());

        let serialization_started = Instant::now();
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
        let fingerprinted_files = skill_reports
            .iter()
            .map(|skill| skill.file_count as u64)
            .sum();
        recorder.record_counted_phase(
            DiagnosticPhase::ReportSerialization,
            None,
            EventCounters {
                fingerprinted_files,
                ..EventCounters::default()
            },
            serialization_started,
            DiagnosticOutcome::Success,
        );

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
    })();

    let outcome = if result.is_ok() {
        DiagnosticOutcome::Success
    } else {
        DiagnosticOutcome::Error(DiagnosticErrorCategory::Io)
    };
    let _ = recorder.finish(outcome);
    result
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
    state: tauri::State<'_, AppState>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
    diagnostic_context: Option<DiagnosticContext>,
) -> Result<Vec<crate::modules::master_repo::MasterSkillReport>, String> {
    let mut recorder = operation_recorder(&state, DiagnosticOperation::GetMasterSkills, diagnostic_context);
    let reports = crate::modules::master_repo::scan_master_repo(custom_paths.as_ref(), &mut recorder);
    let _ = recorder.finish(DiagnosticOutcome::Success);
    Ok(reports)
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
    source_subdir: Option<String>,
    custom_paths: Option<std::collections::HashMap<String, String>>,
) -> Result<String, String> {
    crate::modules::master_repo::install_skill_to_master(
        &skill_name,
        source.as_deref(),
        source_subdir.as_deref(),
        custom_paths.as_ref(),
    )
    .map(|path| path.to_string_lossy().into_owned())
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn inspect_git_skills(
    source: String,
) -> Result<Vec<crate::modules::master_repo::GitSkillCandidate>, String> {
    crate::modules::master_repo::inspect_git_skills(&source).map_err(|error| error.to_string())
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::fs;
    use std::path::{Path, PathBuf};
    use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};

    static NEXT_FIXTURE_ID: AtomicUsize = AtomicUsize::new(1);

    struct ScanFixture {
        root: PathBuf,
        custom_paths: HashMap<String, String>,
    }

    impl ScanFixture {
        fn report_dir(&self) -> &Path {
            &self.root
        }
    }

    impl Drop for ScanFixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn fixture_home() -> ScanFixture {
        let fixture_id = NEXT_FIXTURE_ID.fetch_add(1, AtomicOrdering::Relaxed);
        let root = std::env::temp_dir().join(format!(
            "asm-command-diagnostics-{}-{fixture_id}",
            std::process::id()
        ));
        fs::create_dir_all(&root).unwrap();
        let mut custom_paths = HashMap::new();
        for adapter_id in [
            "claude-code", "cline", "codebuddy", "github-copilot", "droid", "qoder",
            "qwen-code", "hermes", "openclaw", "workbuddy", "kimi-code", "augment",
            "roo-code", "windsurf", "codex", "antigravity", "pi-agent", "oh-my-pi",
            "grok", "kiro", "trae", "trae-cn", "opencode", "cursor",
        ] {
            let path = root.join(adapter_id);
            fs::create_dir_all(&path).unwrap();
            custom_paths.insert(adapter_id.to_string(), path.to_string_lossy().into_owned());
        }
        ScanFixture { root, custom_paths }
    }

    fn run_scan_with_diagnostics(fixture: &ScanFixture) {
        let state = AppState::default();
        let recorder = OperationRecorder::enabled_at(
            fixture.report_dir(),
            DiagnosticOperation::ScanAgents,
            None,
        );
        scan_agents_with_recorder(&state, Some(fixture.custom_paths.clone()), recorder).unwrap();
    }

    fn read_report_events(report_dir: &Path) -> Vec<serde_json::Value> {
        fs::read_dir(report_dir.join("diagnostics"))
            .unwrap()
            .flatten()
            .flat_map(|entry| fs::read_to_string(entry.path()).unwrap().lines().map(str::to_owned).collect::<Vec<_>>())
            .map(|line| serde_json::from_str(&line).unwrap())
            .collect()
    }

    #[test]
    fn scan_records_a_parent_event_and_one_detect_event_per_adapter() {
        let fixture = fixture_home();
        run_scan_with_diagnostics(&fixture);
        let events = read_report_events(fixture.report_dir());

        assert_eq!(
            events
                .iter()
                .filter(|event| event["phase"] == "adapter_detect")
                .count(),
            24
        );
        assert!(events
            .iter()
            .any(|event| event["operation"] == "scan_agents" && event["eventType"] == "operation"));
    }

    #[test]
    fn diagnostics_toggle_persists_the_enabled_value_and_updates_the_cache() {
        let state = AppState::default();
        let conn = crate::modules::db::open_db(Some(Path::new(":memory:"))).unwrap();

        set_diagnostics_enabled(&conn, &state, true).unwrap();

        assert!(crate::modules::db::get_performance_diagnostics_enabled(&conn).unwrap());
        assert!(state.performance_diagnostics_enabled.load(Ordering::Acquire));
    }

    #[test]
    fn diagnostics_summary_exposes_only_the_safe_directory_label() {
        let summary = diagnostics_summary_response(
            true,
            crate::modules::performance::PerformanceDiagnosticsSummary {
                report_count: 2,
                event_count: 7,
                newest_event_at_ms: Some(42),
            },
        );

        let serialized = serde_json::to_string(&summary).unwrap();
        assert!(serialized.contains("~/.asm/diagnostics"));
        assert!(!serialized.contains("/Users/"));
    }
}
