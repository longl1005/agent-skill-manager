import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { readSkillContent } from "../ipc/commands";
import { useScanStore } from "../stores/scanStore";
import { AgentIdentityMark } from "../components/AgentVisual";

function BreadcrumbSeparator() {
  return (
    <svg aria-hidden="true" className="agent-detail__breadcrumb-separator" fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function parseFrontmatter(markdown: string) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: null, body: markdown };
  }

  const rawYaml = match[1];
  const body = markdown.slice(match[0].length);

  const frontmatter: Record<string, string> = {};
  for (const line of rawYaml.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key) frontmatter[key] = val;
    }
  }

  return { frontmatter, body };
}

function renderFrontmatterValue(key: string, value: string) {
  if (key === "argument-hint" || key === "args" || key.includes("path")) {
    return <code className="skill-fm__code">{value}</code>;
  }
  if (key === "version" || key === "license") {
    return <span className="skill-fm__badge">{value}</span>;
  }
  return <span className="skill-fm__val">{value}</span>;
}

export default function SkillDetail() {
  const { agentId, skillName } = useParams();
  const { report } = useScanStore();
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [copied, setCopied] = useState<boolean>(false);

  const agent = report?.agents.find((a) => a.agent_id === agentId);
  const skill = agent?.skills.find((s) => s.name === skillName || decodeURIComponent(skillName || "") === s.name);

  useEffect(() => {
    if (!skill) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    readSkillContent(skill.location)
      .then((data) => {
        if (mounted) {
          setRawContent(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(String(err));
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [skill?.location, skill?.name]);

  if (!agent || !skill) {
    return (
      <section className="page agent-detail agent-detail--missing">
        <h1>Skill not found</h1>
        <p>The requested skill "{skillName}" is not available in the current scan.</p>
        <div className="agent-detail__recovery-actions">
          <Link className="agent-detail-recovery agent-detail__recovery-link" to={`/agents/${agentId || ""}`}>
            Back to Agent
          </Link>
        </div>
      </section>
    );
  }

  const entryPath = `${skill.location}/SKILL.md`;
  const { frontmatter, body } = rawContent ? parseFrontmatter(rawContent) : { frontmatter: null, body: "" };
  const displayDescription = skill.description || frontmatter?.description || "No description provided.";

  const otherFields = frontmatter
    ? Object.entries(frontmatter).filter(
        ([k, v]) => k !== "description" && k !== "name" && v !== "" && v !== "{}" && v !== "[]"
      )
    : [];

  const handleCopyPath = () => {
    navigator.clipboard.writeText(entryPath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="page skill-detail-page">
      <nav aria-label="Breadcrumb" className="agent-breadcrumb agent-detail__breadcrumb">
        <Link to="/agents">Discovered Agents</Link>
        <BreadcrumbSeparator />
        <Link to={`/agents/${agent.agent_id}`}>{agent.display_name}</Link>
        <BreadcrumbSeparator />
        <span aria-current="page">{skill.name}</span>
      </nav>

      <header className="skill-detail__header">
        <div className="skill-detail__header-main">
          <div className="skill-detail__icon-wrapper">
            <AgentIdentityMark agentId={agent.agent_id} />
          </div>
          <div className="skill-detail__identity">
            <div className="skill-detail__title-row">
              <h1>{skill.name}</h1>
              <span className="skill-detail__agent-tag">{agent.display_name}</span>
            </div>
            <p className="skill-detail__description">{displayDescription}</p>
          </div>
        </div>

        <div className="skill-detail__meta-bar">
          <div className="skill-detail__location-group">
            <code className="skill-detail__location" title={entryPath}>{entryPath}</code>
            <button
              className="skill-detail__copy-btn"
              onClick={handleCopyPath}
              type="button"
              title="Copy file path"
            >
              {copied ? "Copied!" : "Copy Path"}
            </button>
          </div>

          <div className="skill-meta-pill">
            <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span>{skill.file_count} {skill.file_count === 1 ? "File" : "Files"}</span>
          </div>

          <div className="skill-meta-pill">
            <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="monospace">Fingerprint: {skill.fingerprint_short || "—"}</span>
          </div>

          {skill.license && (
            <div className="skill-meta-pill">
              <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>License: {skill.license}</span>
            </div>
          )}
        </div>
      </header>

      {frontmatter && otherFields.length > 0 && (
        <section className="skill-detail__frontmatter-card">
          <div className="skill-detail__frontmatter-header">
            <div className="skill-detail__frontmatter-title">
              <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <h3>Metadata Frontmatter</h3>
            </div>
            <span className="skill-detail__frontmatter-type">YAML</span>
          </div>

          <div className="skill-detail__frontmatter-grid">
            {otherFields.map(([k, v]) => (
              <div className="skill-detail__frontmatter-item" key={k}>
                <span className="skill-detail__frontmatter-label">
                  {k.replace(/-/g, " ")}
                </span>
                <div className="skill-detail__frontmatter-value">
                  {renderFrontmatterValue(k, v)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="skill-detail__document-card">
        <div className="skill-detail__document-header">
          <div className="skill-detail__document-title">
            <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h2>SKILL.md Document</h2>
          </div>

          <div className="skill-detail__view-toggle">
            <button
              className={`toggle-btn ${viewMode === "rendered" ? "active" : ""}`}
              onClick={() => setViewMode("rendered")}
              type="button"
            >
              Preview
            </button>
            <button
              className={`toggle-btn ${viewMode === "raw" ? "active" : ""}`}
              onClick={() => setViewMode("raw")}
              type="button"
            >
              Raw
            </button>
          </div>
        </div>

        {loading && (
          <div className="skill-detail__loading">
            <p>Loading SKILL.md content...</p>
          </div>
        )}

        {error && (
          <div className="agent-scan-error" role="alert">
            <strong>Unable to load SKILL.md.</strong>
            <p className="agent-scan-error__detail">{error}</p>
          </div>
        )}

        {!loading && !error && rawContent && (
          <div className="skill-detail__markdown-viewer">
            {viewMode === "rendered" ? (
              <div className="markdown-rendered-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            ) : (
              <pre className="skill-detail__raw-markdown">
                <code>{rawContent}</code>
              </pre>
            )}
          </div>
        )}
      </section>
    </section>
  );
}
