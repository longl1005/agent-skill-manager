import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useScanStore } from "../stores/scanStore";

export default function AgentDetail() {
  const { agentId } = useParams();
  const { report, scanning, scan } = useScanStore();
  const agent = report?.agents.find((item) => item.agent_id === agentId);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  if (!agent) {
    return (
      <section className="page agent-detail" style={{ backgroundColor: "var(--agents-surface)", accentColor: "var(--agents-primary)" }}>
        <h1>Agent not found</h1>
        <p className="empty-hint">The requested agent is not available in this scan.</p>
        <Link className="back-link" to="/agents">Back to Agents</Link>
      </section>
    );
  }

  const filteredSkills = agent.skills.filter((skill) =>
    `${skill.name} ${skill.description}`.toLowerCase().includes(query.toLowerCase()),
  );
  const primaryRoot = agent.roots[0]?.display_path ?? "No skill root detected";

  return (
    <section className="page agent-detail" style={{ backgroundColor: "var(--agents-surface)", accentColor: "var(--agents-primary)" }}>
      <Link className="back-link" to="/agents">← Back to Agents</Link>

      <header className="skill-workspace-header">
        <div className="workspace-heading">
          <span className="workspace-agent-icon" aria-hidden="true">✦</span>
          <div>
            <div className="workspace-title-row">
              <h1>{agent.display_name}</h1>
              <span className="skill-count-badge">{agent.skills.length} skills</span>
            </div>
            <code className="workspace-root" title={primaryRoot}>{primaryRoot}</code>
            <p className="workspace-summary">
              <strong>{agent.skills.length}</strong> skills <span aria-hidden="true">/</span>{" "}
              <strong>{agent.issues.length}</strong> issues
            </p>
          </div>
        </div>

        <div className="workspace-controls">
          <label className="skill-search">
            <span className="sr-only">Search installed skills</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="Search installed skills"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="btn workspace-refresh" onClick={scan} disabled={scanning}>
            {scanning ? "Refreshing…" : "Refresh"}
          </button>
          <div className="view-switcher" role="group" aria-label="Skill view">
            <button
              type="button"
              className={viewMode === "grid" ? "is-active" : undefined}
              aria-pressed={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
            >
              Grid
            </button>
            <button
              type="button"
              className={viewMode === "list" ? "is-active" : undefined}
              aria-pressed={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
          <button className="add-skill-button" type="button">Add Skill</button>
        </div>
      </header>

      <div className="skill-workspace-section-heading">
        <div>
          <p className="eyebrow">Installed skills</p>
          <h2>{query ? `${filteredSkills.length} matching skills` : "Your local capability set"}</h2>
        </div>
        <span className="local-readonly-note">Read-only inventory</span>
      </div>

      {filteredSkills.length > 0 ? (
        <div className={`skill-cards skill-cards--${viewMode}`}>
          {filteredSkills.map((skill) => (
            <article className="skill-card" key={skill.location + skill.name}>
              <div className="skill-card-content">
                <div className="skill-card-title-row">
                  <h3>{skill.name}</h3>
                  <span className="local-skill-tag">Local only</span>
                </div>
                <p title={skill.description || "No description provided"}>
                  {skill.description || "No description provided"}
                </p>
                <span className="skill-file-count">{skill.file_count} files</span>
              </div>
              <footer className="skill-card-actions">
                <button type="button" disabled title="同步功能尚未实现">Import</button>
                <button type="button" disabled title="同步功能尚未实现">Delete</button>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="skill-empty-state">
          <span aria-hidden="true">⌕</span>
          <h2>{query ? "No matching skills" : "No installed skills yet"}</h2>
          <p>{query ? "Try a different search term." : "Add a Skill from the central library when sync is available."}</p>
        </div>
      )}
    </section>
  );
}
