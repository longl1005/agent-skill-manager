import { Link } from "react-router-dom";
import { useScanStore } from "../stores/scanStore";

export default function Agents() {
  const { report, scanning, scan } = useScanStore();

  if (scanning && report === null) {
    return <section className="page agents-console" style={{ backgroundColor: "var(--agents-surface)", accentColor: "var(--agents-primary)" }}><p className="empty-hint">Scanning your local environment…</p></section>;
  }

  if (report === null) {
    return (
      <section className="page agents-console" style={{ backgroundColor: "var(--agents-surface)", accentColor: "var(--agents-primary)" }}>
        <p className="environment-label">LOCAL ENVIRONMENT</p>
        <h1>Agents · 0</h1>
        <p className="empty-hint">Run a scan to discover the skill workspaces available on this machine.</p>
        <button className="btn console-scan-button" onClick={scan}>Run scan</button>
      </section>
    );
  }

  const detectedAgents = report.agents.filter((agent) =>
    agent.detection_status === "Detected" || agent.detection_status === "Partial",
  );

  return (
    <section className="page agents-console" style={{ backgroundColor: "var(--agents-surface)", accentColor: "var(--agents-primary)" }}>
      <header className="agents-console-header">
        <div>
          <p className="environment-label">LOCAL ENVIRONMENT</p>
          <h1>Agents · {detectedAgents.length}</h1>
          <p className="agents-console-description">Detected skill workspaces available on this machine.</p>
        </div>
        <button className="btn console-scan-button" onClick={scan} disabled={scanning}>
          {scanning ? "Rescanning…" : "Rescan"}
        </button>
      </header>

      {detectedAgents.length > 0 ? (
      <div className="agent-cards">
        {detectedAgents.map((agent) => (
          <Link className="agent-card" key={agent.agent_id} to={`/agents/${agent.agent_id}`}>
            <span className="agent-card-topline">
              <span className="agent-icon" aria-hidden="true">✦</span>
              <span className="agent-status-badge">{agent.detection_status}</span>
            </span>
            <span className="agent-card-copy">
              <strong>{agent.display_name}</strong>
              <span>Local skill workspace</span>
            </span>
            <span className="agent-metrics">
              <span><strong>{agent.skills.length}</strong> Skills</span>
              <span><strong>{agent.roots.length}</strong> Roots</span>
            </span>
            <span className="agent-open-workspace">Open workspace <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </div>
      ) : (
        <div className="agents-empty-panel">
          <h2>No agents discovered</h2>
          <p>Install an agent, then rescan to make its Skill workspace available here.</p>
        </div>
      )}

      <aside className="agents-console-note">
        Install another supported Agent and rescan to add its local workspace here.
      </aside>
    </section>
  );
}
