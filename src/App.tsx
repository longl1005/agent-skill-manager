import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";
import AppSidebar from "./components/AppSidebar";
import Dashboard from "./routes/Dashboard";
import SkillLibrary from "./routes/SkillLibrary";
import InstallSkills from "./routes/InstallSkills";
import AgentMatrix from "./routes/AgentMatrix";
import Agents from "./routes/Agents";
import AgentDetail from "./routes/AgentDetail";
import SkillDetail from "./routes/SkillDetail";
import OnlineSkillDetail from "./routes/OnlineSkillDetail";
import ScanHistory from "./routes/ScanHistory";
import Settings from "./routes/Settings";
import { useThemeStore } from "./stores/themeStore";
import { useScanStore } from "./stores/scanStore";
import { useMasterRepoStore } from "./stores/masterRepoStore";
import { useAgentConfigStore } from "./stores/agentConfigStore";
import { useUiStore } from "./stores/uiStore";
import { useI18nStore } from "./stores/i18nStore";
import { t } from "./locales/dict";
import { TrayEventBridge } from "./hooks/useTrayEvents";
import { UpdateDialog } from "./components/UpdateDialog";
import { useUpdateStore } from "./stores/updateStore";

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme);
  const scan = useScanStore((s) => s.scan);
  const fetchMasterSkills = useMasterRepoStore((s) => s.fetchMasterSkills);
  const hydrateAgentConfig = useAgentConfigStore((s) => s.hydrate);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const lang = useI18nStore((s) => s.lang);
  const sidebarToggleLabel = t(sidebarCollapsed ? "nav.expandSidebar" : "nav.collapseSidebar", lang);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);

  const startWindowDrag = () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    void getCurrentWindow().startDragging().catch(() => undefined);
  };

  useEffect(() => {
    initTheme();
    void hydrateAgentConfig().catch(() => undefined).finally(() => { scan(); fetchMasterSkills(); });
    void checkForUpdates(true);
  }, [initTheme, scan, fetchMasterSkills, hydrateAgentConfig, checkForUpdates]);

  return (
    <HashRouter>
      <TrayEventBridge />
      <UpdateDialog />
      <div className="app-frame">
        <header
          className="app-titlebar"
          data-tauri-drag-region
          onMouseDown={(event) => {
            if (event.button === 0) startWindowDrag();
          }}
        >
          <button
            aria-label={sidebarToggleLabel}
            className="titlebar-sidebar-toggle"
            onClick={toggleSidebar}
            onMouseDown={(event) => event.stopPropagation()}
            title={sidebarToggleLabel}
            type="button"
          >
            <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
              <path d={sidebarCollapsed ? "m9 6 6 6-6 6" : "m15 6-6 6 6 6"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
            </svg>
          </button>
        </header>
        <div className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
          <AppSidebar />
          <main className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/library" element={<SkillLibrary />} />
              <Route path="/library/skills/:skillName" element={<SkillDetail />} />
              <Route path="/skills/:skillName" element={<SkillDetail />} />
              <Route path="/install" element={<InstallSkills />} />
              <Route path="/install/skills/:skillId" element={<OnlineSkillDetail />} />
              <Route path="/matrix" element={<AgentMatrix />} />
              <Route path="/agents" element={<Agents />} />
              <Route path="/agents/:agentId" element={<AgentDetail />} />
              <Route path="/agents/:agentId/skills/:skillName" element={<SkillDetail />} />
              <Route path="/history" element={<ScanHistory />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  );
}
