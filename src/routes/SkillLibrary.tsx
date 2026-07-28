import { useEffect, useState, useMemo } from "react";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { AgentIdentityMark } from "../components/AgentVisual";

import { translateSkill } from "../utils/skillTranslator";

export const SUPPORTED_AGENTS = [
  { id: "claude-code", name: "Claude Code" },
  { id: "codex", name: "Codex" },
  { id: "antigravity", name: "Antigravity" },
  { id: "pi-agent", name: "Pi Agent" },
  { id: "opencode", name: "Open Code" },
  { id: "cursor", name: "Cursor" },
];

export type StatusFilter = "all" | "linked" | "unlinked";

export default function SkillLibrary() {
  const { skills, loading, error, fetchMasterSkills, toggleAgentSkill } = useMasterRepoStore();
  const lang = useI18nStore((s) => s.lang);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});

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

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const tr = translateSkill(skill.name, skill.description, "");
      const titleZh = skill.name_zh || tr.titleZh;
      const descZh = skill.description_zh || tr.descriptionZh;

      // Search filter matches English or Chinese name/description
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = skill.name.toLowerCase().includes(query) || (titleZh && titleZh.toLowerCase().includes(query));
        const matchesDesc = skill.description.toLowerCase().includes(query) || (descZh && descZh.toLowerCase().includes(query));
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
            const tr = translateSkill(skill.name, skill.description, "");
            const titleZh = skill.name_zh || tr.titleZh;
            const displayTitle = lang === "zh" ? (titleZh || skill.name) : skill.name;
            const displayDesc = lang === "zh" ? (skill.description_zh || tr.descriptionZh) : (skill.description || null);

            return (
              <div className="master-skill-card" key={skill.name} data-testid={`skill-card-${skill.name}`}>
                <div className="master-skill-card-header">
                  <div className="title-section">
                    <h3 className="skill-title">
                      {displayTitle}
                      {lang === "zh" && titleZh && titleZh !== skill.name && (
                        <span className="skill-id-subtag" style={{ marginLeft: 8, opacity: 0.65, fontSize: "0.8em", fontWeight: "normal" }}>
                          ({skill.name})
                        </span>
                      )}
                    </h3>
                    <code className="skill-path-badge" title={skill.path}>
                      {skill.path}
                    </code>
                  </div>
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
                </div>

                <p className="skill-description">
                  {displayDesc || <em className="muted">{t("skillLibrary.noDescription", lang)}</em>}
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
    </section>
  );
}
