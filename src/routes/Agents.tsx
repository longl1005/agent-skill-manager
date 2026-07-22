import { Link } from "react-router-dom";
import { useScanStore } from "../stores/scanStore";

export default function Agents() {
  const { report, scanning } = useScanStore();

  if (scanning && report === null) {
    return <section className="page"><h1>Agents</h1><p className="empty-hint">Scanning...</p></section>;
  }

  if (report === null) {
    return <section className="page"><h1>Agents</h1><p className="empty-hint">Run scan to discover agents.</p></section>;
  }

  const detectedAgents = report.agents.filter((agent) =>
    agent.detection_status === "Detected" || agent.detection_status === "Partial",
  );

  if (detectedAgents.length === 0) {
    return <section className="page"><h1>Agents</h1><p className="empty-hint">No agents discovered.</p></section>;
  }

  return (
    <section className="page">
      <h1>Agents</h1>
      <div className="agent-cards">
        {detectedAgents.map((agent) => (
          <Link className="agent-card" key={agent.agent_id} to={`/agents/${agent.agent_id}`}>
            <span className="agent-icon" aria-hidden="true">◌</span>
            <span className="agent-card-copy">
              <strong>{agent.display_name}</strong>
              <span>{agent.skills.length} Skills</span>
            </span>
            <span className="agent-arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
