//! ASM 桌面应用入口。
//!
//! 装配 Tauri Builder、注册命令、挂载模块。模块实现见 `modules/`。

pub(crate) mod commands;
mod modules;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::ping,
            commands::scan_agents,
            commands::read_skill_content,
            commands::get_master_skills,
            commands::toggle_agent_skill,
            commands::import_to_master,
            commands::install_skill_to_master,
            commands::get_db_summary,
            commands::get_activity_logs,
            commands::save_skill_translation,
            commands::get_skill_translation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
