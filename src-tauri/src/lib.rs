//! ASM 桌面应用入口。
//!
//! 装配 Tauri Builder、注册命令、挂载模块。模块实现见 `modules/`。

pub(crate) mod commands;
mod modules;
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod tray;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::open_external_url,
            commands::open_skill_directory,
            commands::scan_agents,
            commands::read_skill_content,
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            commands::set_tray_language,
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            commands::set_tray_statistics,
            commands::get_master_skills,
            commands::toggle_agent_skill,
            commands::toggle_agent_skills_batch,
            commands::replace_agent_local_skill_with_symlink,
            commands::delete_agent_skill,
            commands::unlink_all_agent_skills,
            commands::migrate_agent_skills_dir,
            commands::reset_agent_skills_dir,
            commands::get_agent_configs,
            commands::set_agent_config,
            commands::set_agent_sort_order,
            commands::import_to_master,
            commands::install_skill_to_master,
            commands::export_master_skill_zip,
            commands::delete_master_skill,
            commands::get_db_summary,
            commands::get_activity_logs
        ])
        .setup(|_app| {
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            tray::setup(_app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
