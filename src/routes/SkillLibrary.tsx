import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { AgentIdentityMark } from "../components/AgentVisual";

export const SUPPORTED_AGENTS = [
  { id: "claude-code", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "antigravity", name: "Antigravity" },
  { id: "pi-agent", name: "Pi Agent" },
  { id: "oh-my-pi", name: "Oh My Pi (OPM)" },
  { id: "opencode", name: "Open Code" },
  { id: "cursor", name: "Cursor" },
];

export type StatusFilter = "all" | "linked" | "unlinked";

export default function SkillLibrary() {
  const { skills, loading, error, fetchMasterSkills, toggleAgentSkill, deleteMasterSkill } = useMasterRepoStore();
  const lang = useI18nStore((s) => s.lang);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ skillName: string; linkedCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchMasterSkills();
  }, [fetchMasterSkills]);

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      setCopiedPath(path);
      setTimeout(() => {
        setCopiedPath((curr) => (curr === path ? null : curr));
      }, 2000);
    });
  };

  const handleToggleAgent = async (agentId: string, skillName: string, currentState: boolean) => {
    const key = `${agentId}:${skillName}`;
    if (togglingMap[key]) return;

    setTogglingMap((prev) => ({ ...prev, [key]: true }));
    try {
      await toggleAgentSkill(agentId, skillName, !currentState);
    } finally {
      setTogglingMap((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleDeleteClick = (skillName: string) => {
    const skill = skills.find((s) => s.name === skillName);
    const linkedCount = skill ? Object.values(skill.linked_agents ?? {}).filter(Boolean).length : 0;
    setDeleteConfirm({ skillName, linkedCount });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await deleteMasterSkill(deleteConfirm.skillName);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = skill.name.toLowerCase().includes(query);
        const matchesDesc = skill.description.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      // Status filter
      const isAnyLinked = Object.values(skill.linked_agents ?? {}).some(Boolean);
      if (statusFilter === "linked" && !isAnyLinked) return false;
      if (statusFilter === "unlinked" && isAnyLinked) return false;

      return true;
    });
  }, [skills, searchQuery, statusFilter]);

  return (
    <section className="page master-skill-library">
      <div className="page-header">
        <div>
          <h1>{t("skillLibrary.title", lang)}</h1>
          <p className="page-subtitle">{t("skillLibrary.subtitle", lang)}</p>
        </div>
        <button
          className="btn console-scan-button"
          onClick={() => fetchMasterSkills()}
          disabled={loading}
        >
          {t("skillLibrary.refresh", lang)}
        </button>
      </div>

      <div className="filter-controls">
        <div className="skill-search">
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder={t("skillLibrary.searchPlaceholder", lang)}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search master skills"
          />
        </div>

        <div className="status-filter-group" role="group" aria-label="Status filter">
          <button
            className={`filter-btn ${statusFilter === "all" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            {t("skillLibrary.filterAll", lang)}
          </button>
          <button
            className={`filter-btn ${statusFilter === "linked" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("linked")}
          >
            {t("skillLibrary.filterLinked", lang)}
          </button>
          <button
            className={`filter-btn ${statusFilter === "unlinked" ? "is-active" : ""}`}
            onClick={() => setStatusFilter("unlinked")}
          >
            {t("skillLibrary.filterUnlinked", lang)}
          </button>
        </div>
      </div>

      {error && <div className="scan-error">{error}</div>}

      {loading && skills.length === 0 ? (
        <p className="empty-hint">Loading master skills...</p>
      ) : skills.length === 0 ? (
        <p className="empty-hint">{t("skillLibrary.emptyHint", lang)}</p>
      ) : filteredSkills.length === 0 ? (
        <p className="empty-hint">{t("skillLibrary.emptySearch", lang)}</p>
      ) : (
        <div className="master-skill-grid">
          {filteredSkills.map((skill) => {
            return (
              <div className="master-skill-card" key={skill.name} data-testid={`skill-card-${skill.name}`}>
                <div className="master-skill-card-header">
                  <div className="title-section">
                    <Link to={`/library/skills/${encodeURIComponent(skill.name)}`} className="skill-title-link">
                      <h3 className="skill-title">{skill.name}</h3>
                    </Link>
                    <code className="skill-path-badge" title={skill.path}>
                      {skill.path}
                    </code>
                  </div>
                  <div className="card-header-actions">
                    <button
                      className="copy-path-btn"
                      onClick={() => handleCopyPath(skill.path)}
                      title={t("skillLibrary.copyPath", lang)}
                      aria-label={`Copy path for ${skill.name}`}
                    >
                      {copiedPath === skill.path ? (
                        <span className="copied-text">{t("skillLibrary.copied", lang)}</span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="delete-skill-btn"
                      onClick={() => handleDeleteClick(skill.name)}
                      title={lang === "zh" ? "删除技能" : "Delete skill"}
                      aria-label={`Delete skill ${skill.name}`}
                      data-testid={`delete-btn-${skill.name}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>

                <p className="skill-description">
                  {skill.description || <em className="muted">{t("skillLibrary.noDescription", lang)}</em>}
                </p>

                <div className="agent-distribution-section">
                  <h4 className="matrix-title">{t("skillLibrary.agentMatrixTitle", lang)}</h4>
                  <div className="agent-matrix-badges">
                    {SUPPORTED_AGENTS.map((agent) => {
                      const isLinked = Boolean(skill.linked_agents?.[agent.id]);
                      const key = `${agent.id}:${skill.name}`;
                      const isToggling = Boolean(togglingMap[key]);

                      return (
                        <button
                          key={agent.id}
                          type="button"
                          className={`agent-link-badge ${isLinked ? "linked" : "unlinked"}`}
                          onClick={() => handleToggleAgent(agent.id, skill.name, isLinked)}
                          disabled={isToggling}
                          title={`${agent.name} (${isLinked ? t("skillLibrary.linked", lang) : t("skillLibrary.unlinked", lang)})`}
                          aria-label={`Toggle ${agent.name} link for ${skill.name}`}
                          data-testid={`agent-badge-${skill.name}-${agent.id}`}
                        >
                          <div className="badge-agent-info">
                            <AgentIdentityMark agentId={agent.id} />
                          </div>
                          <span className={`link-status-tag ${isLinked ? "status-linked" : "status-unlinked"}`}>
                            {isToggling
                              ? "..."
                              : isLinked
                              ? t("skillLibrary.linked", lang)
                              : t("skillLibrary.unlinked", lang)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteConfirm(null)}>
          <div className="delete-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <div className="delete-confirm-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </div>
              <div>
                <h3>{lang === "zh" ? "确认删除技能" : "Delete Skill"}</h3>
                <span className="delete-confirm-skill-name">{deleteConfirm.skillName}</span>
              </div>
            </div>

            <div className="delete-confirm-body">
              <p>
                {lang === "zh"
                  ? <>确定要删除技能 <strong>{deleteConfirm.skillName}</strong> 吗？</>
                  : <>Are you sure you want to delete <strong>{deleteConfirm.skillName}</strong>?</>}
              </p>
              <p className="delete-confirm-warning">
                {lang === "zh"
                  ? <>此操作将删除 <code>~/.asm/skills/{deleteConfirm.skillName}</code> 目录{deleteConfirm.linkedCount > 0 ? `，并移除 ${deleteConfirm.linkedCount} 个 Agent 中的软链接引用` : ""}。此操作不可撤销。</>
                  : <>This will remove <code>~/.asm/skills/{deleteConfirm.skillName}</code>{deleteConfirm.linkedCount > 0 ? ` and unlink from ${deleteConfirm.linkedCount} Agent(s)` : ""}. This action cannot be undone.</>}
              </p>
            </div>

            <div className="delete-confirm-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
              >
                {lang === "zh" ? "取消" : "Cancel"}
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
                data-testid="confirm-delete-btn"
              >
                {deleting
                  ? (lang === "zh" ? "删除中..." : "Deleting...")
                  : (lang === "zh" ? "确认删除" : "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
