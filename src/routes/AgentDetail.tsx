import { Link, useParams } from "react-router-dom";
import { useScanStore } from "../stores/scanStore";

export default function AgentDetail() {
  const { agentId } = useParams();
  const { report } = useScanStore();
  const agent = report?.agents.find((item) => item.agent_id === agentId);

  if (!agent) {
    return (
      <section className="page">
        <h1>Agent not found</h1>
        <p className="empty-hint">The requested agent is not available in this scan.</p>
        <Link className="back-link" to="/agents">Back to Agents</Link>
      </section>
    );
  }

  return (
    <section className="page agent-detail">
      <Link className="back-link" to="/agents">← Back to Agents</Link>
      <h1>{agent.display_name}</h1>
      <p className="empty-hint">{agent.skills.length} Skills</p>
    </section>
  );
}
