import { Link } from "react-router-dom";

import type { AgentReport } from "../ipc/types";
import { AgentIdentityMark, AgentStatus } from "./AgentVisual";

export default function AgentCard({ agent }: { agent: AgentReport }) {
  return (
    <Link className="agent-card agent-directory-card" to={`/agents/${agent.agent_id}`}>
      <AgentIdentityMark agentId={agent.agent_id} />
      <span className="agent-card-copy">
        <strong>{agent.display_name}</strong>
        <span className="agent-directory-counts">
          <span>{agent.skills.length} Skills</span>
          <span>{agent.roots.length} Roots</span>
        </span>
        <AgentStatus status={agent.detection_status} />
      </span>
      <svg aria-hidden="true" className="agent-arrow agent-directory-chevron" fill="none" height="20" viewBox="0 0 20 20" width="20" xmlns="http://www.w3.org/2000/svg">
        <path d="m7 4 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
      </svg>
    </Link>
  );
}
