# System Tray Design

## Goal

Add a native system tray experience for Agent Skill Manager on macOS and Windows. Closing the main window hides it to the tray so background work can continue; quitting remains an explicit action from the tray menu.

## Scope

- Enable Tauri 2's `tray-icon` feature and create one Rust-managed tray icon at application startup.
- Use the current application icon on Windows. Supply a monochrome macOS template icon for the menu bar.
- Keep the tray icon alive for the full application lifetime.
- Intercept a main-window close request and hide the window instead of terminating the process.

## Tray interactions

### Mouse behavior

- Left click: show and focus the main window. If visible, hide it.
- Right click: open the native tray menu.

### Menu

1. **显示 / 隐藏主窗口** — toggles main-window visibility and focuses it when shown.
2. **立即刷新** — emits a frontend event. The frontend runs the existing Agent scan and master-skill repository refresh, whether the window is visible or hidden.
3. **打开主技能仓库** — shows and focuses the main window, then emits a navigation event that routes to `/library`.
4. **退出应用** — performs an explicit app exit. This is the only close path that terminates the background process.

Menu labels are localized from the selected application language. The initial tray menu uses Chinese, and a language change updates menu item labels without recreating the tray icon.

## Architecture and data flow

```text
Native tray menu / click
          |
          +-- show/hide window: Rust Window API
          |
          +-- refresh: emit "tray:refresh" --> scanStore.scan + masterRepoStore.fetchMasterSkills
          |
          +-- open library: show/focus --> emit "tray:open-library" --> HashRouter /library
          |
          +-- quit: app.exit(0)
```

- Rust owns native menu creation, click handling, icon lifecycle, and window-close interception.
- React owns route navigation and reuses the existing stores for scanning and master repository data.
- A small command updates localized menu labels when the frontend language changes.

## Error handling

- A failed refresh preserves the current visible data and uses existing store error states; it does not close or disable the tray.
- Missing main window is ignored safely by tray handlers.
- If tray setup fails during startup, application launch fails with the Tauri error rather than silently running without the requested background controls.

## Testing

- Rust unit tests cover menu-event routing decisions independently from platform UI.
- Frontend tests verify tray refresh invokes both existing store refresh functions and tray navigation routes to `/library`.
- Manual macOS and Windows checks verify close-to-tray, left-click restoration, native right-click menu, refresh behavior, library navigation, and explicit exit.

## Non-goals

- No background scheduler or periodic sync is introduced.
- No Linux tray behavior is included in this scope.
- No notification-center alerts are added.
