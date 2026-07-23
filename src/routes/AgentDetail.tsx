import { Link, useParams } from "react-router-dom";

import { AgentIdentityMark, AgentStatus } from "../components/AgentVisual";
import { useScanStore } from "../stores/scanStore";

function BreadcrumbSeparator() {
  return (
    <svg aria-hidden="true" className="agent-detail__breadcrumb-separator" fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function StatusWithDot({ status }: { status: string }) {
  return (
    <span className="agent-detail__status">
      <svg aria-hidden="true" className="agent-detail__status-dot" fill="currentColor" height="8" viewBox="0 0 8 8" width="8" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4" cy="4" r="3" />
      </svg>
      <AgentStatus status={status} />
    </span>
  );
}

export default function AgentDetail() {
  const { agentId } = useParams();
  const { report, error, scanning, scan } = useScanStore();
  const agent = report?.agents.find((item) => item.agent_id === agentId);

  if (!agent) {
    return (
      <section className="page agent-detail agent-detail--missing">
        {error ? (
          <>
            <div className="agent-scan-error" role="alert">
              <strong>Latest scan failed.</strong> The agent directory may be incomplete.
              <p className="agent-scan-error__detail">{error}</p>
            </div>
            <h1>Agent unavailable</h1>
            <p>Try scanning again to restore the agent directory.</p>
          </>
        ) : (
          <>
            <h1>Agent not found</h1>
            <p>The requested agent is not available in this scan.</p>
          </>
        )}
        <div className="agent-detail__recovery-actions">
          <Link className="agent-detail-recovery agent-detail__recovery-link" to="/agents">All Agents</Link>
          {error && (
            <button className="agent-scan-recovery-button" disabled={scanning} onClick={() => void scan()} type="button">
              Rescan agents
            </button>
          )}
        </div>
      </section>
    );
  }

  const primaryRoot = agent.roots[0]?.display_path ?? "No skill root detected";

  return (
    <section className="page agent-detail">
      <nav aria-label="Breadcrumb" className="agent-breadcrumb agent-detail__breadcrumb">
        <Link to="/agents">Discovered Agents</Link>
        <BreadcrumbSeparator />
        <span aria-current="page">{agent.display_name}</span>
      </nav>

      {error && (
        <div className="agent-scan-error" role="alert">
          <strong>Latest scan failed.</strong> You can continue viewing this previously loaded agent workspace.
          <p className="agent-scan-error__detail">{error}</p>
        </div>
      )}

      <header className="agent-detail__header">
        <AgentIdentityMark agentId={agent.agent_id} />
        <div className="agent-detail__identity">
          <h1>{agent.display_name}</h1>
          <code className="agent-detail__root agent-detail__root--truncate" title={primaryRoot}>{primaryRoot}</code>
          <StatusWithDot status={agent.detection_status} />
        </div>
      </header>

      <dl className="agent-detail__summary">
        <div>
          <dt>Skills</dt>
          <dd>{agent.skills.length}</dd>
        </div>
        <div>
          <dt>Roots</dt>
          <dd>{agent.roots.length}</dd>
        </div>
        <div>
          <dt>Issues</dt>
          <dd>{agent.issues.length}</dd>
        </div>
      </dl>

      <section aria-labelledby="installed-skills-heading" className="agent-detail__skills">
        <h2 id="installed-skills-heading">Installed Skills</h2>
        {agent.skills.length > 0 ? (
          <ul className="agent-detail__skill-list">
            {agent.skills.map((skill) => (
              <li className="agent-detail__skill" key={skill.location + skill.name}>
                <div>
                  <h3>{skill.name}</h3>
                  <p className="agent-detail__skill-description agent-detail__skill-description--truncate" title={skill.description || "No description provided"}>
                    {skill.description || "No description provided"}
                  </p>
                </div>
                <span>{skill.file_count} files</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="agent-detail__empty-skills">No installed skills.</p>
        )}
      </section>
    </section>
  );
}
