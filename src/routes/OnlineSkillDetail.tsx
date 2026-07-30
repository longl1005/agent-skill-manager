import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useI18nStore } from "../stores/i18nStore";
import { openExternalUrl } from "../ipc/commands";

function ArrowUpRightIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

export default function OnlineSkillDetail() {
  const { skillId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const lang = useI18nStore((state) => state.lang);
  const name = params.get("name") || decodeURIComponent(skillId || "skill");
  const ownerRepo = params.get("owner") || "—";
  const description = params.get("description") || (lang === "zh" ? "该技能暂无简介。请查看来源页了解完整文档。" : "No summary is available for this skill. Open its source page for the full documentation.");
  const installs = params.get("installs");
  const repoUrl = params.get("repo");
  const skillsShUrl = params.get("skillsSh");
  const verified = params.get("verified") === "1";
  const cameFromMarketplace = params.get("origin") === "marketplace";
  const backTo = cameFromMarketplace ? "/install" : "/install?tab=online";
  const backLabel = cameFromMarketplace
    ? (lang === "zh" ? "热门技能市场" : "Featured skills")
    : (lang === "zh" ? "全网技能库" : "Global skill registry");
  const primarySourceUrl = skillsShUrl || repoUrl;
  const [document, setDocument] = useState<string | null>(null);
  const [documentState, setDocumentState] = useState<"loading" | "ready" | "unavailable">("loading");

  const documentCandidates = useMemo(() => {
    if (!repoUrl?.startsWith("https://github.com/")) return [];
    const rawBase = repoUrl.replace("https://github.com/", "https://raw.githubusercontent.com/").replace(/\/$/, "");
    const normalizedName = name.replace(/^\/+|\/+$/g, "");
    return [...new Set([
      `${rawBase}/HEAD/${normalizedName}/SKILL.md`,
      `${rawBase}/HEAD/skills/${normalizedName}/SKILL.md`,
      `${rawBase}/HEAD/SKILL.md`,
    ])];
  }, [name, repoUrl]);

  useEffect(() => {
    let active = true;

    const loadDocument = async () => {
      setDocument(null);
      setDocumentState(documentCandidates.length ? "loading" : "unavailable");

      for (const url of documentCandidates) {
        try {
          const response = await fetch(url);
          if (!response.ok) continue;
          const content = await response.text();
          if (!content.trim()) continue;
          if (active) {
            setDocument(content);
            setDocumentState("ready");
          }
          return;
        } catch {
          // Continue through the known repository layouts before falling back.
        }
      }

      if (active) setDocumentState("unavailable");
    };

    void loadDocument();
    return () => { active = false; };
  }, [documentCandidates]);

  const install = () => {
    const query = new URLSearchParams({ tab: "online", install: name });
    if (ownerRepo && ownerRepo !== "—") query.set("source", ownerRepo);
    navigate(`/install?${query.toString()}`);
  };

  const openDocumentation = (url: string | null) => {
    if (!url) return;
    void openExternalUrl(url).catch(() => undefined);
  };

  return (
    <section className="page online-skill-detail-page">
      <nav aria-label="Breadcrumb" className="online-skill-detail__breadcrumb">
        <Link to={backTo}><BackIcon />{backLabel}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{name}</span>
      </nav>

      <header className="online-skill-detail__header">
        <div className="online-skill-detail__identity">
          <div className="online-skill-detail__eyebrow">
            {verified ? <span className="skills-sh-badge">skills.sh Verified</span> : <span className="github-badge">GitHub</span>}
            {installs && <span className="online-skill-detail__metric">{installs}</span>}
          </div>
          <h1>{name}</h1>
          <code className="online-skill-detail__owner">{ownerRepo}</code>
          <p>{description}</p>
        </div>
        <div className="online-skill-detail__actions">
          <button className="btn primary install-btn" onClick={install} type="button">
            {lang === "zh" ? "安装技能" : "Install skill"}
          </button>
          {primarySourceUrl && (
            <button className="btn online-skill-detail__source-action" onClick={() => openDocumentation(primarySourceUrl)} type="button">
              {lang === "zh" ? "查看完整说明" : "View documentation"}<ArrowUpRightIcon />
            </button>
          )}
        </div>
      </header>

      <div className="online-skill-detail__grid">
        <section className="online-skill-detail__overview" aria-labelledby="skill-overview-title">
          <div className="online-skill-detail__section-heading">
            <span>01</span>
            <h2 id="skill-overview-title">{lang === "zh" ? "技能概览" : "Overview"}</h2>
          </div>
          <p>{description}</p>
          <p className="online-skill-detail__note">
            {lang === "zh"
              ? "安装前请查看完整说明，确认适用场景、依赖项与使用方式。"
              : "Review the full documentation before installing to confirm use cases, dependencies, and instructions."}
          </p>
        </section>

        <aside className="online-skill-detail__source-card" aria-label={lang === "zh" ? "技能来源" : "Skill source"}>
          <div className="online-skill-detail__section-heading">
            <span>02</span>
            <h2>{lang === "zh" ? "来源与验证" : "Source & verification"}</h2>
          </div>
          <dl>
            <div><dt>{lang === "zh" ? "发布仓库" : "Repository"}</dt><dd><code>{ownerRepo}</code></dd></div>
            <div><dt>{lang === "zh" ? "索引状态" : "Index status"}</dt><dd>{verified ? "skills.sh Verified" : "GitHub repository"}</dd></div>
          </dl>
          <div className="online-skill-detail__source-links">
            {skillsShUrl && <button onClick={() => openDocumentation(skillsShUrl)} type="button">skills.sh <ArrowUpRightIcon /></button>}
            {repoUrl && <button onClick={() => openDocumentation(repoUrl)} type="button">GitHub <ArrowUpRightIcon /></button>}
          </div>
        </aside>
      </div>

      <section className="online-skill-detail__document" aria-labelledby="online-skill-document-title">
        <div className="online-skill-detail__section-heading">
          <span>03</span>
          <h2 id="online-skill-document-title">SKILL.md</h2>
        </div>
        {documentState === "loading" && (
          <p className="online-skill-detail__document-status">{lang === "zh" ? "正在读取技能说明…" : "Loading skill documentation…"}</p>
        )}
        {documentState === "ready" && document && (
          <div className="markdown-rendered-body online-skill-detail__markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{document}</ReactMarkdown></div>
        )}
        {documentState === "unavailable" && (
          <div className="online-skill-detail__document-unavailable">
            <p>{lang === "zh" ? "未能自动找到此仓库中的 SKILL.md。请查看来源页获取完整说明。" : "We could not automatically find a SKILL.md in this repository. Open the source page for the full documentation."}</p>
            {primarySourceUrl && <button className="btn online-skill-detail__source-action" onClick={() => openDocumentation(primarySourceUrl)} type="button">{lang === "zh" ? "查看完整说明" : "View documentation"}<ArrowUpRightIcon /></button>}
          </div>
        )}
      </section>
    </section>
  );
}
