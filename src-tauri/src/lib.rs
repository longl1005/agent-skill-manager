//! ASM 桌面应用入口。
//!
//! 装配 Tauri Builder、注册命令、挂载模块。模块实现见 `modules/`。

pub(crate) mod commands;
mod modules;
#[cfg(any(target_os = "macos", target_os = "windows"))]
mod tray;

#[cfg(target_os = "macos")]
fn should_restore_main_window_on_reopen(has_visible_windows: bool) -> bool {
    !has_visible_windows
}

#[cfg(test)]
mod tests {
    #[cfg(target_os = "macos")]
    use super::should_restore_main_window_on_reopen;

    #[cfg(target_os = "macos")]
    #[test]
    fn restores_the_main_window_when_macos_reopens_a_hidden_app() {
        assert!(should_restore_main_window_on_reopen(false));
        assert!(!should_restore_main_window_on_reopen(true));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::open_external_url,
            commands::open_skill_directory,
            commands::get_performance_diagnostics_enabled,
            commands::set_performance_diagnostics_enabled,
            commands::get_performance_diagnostics_summary,
            commands::export_performance_diagnostics,
            commands::clear_performance_diagnostics,
            commands::scan_agents,
            commands::read_skill_content,
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            commands::set_tray_language,
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            commands::set_tray_statistics,
            commands::set_tray_visible,
            commands::hide_main_window,
            commands::exit_app,
            commands::get_network_proxy,
            commands::set_network_proxy,
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
            commands::inspect_git_skills,
            commands::install_skill_to_master,
            commands::export_master_skill_zip,
            commands::delete_master_skill,
            commands::get_db_summary,
            commands::get_activity_logs
        ])
        .setup(|app| {
            use tauri::Manager;
            if let Ok(conn) = crate::modules::db::open_db(None) {
                if let Ok(Some(proxy)) = crate::modules::db::get_network_proxy(&conn) {
                    crate::modules::db::apply_network_proxy_to_env(Some(&proxy));
                }
            }
            #[cfg(any(target_os = "macos", target_os = "windows"))]
            tray::setup(app)?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Agent Skill Manager")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } = event
            {
                if should_restore_main_window_on_reopen(has_visible_windows) {
                    tray::show_main_window(app);
                }
            }
        });
}
