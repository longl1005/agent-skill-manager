import AgentCard from "../components/AgentCard";
import { useScanStore } from "../stores/scanStore";

function DirectorySkeleton() {
  return <div aria-hidden="true" className="agent-card agent-directory-card agent-directory-skeleton" data-testid="agent-directory-skeleton" />;
}

export default function Agents() {
  const { report, scanning } = useScanStore();

  if (scanning && report === null) {
    return (
      <section aria-busy="true" aria-label="Loading agents" className="page agent-directory" role="region">
        <div className="agent-cards agent-directory-grid">
          <DirectorySkeleton />
          <DirectorySkeleton />
          <DirectorySkeleton />
        </div>
      </section>
    );
  }

  const detectedAgents = report?.agents.filter((agent) =>
    agent.detection_status === "Detected" || agent.detection_status === "Partial",
  ) ?? [];

  return (
    <section className="page agent-directory">
      <header className="agent-directory-header">
        <h1>All Agents</h1>
        <p>{detectedAgents.length} detected</p>
        <p className="empty-hint">Skill workspaces discovered on this machine.</p>
      </header>

      {detectedAgents.length > 0 ? (
        <div className="agent-cards agent-directory-grid">
          {detectedAgents.map((agent) => <AgentCard agent={agent} key={agent.agent_id} />)}
        </div>
      ) : (
        <div className="agents-empty-panel">
          <h2>No agents discovered</h2>
          <p>Install an agent, then rescan to make its Skill workspace available here.</p>
        </div>
      )}
    </section>
  );
}
