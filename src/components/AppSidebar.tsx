import { NavLink } from "react-router-dom";

import { isDiscoveredAgent } from "../agentDiscovery";
import { useScanStore } from "../stores/scanStore";

type NavigationIcon = "dashboard" | "library" | "install" | "agents" | "settings";

const primaryDestinations: Array<{ to: string; label: string; icon: NavigationIcon }> = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/library", label: "Skill Library", icon: "library" },
  { to: "/install", label: "Install Skills", icon: "install" },
];

function NavigationGlyph({ icon }: { icon: NavigationIcon }) {
  const paths: Record<NavigationIcon, string> = {
    dashboard: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
    library: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3V4Zm3 16h10V7a3 3 0 0 0-3-3",
    install: "M12 3v12m0 0 4-4m-4 4-4-4M5 19v2h14v-2",
    agents: "M5 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm8 1h6m-6 4h6M5 17h6",
    settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4",
  };

  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
      <path d={paths[icon]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
    </svg>
  );
}

function SidebarLink({
  to,
  label,
  icon,
  end = false,
}: {
  to: string;
  label: string;
  icon?: NavigationIcon;
  end?: boolean;
}) {
  return (
    <NavLink
      end={end}
      to={to}
      className={({ isActive }) => (isActive ? "is-selected active" : undefined)}
    >
      {icon && <NavigationGlyph icon={icon} />}
      <span>{label}</span>
    </NavLink>
  );
}

export default function AppSidebar() {
  const report = useScanStore((state) => state.report);
  const detectedAgents = report?.agents.filter(isDiscoveredAgent) ?? [];

  return (
    <aside className="sidebar">
      <h1 className="brand">ASM</h1>
      <nav aria-label="Primary navigation">
        {primaryDestinations.map((destination) => (
          <SidebarLink key={destination.to} {...destination} end={destination.to === "/"} />
        ))}
      </nav>
      <nav aria-label="Discovered Agents">
        <p className="sidebar-group-label">Discovered Agents</p>
        <SidebarLink icon="agents" label="All Agents" to="/agents" end />
        {detectedAgents.map((agent) => (
          <SidebarLink key={agent.agent_id} label={agent.display_name} to={`/agents/${agent.agent_id}`} />
        ))}
      </nav>
      <nav aria-label="Settings" style={{ borderTop: "1px solid var(--border)", marginTop: "auto", paddingTop: 8 }}>
        <SidebarLink icon="settings" label="Settings" to="/settings" />
      </nav>
    </aside>
  );
}
