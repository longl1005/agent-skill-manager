use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TrayLabels {
    pub show_window: &'static str,
    pub open_library: &'static str,
    pub quit: &'static str,
}

pub fn tray_labels(language: &str) -> Result<TrayLabels, &'static str> {
    match language {
        "en" => Ok(TrayLabels {
            show_window: "Show Main Window",
            open_library: "Open Master Skill Library",
            quit: "Quit Agent Skill Manager",
        }),
        "zh" => Ok(TrayLabels {
            show_window: "显示主窗口",
            open_library: "打开主技能仓库",
            quit: "退出应用",
        }),
        _ => Err("Unsupported tray language"),
    }
}

pub fn tray_statistics_labels(
    language: &str,
    master_skills: usize,
    connected_agents: usize,
) -> Result<[String; 2], &'static str> {
    match language {
        "en" => Ok([
            format!("Master Skills: {master_skills}"),
            format!("Connected Agents: {connected_agents}"),
        ]),
        "zh" => Ok([
            format!("主技能数：{master_skills}"),
            format!("已连接 Agent：{connected_agents}"),
        ]),
        _ => Err("Unsupported tray language"),
    }
}

#[derive(Default)]
pub struct TrayStatistics {
    master_skills: usize,
    connected_agents: usize,
}

pub struct TrayMenuItems {
    master_skills: tauri::menu::MenuItem<tauri::Wry>,
    connected_agents: tauri::menu::MenuItem<tauri::Wry>,
    show_window: tauri::menu::MenuItem<tauri::Wry>,
    open_library: tauri::menu::MenuItem<tauri::Wry>,
    quit: tauri::menu::MenuItem<tauri::Wry>,
}

pub fn update_menu_language(app: &tauri::AppHandle, language: &str) -> Result<(), String> {
    let labels = tray_labels(language).map_err(str::to_owned)?;
    let items = app
        .try_state::<TrayMenuItems>()
        .ok_or_else(|| "Tray menu is not initialized".to_string())?;

    items
        .show_window
        .set_text(labels.show_window)
        .map_err(|error| error.to_string())?;
    let statistics_state = app
        .try_state::<Mutex<TrayStatistics>>()
        .ok_or_else(|| "Tray statistics are not initialized".to_string())?;
    let statistics = statistics_state
        .lock()
        .map_err(|_| "Tray statistics lock is poisoned".to_string())?;
    let [master_skills, connected_agents] = tray_statistics_labels(
        language,
        statistics.master_skills,
        statistics.connected_agents,
    )
    .map_err(str::to_owned)?;
    items
        .master_skills
        .set_text(master_skills)
        .map_err(|error| error.to_string())?;
    items
        .connected_agents
        .set_text(connected_agents)
        .map_err(|error| error.to_string())?;
    items
        .open_library
        .set_text(labels.open_library)
        .map_err(|error| error.to_string())?;
    items
        .quit
        .set_text(labels.quit)
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub fn update_tray_statistics(
    app: &tauri::AppHandle,
    language: &str,
    master_skills: usize,
    connected_agents: usize,
) -> Result<(), String> {
    let statistics = app
        .try_state::<Mutex<TrayStatistics>>()
        .ok_or_else(|| "Tray statistics are not initialized".to_string())?;
    let mut statistics = statistics
        .lock()
        .map_err(|_| "Tray statistics lock is poisoned".to_string())?;
    statistics.master_skills = master_skills;
    statistics.connected_agents = connected_agents;
    drop(statistics);
    update_menu_language(app, language)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayAction {
    ShowWindow,
    OpenLibrary,
    Quit,
}

pub fn action_for_menu_id(id: &str) -> Option<TrayAction> {
    match id {
        "tray-toggle-window" => Some(TrayAction::ShowWindow),
        "tray-open-library" => Some(TrayAction::OpenLibrary),
        "tray-quit" => Some(TrayAction::Quit),
        _ => None,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(not(test), allow(dead_code))]
pub enum TrayPlatform {
    MacOs,
    Windows,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayIconKind {
    Template,
    DefaultWindowIcon,
}

pub fn tray_icon_kind_for_platform(platform: TrayPlatform) -> TrayIconKind {
    match platform {
        TrayPlatform::MacOs => TrayIconKind::Template,
        TrayPlatform::Windows => TrayIconKind::DefaultWindowIcon,
    }
}

#[cfg(target_os = "macos")]
fn current_tray_platform() -> TrayPlatform {
    TrayPlatform::MacOs
}

#[cfg(target_os = "windows")]
fn current_tray_platform() -> TrayPlatform {
    TrayPlatform::Windows
}

pub fn require_default_window_icon<T>(icon: Option<T>) -> Result<T, &'static str> {
    icon.ok_or("Windows tray requires the default window icon")
}

pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    use tauri::{
        menu::{Menu, MenuItem, PredefinedMenuItem},
        tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
        Emitter, Manager,
    };

    let labels = tray_labels("zh").expect("Chinese tray labels must remain available");
    let [master_skills_label, connected_agents_label] = tray_statistics_labels("zh", 0, 0)
        .expect("Chinese tray statistic labels must remain available");
    let master_skills = MenuItem::with_id(
        app,
        "tray-master-skills",
        master_skills_label,
        false,
        None::<&str>,
    )?;
    let connected_agents = MenuItem::with_id(
        app,
        "tray-connected-agents",
        connected_agents_label,
        false,
        None::<&str>,
    )?;
    let statistics_separator = PredefinedMenuItem::separator(app)?;
    let show_window = MenuItem::with_id(
        app,
        "tray-toggle-window",
        labels.show_window,
        true,
        None::<&str>,
    )?;
    let open_library = MenuItem::with_id(
        app,
        "tray-open-library",
        labels.open_library,
        true,
        None::<&str>,
    )?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "tray-quit", labels.quit, true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &master_skills,
            &connected_agents,
            &statistics_separator,
            &show_window,
            &open_library,
            &separator,
            &quit,
        ],
    )?;

    let tray = TrayIconBuilder::with_id("main-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match action_for_menu_id(event.id().as_ref()) {
            Some(TrayAction::ShowWindow) => {
                show_main_window(app);
            }
            Some(TrayAction::OpenLibrary) => {
                if show_main_window(app) {
                    if let Err(error) = app.emit("tray:open-library", ()) {
                        eprintln!("Failed to emit tray open-library event: {error}");
                    }
                }
            }
            Some(TrayAction::Quit) => app.exit(0),
            None => {}
        })
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show_main_window(tray.app_handle());
            }
        });

    let tray = match tray_icon_kind_for_platform(current_tray_platform()) {
        TrayIconKind::Template => tray
            .icon(tauri::include_image!("./icons/tray-template.png"))
            .icon_as_template(true),
        TrayIconKind::DefaultWindowIcon => {
            let icon = require_default_window_icon(app.default_window_icon().cloned())
                .map_err(|message| tauri::Error::AssetNotFound(message.to_owned()))?;
            tray.icon(icon)
        }
    };

    tray.build(app)?;

    app.manage(TrayMenuItems {
        master_skills,
        connected_agents,
        show_window,
        open_library,
        quit,
    });
    app.manage(Mutex::new(TrayStatistics::default()));

    if let Some(window) = app.get_webview_window("main") {
        let window_for_events = window.clone();
        window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                if let Err(error) = window_for_events.hide() {
                    eprintln!("Failed to hide main window after close request: {error}");
                }
            }
        });
    }

    Ok(())
}

pub(crate) fn show_main_window(app: &tauri::AppHandle) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        eprintln!("Cannot show main window: window not found");
        return false;
    };

    if let Err(error) = window.unminimize() {
        eprintln!("Failed to unminimize main window: {error}");
        return false;
    }

    if let Err(error) = window.show() {
        eprintln!("Failed to show main window: {error}");
        return false;
    }

    if let Err(error) = window.set_focus() {
        eprintln!("Failed to focus main window: {error}");
        return false;
    }

    true
}

#[cfg(test)]
mod tests {
    use super::{
        action_for_menu_id, require_default_window_icon, tray_icon_kind_for_platform, tray_labels,
        tray_statistics_labels, TrayAction, TrayIconKind, TrayPlatform,
    };

    #[test]
    fn maps_each_supported_menu_id_to_a_tray_action() {
        assert_eq!(
            action_for_menu_id("tray-toggle-window"),
            Some(TrayAction::ShowWindow)
        );
        assert_eq!(action_for_menu_id("tray-refresh"), None);
        assert_eq!(
            action_for_menu_id("tray-open-library"),
            Some(TrayAction::OpenLibrary)
        );
        assert_eq!(action_for_menu_id("tray-quit"), Some(TrayAction::Quit));
        assert_eq!(action_for_menu_id("unknown"), None);
    }

    #[test]
    fn returns_all_chinese_and_english_menu_labels() {
        let zh = tray_labels("zh").expect("Chinese is a supported tray language");
        assert_eq!(zh.show_window, "显示主窗口");
        assert_eq!(zh.open_library, "打开主技能仓库");
        assert_eq!(zh.quit, "退出应用");

        let en = tray_labels("en").expect("English is a supported tray language");
        assert_eq!(en.show_window, "Show Main Window");
        assert_eq!(en.open_library, "Open Master Skill Library");
        assert_eq!(en.quit, "Quit Agent Skill Manager");
    }

    #[test]
    fn returns_localized_tray_statistics_labels() {
        assert_eq!(
            tray_statistics_labels("zh", 19, 9).unwrap(),
            ["主技能数：19", "已连接 Agent：9"]
        );
        assert_eq!(
            tray_statistics_labels("en", 19, 9).unwrap(),
            ["Master Skills: 19", "Connected Agents: 9"]
        );
    }

    #[test]
    fn rejects_unsupported_tray_languages() {
        assert_eq!(tray_labels("fr").unwrap_err(), "Unsupported tray language");
        assert_eq!(tray_labels("").unwrap_err(), "Unsupported tray language");
    }

    #[test]
    fn preserves_platform_specific_tray_icon_intent() {
        assert_eq!(
            tray_icon_kind_for_platform(TrayPlatform::MacOs),
            TrayIconKind::Template
        );
        assert_eq!(
            tray_icon_kind_for_platform(TrayPlatform::Windows),
            TrayIconKind::DefaultWindowIcon
        );
    }

    #[test]
    fn requires_the_windows_default_window_icon() {
        assert_eq!(require_default_window_icon(Some(7)), Ok(7));
        assert_eq!(
            require_default_window_icon::<u8>(None),
            Err("Windows tray requires the default window icon")
        );
    }
}
