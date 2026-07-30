import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { openSkillDirectory, readSkillContent } from "../ipc/commands";
import { t } from "../locales/dict";
import { useI18nStore } from "../stores/i18nStore";
import { useScanStore } from "../stores/scanStore";
import { AgentIdentityMark, AppIdentityMark } from "../components/AgentVisual";

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

import { useMasterRepoStore } from "../stores/masterRepoStore";

export default function SkillDetail() {
  const { agentId, skillName } = useParams();
  const { report } = useScanStore();
  const lang = useI18nStore((state) => state.lang);
  const { skills: masterSkills } = useMasterRepoStore();

  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");

  const decodedSkillName = decodeURIComponent(skillName || "");

  const masterSkill = masterSkills.find(
    (m) => {
      const directoryName = m.path.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
      return m.name === skillName || m.name === decodedSkillName || directoryName === decodedSkillName;
    }
  );

  const agent = report?.agents.find((a) => a.agent_id === agentId);
  const agentSkill = agent
    ? agent.skills.find((s) => s.name === skillName || s.name === decodedSkillName)
    : report?.agents.flatMap((a) => a.skills).find((s) => s.name === skillName || s.name === decodedSkillName);

  const resolvedLocation = masterSkill?.path || agentSkill?.location;
  const resolvedName = masterSkill?.name || agentSkill?.name || decodedSkillName;
  const resolvedDescription = masterSkill?.description || agentSkill?.description || "";
  const resolvedFileCount = agentSkill?.file_count ?? 1;
  const resolvedFingerprint = agentSkill?.fingerprint_short || "—";
  const resolvedLicense = agentSkill?.license;

  useEffect(() => {
    if (!resolvedLocation) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    readSkillContent(resolvedLocation)
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
  }, [resolvedLocation]);

  if (!resolvedLocation) {
    return (
      <section className="page agent-detail agent-detail--missing">
        <h1>{t("skillDetail.notFoundTitle", lang)}</h1>
        <p>{t("skillDetail.notFoundDesc", lang).replace("{name}", skillName || "")}</p>
        <div className="agent-detail__recovery-actions">
          <Link className="agent-detail-recovery agent-detail__recovery-link" to={agent ? `/agents/${agent.agent_id}` : "/library"}>
            {agent ? t("skillDetail.backToAgent", lang) : t("skillDetail.backToLibrary", lang)}
          </Link>
        </div>
      </section>
    );
  }

  const entryPath = resolvedLocation;
  const { frontmatter, body } = rawContent ? parseFrontmatter(rawContent) : { frontmatter: null, body: "" };
  const displayDescription = resolvedDescription || frontmatter?.description || t("skillDetail.noDescription", lang);

  const otherFields = frontmatter
    ? Object.entries(frontmatter).filter(
        ([k, v]) => k !== "description" && k !== "name" && v !== "" && v !== "{}" && v !== "[]"
      )
    : [];

  const handleOpenDirectory = () => void openSkillDirectory(resolvedLocation);

  return (
    <section className="page skill-detail-page">
      <nav aria-label="Breadcrumb" className="agent-breadcrumb agent-detail__breadcrumb">
        {agent ? (
          <>
            <Link to="/agents">{t("nav.discoveredAgents", lang)}</Link>
            <BreadcrumbSeparator />
            <Link to={`/agents/${agent.agent_id}`}>{agent.display_name}</Link>
            <BreadcrumbSeparator />
            <span aria-current="page">{resolvedName}</span>
          </>
        ) : (
          <>
            <Link to="/library">{t("skillLibrary.title", lang)}</Link>
            <BreadcrumbSeparator />
            <span aria-current="page">{resolvedName}</span>
          </>
        )}
      </nav>

      <header className="skill-detail__header">
        <div className="skill-detail__header-main">
          <div className="skill-detail__icon-wrapper">
            {agent ? <AgentIdentityMark agentId={agent.agent_id} /> : <AppIdentityMark />}
          </div>
          <div className="skill-detail__identity">
            <div className="skill-detail__title-row">
              <h1>{resolvedName}</h1>
              {agent ? (
                <span className="skill-detail__agent-tag">{agent.display_name}</span>
              ) : (
                <span className="skill-detail__agent-tag skill-detail__agent-tag--master">
                  {t("skillDetail.masterTag", lang)}
                </span>
              )}
            </div>
            <p className="skill-detail__description">{displayDescription}</p>
          </div>
        </div>

        <div className="skill-detail__meta-bar">
          <div className="skill-detail__location-group">
            <code className="skill-detail__location" title={entryPath}>{entryPath}</code>
            <button
              className="skill-detail__copy-btn"
              onClick={handleOpenDirectory}
              type="button"
              title={t("skillLibrary.openDirectory", lang)}
            >
              {t("skillLibrary.openDirectory", lang)}
            </button>
          </div>

          <div className="skill-meta-pill">
            <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <polyline points="13 2 13 9 20 9" />
            </svg>
            <span>{t("skillDetail.fileCount", lang).replace("{count}", String(resolvedFileCount))}</span>
          </div>

          <div className="skill-meta-pill">
            <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="monospace">{t("skillDetail.fingerprint", lang)}: {resolvedFingerprint}</span>
          </div>

          {resolvedLicense && (
            <div className="skill-meta-pill">
              <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 24 24" width="13" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>{t("skillDetail.license", lang)}: {resolvedLicense}</span>
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
              <h3>{t("skillDetail.metadata", lang)}</h3>
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
            <h2>{t("skillDetail.document", lang)}</h2>
          </div>

          <div className="skill-detail__view-toggle">
            <button
              className={`toggle-btn ${viewMode === "rendered" ? "active" : ""}`}
              onClick={() => setViewMode("rendered")}
              type="button"
            >
              {t("skillDetail.preview", lang)}
            </button>
            <button
              className={`toggle-btn ${viewMode === "raw" ? "active" : ""}`}
              onClick={() => setViewMode("raw")}
              type="button"
            >
              {t("skillDetail.raw", lang)}
            </button>
          </div>
        </div>

        {loading && (
          <div className="skill-detail__loading">
            <p>{t("skillDetail.loading", lang)}</p>
          </div>
        )}

        {error && (
          <div className="agent-scan-error" role="alert">
            <strong>{t("skillDetail.loadError", lang)}</strong>
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
