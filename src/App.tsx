import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
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
import { TrayEventBridge } from "./hooks/useTrayEvents";
import { CloseActionModal } from "./components/CloseActionModal";
import { UpdateDialog } from "./components/UpdateDialog";
import { useUpdateStore } from "./stores/updateStore";
import { usePerformanceDiagnosticsStore } from "./stores/performanceDiagnosticsStore";
import { useGeneralSettingsStore } from "./stores/generalSettingsStore";

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme);
  const initGeneralSettings = useGeneralSettingsStore((s) => s.initSettings);
  const scan = useScanStore((s) => s.scan);
  const fetchMasterSkills = useMasterRepoStore((s) => s.fetchMasterSkills);
  const hydrateAgentConfig = useAgentConfigStore((s) => s.hydrate);
  const hydratePerformanceDiagnostics = usePerformanceDiagnosticsStore((s) => s.hydrate);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);

  useEffect(() => {
    initTheme();
    initGeneralSettings();
    void Promise.allSettled([hydrateAgentConfig(), hydratePerformanceDiagnostics()])
      .finally(() => {
        void scan();
        void fetchMasterSkills();
      });
    void checkForUpdates(true);
  }, [initTheme, initGeneralSettings, scan, fetchMasterSkills, hydrateAgentConfig, hydratePerformanceDiagnostics, checkForUpdates]);

  return (
    <HashRouter>
      <TrayEventBridge />
      <UpdateDialog />
      <CloseActionModal />
      <div className="app-shell">
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
    </HashRouter>
  );
}
