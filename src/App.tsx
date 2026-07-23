import { HashRouter, Routes, Route } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import Dashboard from "./routes/Dashboard";
import Library from "./routes/Library";
import AgentMatrix from "./routes/AgentMatrix";
import Agents from "./routes/Agents";
import AgentDetail from "./routes/AgentDetail";
import ScanHistory from "./routes/ScanHistory";
import Settings from "./routes/Settings";

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <AppSidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/install" element={<Library />} />
            <Route path="/matrix" element={<AgentMatrix />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:agentId" element={<AgentDetail />} />
            <Route path="/history" element={<ScanHistory />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
