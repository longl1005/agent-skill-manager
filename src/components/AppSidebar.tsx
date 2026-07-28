import { NavLink } from "react-router-dom";

import { isDiscoveredAgent } from "../agentDiscovery";
import type { AgentReport } from "../ipc/types";
import { useScanStore } from "../stores/scanStore";
import { useI18nStore } from "../stores/i18nStore";
import { t, type TranslationKey } from "../locales/dict";
import { AgentSidebarIcon } from "./AgentVisual";

type NavigationIcon = "dashboard" | "library" | "install" | "agents" | "settings";

const primaryDestinations: Array<{ to: string; labelKey: TranslationKey; icon: NavigationIcon }> = [
  { to: "/", labelKey: "nav.dashboard", icon: "dashboard" },
  { to: "/library", labelKey: "nav.library", icon: "library" },
  { to: "/install", labelKey: "nav.install", icon: "install" },
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
  agentId,
  end = false,
}: {
  to: string;
  label: string;
  icon?: NavigationIcon;
  agentId?: string;
  end?: boolean;
}) {
  return (
    <NavLink
      end={end}
      to={to}
      className={({ isActive }) => (isActive ? "is-selected active" : undefined)}
    >
      {agentId ? <AgentSidebarIcon agentId={agentId} /> : icon ? <NavigationGlyph icon={icon} /> : null}
      <span>{label}</span>
    </NavLink>
  );
}

function AgentSidebarLink({ agent }: { agent: AgentReport }) {
  return (
    <NavLink
      to={`/agents/${agent.agent_id}`}
      end
      className={({ isActive }) => (isActive ? "is-selected active" : undefined)}
    >
      <AgentSidebarIcon agentId={agent.agent_id} />
      <span className="sidebar-agent-name">{agent.display_name}</span>
      <span className="sidebar-skill-count-badge" title={`${agent.skills.length} skills`}>
        {agent.skills.length}
      </span>
    </NavLink>
  );
}

export default function AppSidebar() {
  const report = useScanStore((state) => state.report);
  const detectedAgents = report?.agents.filter(isDiscoveredAgent) ?? [];
  const lang = useI18nStore((state) => state.lang);

  return (
    <aside className="sidebar">
      <h1 className="brand">ASM</h1>
      <nav aria-label="Primary navigation">
        {primaryDestinations.map((destination) => (
          <SidebarLink
            key={destination.to}
            to={destination.to}
            label={t(destination.labelKey, lang)}
            icon={destination.icon}
            end={destination.to === "/"}
          />
        ))}
      </nav>
      <nav aria-label={t("nav.discoveredAgents", lang)}>
        <p className="sidebar-group-label">{t("nav.discoveredAgents", lang)}</p>
        <SidebarLink icon="agents" label={t("nav.allAgents", lang)} to="/agents" end />
        {detectedAgents.map((agent) => (
          <AgentSidebarLink key={agent.agent_id} agent={agent} />
        ))}
      </nav>
      <nav aria-label={t("nav.settings", lang)} style={{ borderTop: "1px solid var(--border)", marginTop: "auto", paddingTop: 8 }}>
        <SidebarLink icon="settings" label={t("nav.settings", lang)} to="/settings" />
      </nav>
    </aside>
  );
}

