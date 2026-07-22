import { HashRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./routes/Dashboard";
import Library from "./routes/Library";
import AgentMatrix from "./routes/AgentMatrix";
import Agents from "./routes/Agents";
import AgentDetail from "./routes/AgentDetail";
import ScanHistory from "./routes/ScanHistory";
import Settings from "./routes/Settings";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/library", label: "Library" },
  { to: "/matrix", label: "Agent Matrix" },
  { to: "/agents", label: "Agents" },
  { to: "/history", label: "Scan History" },
  { to: "/settings", label: "Settings" },
];

export default function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <aside className="sidebar">
          <h1 className="brand">ASM</h1>
          <nav>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/"}
                className={({ isActive }) => (isActive ? "active" : undefined)}
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
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
