import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useScanStore } from "../stores/scanStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { isDiscoveredAgent } from "../agentDiscovery";
import { AgentIdentityMark, AgentStatus } from "../components/AgentVisual";

function formatTime(unixMillis: number): string {
  if (!unixMillis) return "—";
  const d = new Date(unixMillis);
  return d.toLocaleTimeString();
}

export default function Dashboard() {
  const { report, scanning, error } = useScanStore();
  const { skills: masterSkills, fetchMasterSkills } = useMasterRepoStore();
  const lang = useI18nStore((s) => s.lang);

  useEffect(() => {
    fetchMasterSkills();
  }, [fetchMasterSkills]);

  const detectedAgents = report?.agents.filter(isDiscoveredAgent) ?? [];

  // Calculate Symlink Coverage across all detected agents
  let totalAgentSkills = 0;
  let linkedAgentSkills = 0;

  detectedAgents.forEach((agent) => {
    agent.skills.forEach((skill) => {
      totalAgentSkills++;
      const master = masterSkills.find(
        (m) => m.name.toLowerCase() === skill.name.toLowerCase()
      );
      if (master && master.linked_agents?.[agent.agent_id]) {
        linkedAgentSkills++;
      }
    });
  });

  const symlinkCoveragePercent =
    totalAgentSkills > 0
      ? Math.round((linkedAgentSkills / totalAgentSkills) * 100)
      : 0;

  const lastUpdatedTime = report ? formatTime(report.completed_at) : "—";

  return (
    <section className="page dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-header-title">
          <h1>{t("dashboard.title", lang)}</h1>
          <p>{t("dashboard.subtitle", lang)}</p>
        </div>
        <div className="dashboard-shortcuts">
          <Link to="/library" className="btn dashboard-shortcut-btn">
            {t("dashboard.quickLibrary", lang)}
          </Link>
          <Link to="/agents" className="btn dashboard-shortcut-btn">
            {t("dashboard.quickAgents", lang)}
          </Link>
        </div>
      </div>

      {error && <div className="scan-error">{error}</div>}

      <div className="dashboard-metrics-grid">
        <div className="dashboard-metric-card">
          <span className="metric-label">{t("dashboard.metricMasterSkills", lang)}</span>
          <span className="metric-value">{masterSkills.length}</span>
          <span className="metric-subtext">~/.asm/skills</span>
        </div>

        <div className="dashboard-metric-card">
          <span className="metric-label">{t("dashboard.metricActiveAgents", lang)}</span>
          <span className="metric-value">{detectedAgents.length}</span>
          <span className="metric-subtext">{detectedAgents.length} Agents</span>
        </div>

        <div className="dashboard-metric-card">
          <span className="metric-label">{t("dashboard.metricSymlinkCoverage", lang)}</span>
          <span className="metric-value">{symlinkCoveragePercent}%</span>
          <span className="metric-subtext">
            {linkedAgentSkills} / {totalAgentSkills}
          </span>
        </div>

        <div className="dashboard-metric-card">
          <span className="metric-label">{t("dashboard.metricSyncStatus", lang)}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span className="sync-live-dot" />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{t("dashboard.syncActive", lang)}</span>
          </div>
          <span className="metric-subtext" style={{ marginTop: 4 }}>
            {t("dashboard.lastRefreshed", lang)} {lastUpdatedTime}
          </span>
        </div>
      </div>

      <h2 className="dashboard-section-title">{t("dashboard.agentMonitorTitle", lang)}</h2>

      {scanning && !report ? (
        <p className="empty-hint">Scanning agent workspaces...</p>
      ) : detectedAgents.length === 0 ? (
        <div className="agents-empty-panel">
          <h2>No agents discovered</h2>
          <p>Install an agent or check skill directory configurations.</p>
        </div>
      ) : (
        <div className="dashboard-agent-grid">
          {detectedAgents.map((agent) => {
            const agentLinkedCount = agent.skills.filter((s) =>
              masterSkills.some(
                (m) =>
                  m.name.toLowerCase() === s.name.toLowerCase() &&
                  m.linked_agents?.[agent.agent_id]
              )
            ).length;

            return (
              <Link
                key={agent.agent_id}
                to={`/agents/${agent.agent_id}`}
                className="dashboard-agent-card"
              >
                <div className="dashboard-agent-card-header">
                  <div className="dashboard-agent-info">
                    <AgentIdentityMark agentId={agent.agent_id} />
                    <span className="dashboard-agent-name">{agent.display_name}</span>
                  </div>
                  <AgentStatus status={agent.detection_status} />
                </div>

                <div className="dashboard-agent-stats">
                  <div className="dashboard-agent-stat-item">
                    <span className="dashboard-agent-stat-label">{t("nav.library", lang)}</span>
                    <span className="dashboard-agent-stat-value">
                      {agent.skills.length} {t("dashboard.skillsUnit", lang)}
                    </span>
                  </div>

                  <div className="dashboard-agent-stat-item">
                    <span className="dashboard-agent-stat-label">{t("dashboard.managedRatio", lang)}</span>
                    <span className="dashboard-agent-stat-value">
                      {agentLinkedCount}/{agent.skills.length}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
