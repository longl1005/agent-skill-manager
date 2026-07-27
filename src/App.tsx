import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import Dashboard from "./routes/Dashboard";
import SkillLibrary from "./routes/SkillLibrary";
import AgentMatrix from "./routes/AgentMatrix";
import Agents from "./routes/Agents";
import AgentDetail from "./routes/AgentDetail";
import SkillDetail from "./routes/SkillDetail";
import ScanHistory from "./routes/ScanHistory";
import Settings from "./routes/Settings";
import { useThemeStore } from "./stores/themeStore";
import { useScanStore } from "./stores/scanStore";
import { useMasterRepoStore } from "./stores/masterRepoStore";

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme);
  const scan = useScanStore((s) => s.scan);
  const fetchMasterSkills = useMasterRepoStore((s) => s.fetchMasterSkills);

  useEffect(() => {
    initTheme();
    scan();
    fetchMasterSkills();
  }, [initTheme, scan, fetchMasterSkills]);

  return (
    <HashRouter>
      <div className="app-shell">
        <AppSidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<SkillLibrary />} />
            <Route path="/install" element={<SkillLibrary />} />
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
