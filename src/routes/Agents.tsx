import type { AgentReport } from "../ipc/types";
import { useScanStore } from "../stores/scanStore";

function agentSummary(agent: AgentReport) {
  return { roots: agent.roots.length, skills: agent.skills.length, issues: agent.issues.length };
}

export default function Agents() {
  const { report, scanning } = useScanStore();

  if (scanning && report === null) {
    return <section className="page"><h1>Agents</h1><p className="empty-hint">Scanning...</p></section>;
  }

  if (report === null) {
    return <section className="page"><h1>Agents</h1><p className="empty-hint">Run scan to discover agents.</p></section>;
  }

  if (report.agents.length === 0) {
    return <section className="page"><h1>Agents</h1><p className="empty-hint">No agents discovered.</p></section>;
  }

  return (
    <section className="page">
      <h1>Agents</h1>
      <div className="agent-cards">
        {report.agents.map((agent) => {
          const summary = agentSummary(agent);
          return (
            <article className="agent-card" key={agent.agent_id}>
              <header>
                <h2>{agent.display_name}</h2>
                <p>{agent.detection_status} · {agent.outcome}</p>
              </header>
              <dl className="agent-counts">
                <div><dt>Roots</dt><dd>{summary.roots}</dd></div>
                <div><dt>Skills</dt><dd>{summary.skills}</dd></div>
                <div><dt>Issues</dt><dd>{summary.issues}</dd></div>
              </dl>
              {agent.roots.length === 0 ? (
                <p className="empty-hint">No roots discovered.</p>
              ) : (
                <ul className="agent-roots">
                  {agent.roots.map((root) => <li key={root.root_id}><span>{root.scope}</span><code>{root.display_path}</code></li>)}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
