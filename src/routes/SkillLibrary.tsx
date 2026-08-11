import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { AgentIdentityMark } from "../components/AgentVisual";
import { Tooltip } from "../components/Tooltip";
import { isDiscoveredAgent } from "../agentDiscovery";
import { useScanStore } from "../stores/scanStore";
import { orderAgents, useAgentConfigStore } from "../stores/agentConfigStore";
import { exportMasterSkillZip, openSkillDirectory } from "../ipc/commands";
import { save } from "@tauri-apps/plugin-dialog";

export const SUPPORTED_AGENTS = [
  { id: "claude-code", name: "Claude Code" },
  { id: "cline", name: "Cline" },
  { id: "codebuddy", name: "CodeBuddy" },
  { id: "github-copilot", name: "GitHub Copilot" },
  { id: "droid", name: "Droid" },
  { id: "qoder", name: "Qoder" },
  { id: "qwen-code", name: "Qwen Code" },
  { id: "hermes", name: "Hermes Agent" },
  { id: "openclaw", name: "OpenClaw" },
  { id: "workbuddy", name: "WorkBuddy" },
  { id: "kimi-code", name: "Kimi Code CLI" },
  { id: "augment", name: "Augment" },
  { id: "roo-code", name: "Roo Code" },
  { id: "windsurf", name: "Windsurf" },
  { id: "codex", name: "Codex" },
  { id: "antigravity", name: "Antigravity" },
  { id: "pi-agent", name: "Pi Agent" },
  { id: "oh-my-pi", name: "Oh My Pi (OPM)" },
  { id: "grok", name: "Grok" },
  { id: "kiro", name: "Kiro CLI" },
  { id: "trae", name: "TRAE" },
  { id: "trae-cn", name: "TRAE CN" },
  { id: "opencode", name: "Open Code" },
  { id: "cursor", name: "Cursor" },
];

type SkillSort = "recent" | "name";
type SkillView = "card" | "list";
const SKILL_VIEW_STORAGE_KEY = "asm_skill_library_view";

function getStoredSkillView(): SkillView {
  return localStorage.getItem(SKILL_VIEW_STORAGE_KEY) === "list" ? "list" : "card";
}

export default function SkillLibrary() {
  const navigate = useNavigate();
  const { skills, loading, error, fetchMasterSkills, toggleAgentSkill, toggleAgentSkillsBatch, deleteMasterSkill } = useMasterRepoStore();
  const lang = useI18nStore((s) => s.lang);
  const scanReport = useScanStore((state) => state.report);
  const disabledAgentIds = useAgentConfigStore((state) => state.disabledAgentIds);
  const agentOrder = useAgentConfigStore((state) => state.agentOrder);
  const supportedAgents = orderAgents(SUPPORTED_AGENTS.filter((agent) => !disabledAgentIds.includes(agent.id) && scanReport?.agents.some((report) => report.agent_id === agent.id && isDiscoveredAgent(report))), agentOrder);

  const [searchQuery, setSearchQuery] = useState("");
  const [skillSort, setSkillSort] = useState<SkillSort>("recent");
  const [skillView, setSkillView] = useState<SkillView>(getStoredSkillView);
  const [expandedMatrixSkills, setExpandedMatrixSkills] = useState<Record<string, boolean>>({});
  const [openActionMenuSkill, setOpenActionMenuSkill] = useState<string | null>(null);
  const [togglingMap, setTogglingMap] = useState<Record<string, boolean>>({});
  const [batchTogglingSkill, setBatchTogglingSkill] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ skillName: string; linkedCount: number } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMasterSkills();
  }, [fetchMasterSkills]);

  const handleOpenDirectory = (path: string) => void openSkillDirectory(path);
  const handleSkillViewChange = (view: SkillView) => {
    localStorage.setItem(SKILL_VIEW_STORAGE_KEY, view);
    setSkillView(view);
  };
  const handleShare = async (skillName: string) => {
    const destination = await save({ defaultPath: `${skillName}.zip`, filters: [{ name: "ZIP", extensions: ["zip"] }] });
    if (destination) await exportMasterSkillZip(skillName, destination, useAgentConfigStore.getState().customPaths);
  };

  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      // Agent discovery affects both the matrix targets and link status. Refresh it
      // before re-reading the master repository so this page is always consistent.
      await useScanStore.getState().scan();
      await fetchMasterSkills();
    } finally {
      setRefreshing(false);
    }
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

  const handleToggleAllAgents = async (skillName: string, enable: boolean) => {
    if (batchTogglingSkill || supportedAgents.length === 0) return;
    setBatchTogglingSkill(skillName);
    try {
      const skill = skills.find((item) => item.name === skillName);
      const agentIds = supportedAgents
        .filter((agent) => Boolean(skill?.linked_agents?.[agent.id]) !== enable)
        .map((agent) => agent.id);
      await toggleAgentSkillsBatch(agentIds, skillName, enable);
    } finally {
      setBatchTogglingSkill(null);
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
    const matchedSkills = skills.filter((skill) => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = skill.name.toLowerCase().includes(query);
        const matchesDesc = skill.description.toLowerCase().includes(query);
        if (!matchesName && !matchesDesc) return false;
      }

      return true;
    });

    return [...matchedSkills].sort((a, b) => {
      if (skillSort === "name") return a.name.localeCompare(b.name);
      return (b.modified_at ?? 0) - (a.modified_at ?? 0) || a.name.localeCompare(b.name);
    });
  }, [skills, searchQuery, skillSort]);

  return (
    <section className="page master-skill-library">
      <div className="page-header">
        <div>
          <div className="master-library-title-row">
            <h1>{t("skillLibrary.title", lang)}</h1>
            <span className="master-library-skill-count">
              {t("skillLibrary.totalSkills", lang).replace("{count}", String(skills.length))}
            </span>
          </div>
          <p className="page-subtitle">{t("skillLibrary.subtitle", lang)}</p>
        </div>
        <button
          className="btn console-scan-button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          {refreshing ? t("skillLibrary.refreshing", lang) : t("skillLibrary.refresh", lang)}
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

        <div className="library-filter-actions">
          <div className="status-filter-group skill-sort-group" role="group" aria-label="Skill sort">
            <button
              className={`filter-btn ${skillSort === "recent" ? "is-active" : ""}`}
              onClick={() => setSkillSort("recent")}
            >
              {t("skillLibrary.sortRecent", lang)}
            </button>
            <button
              className={`filter-btn ${skillSort === "name" ? "is-active" : ""}`}
              onClick={() => setSkillSort("name")}
            >
              {t("skillLibrary.sortName", lang)}
            </button>
          </div>
          <div className="status-filter-group skill-view-group" role="group" aria-label="Skill view">
            <button
              aria-label={t("skillLibrary.cardView", lang)}
              aria-pressed={skillView === "card"}
              className={`skill-view-toggle ${skillView === "card" ? "is-active" : ""}`}
              onClick={() => handleSkillViewChange("card")}
              title={t("skillLibrary.cardView", lang)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
                <rect height="6" rx="1" stroke="currentColor" strokeWidth="2" width="6" x="3" y="3" />
                <rect height="6" rx="1" stroke="currentColor" strokeWidth="2" width="6" x="15" y="3" />
                <rect height="6" rx="1" stroke="currentColor" strokeWidth="2" width="6" x="3" y="15" />
                <rect height="6" rx="1" stroke="currentColor" strokeWidth="2" width="6" x="15" y="15" />
              </svg>
            </button>
            <button
              aria-label={t("skillLibrary.listView", lang)}
              aria-pressed={skillView === "list"}
              className={`skill-view-toggle ${skillView === "list" ? "is-active" : ""}`}
              onClick={() => handleSkillViewChange("list")}
              title={t("skillLibrary.listView", lang)}
              type="button"
            >
              <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15">
                <path d="M8 6h13M8 12h13M8 18h13" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                <path d="M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
              </svg>
            </button>
          </div>
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
        <div className={`master-skill-grid ${skillView === "list" ? "master-skill-grid--list" : ""}`}>
          {filteredSkills.map((skill) => {
            const linkedCount = supportedAgents.filter((agent) => skill.linked_agents?.[agent.id]).length;
            const linkedAgents = supportedAgents.filter((agent) => skill.linked_agents?.[agent.id]);
            const isMatrixExpanded = Boolean(expandedMatrixSkills[skill.name]);
            return (
              <div
                className={`master-skill-card master-skill-card--interactive ${skillView === "list" ? "master-skill-card--list" : ""}`}
                key={skill.name}
                data-testid={`skill-card-${skill.name}`}
                role="link"
                tabIndex={0}
                aria-label={skill.name}
                onClick={() => navigate(`/library/skills/${encodeURIComponent(skill.name)}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/library/skills/${encodeURIComponent(skill.name)}`);
                  }
                }}
              >
                <div className="master-skill-card-header">
                  <div className="title-section">
                    <h3 className="skill-title">{skill.name}</h3>
                    <code className="skill-path-badge" title={skill.path}>
                      {skill.path}
                    </code>
                  </div>
                  <div className="card-header-actions">
                    {(() => {
                      const linkedCount = supportedAgents.filter((agent) => skill.linked_agents?.[agent.id]).length;
                      const allLinked = supportedAgents.length > 0 && linkedCount === supportedAgents.length;
                      const partiallyLinked = linkedCount > 0 && !allLinked;
                      const batchBusy = batchTogglingSkill === skill.name;
                      return (
                        <Tooltip content={t(allLinked ? "skillLibrary.unlinkAllAgents" : "skillLibrary.linkAllAgents", lang)}>
                          <button className={`copy-path-btn skill-link-all-btn ${partiallyLinked ? "is-partial" : ""}`} type="button" disabled={batchBusy || supportedAgents.length === 0} onClick={(event) => { event.stopPropagation(); void handleToggleAllAgents(skill.name, !allLinked); }} aria-label={allLinked ? `Unlink all Agents for ${skill.name}` : `Link all Agents for ${skill.name}`}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3" />{allLinked ? <path d="m7 12 3 3 7-7" /> : partiallyLinked ? <path d="M8 12h8" /> : null}</svg>
                          </button>
                        </Tooltip>
                      );
                    })()}
                    <Tooltip content={t("skillLibrary.openDirectory", lang)}>
                      <button
                        className="copy-path-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenDirectory(skill.path);
                        }}
                        aria-label={`Open directory for ${skill.name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                        </svg>
                      </button>
                    </Tooltip>
                    <Tooltip content={t("skillLibrary.exportSkill", lang)}>
                      <button
                        className="copy-path-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleShare(skill.name);
                        }}
                        aria-label={`Share ${skill.name}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                      </button>
                    </Tooltip>
                    <Tooltip content={t("skillLibrary.deleteSkill", lang)}>
                      <button
                        className="delete-skill-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteClick(skill.name);
                        }}
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
                    </Tooltip>
                    {skillView === "list" && (
                      <div className="skill-list-more-actions">
                        <button
                          aria-expanded={openActionMenuSkill === skill.name}
                          aria-label={`${t("skillLibrary.moreActions", lang)} for ${skill.name}`}
                          className="skill-list-more-actions__trigger"
                          onClick={(event) => {
                            event.stopPropagation();
                            setOpenActionMenuSkill((current) => current === skill.name ? null : skill.name);
                          }}
                          type="button"
                        >
                          <svg aria-hidden="true" fill="currentColor" height="16" viewBox="0 0 24 24" width="16"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                        </button>
                        {openActionMenuSkill === skill.name && (
                          <div className="skill-list-more-actions__menu" data-testid={`skill-list-actions-${skill.name}`}>
                            <button aria-label={t("skillLibrary.openDirectory", lang)} onClick={(event) => { event.stopPropagation(); handleOpenDirectory(skill.path); }} type="button">
                              {t("skillLibrary.openDirectory", lang)}
                            </button>
                            <button aria-label={t("skillLibrary.exportSkill", lang)} onClick={(event) => { event.stopPropagation(); void handleShare(skill.name); }} type="button">
                              {t("skillLibrary.exportSkill", lang)}
                            </button>
                            <button aria-label={`Delete skill ${skill.name}`} className="is-danger" onClick={(event) => { event.stopPropagation(); setOpenActionMenuSkill(null); handleDeleteClick(skill.name); }} type="button">
                              {t("skillLibrary.deleteSkill", lang)}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <p className="skill-description">
                  {skill.description || <em className="muted">{t("skillLibrary.noDescription", lang)}</em>}
                </p>

                <span className="skill-list-link-summary">
                  {t("skillLibrary.linkedAgentCount", lang).replace("{count}", String(linkedCount))}
                </span>

                {skillView === "list" && (
                  <div className="skill-list-coverage" data-testid={`skill-list-coverage-${skill.name}`}>
                    <div className="skill-list-coverage__summary">
                      <span className="skill-list-coverage__count">
                        {t("skillLibrary.linkedAgentCoverage", lang)
                          .replace("{linked}", String(linkedCount))
                          .replace("{total}", String(supportedAgents.length))}
                      </span>
                      <div className="skill-list-linked-agents" aria-label={t("skillLibrary.linkedAgents", lang)}>
                        {linkedAgents.slice(0, 4).map((agent) => (
                          <span
                            className="skill-list-linked-agent"
                            data-testid={`list-linked-agent-${skill.name}-${agent.id}`}
                            key={agent.id}
                            title={agent.name}
                          >
                            <AgentIdentityMark agentId={agent.id} size={22} />
                          </span>
                        ))}
                        {linkedAgents.length > 4 && <span className="skill-list-linked-agent-overflow">+{linkedAgents.length - 4}</span>}
                      </div>
                    </div>
                    <button
                      aria-expanded={isMatrixExpanded}
                      aria-label={`${t(isMatrixExpanded ? "skillLibrary.hideMatrix" : "skillLibrary.showMatrix", lang)} for ${skill.name}`}
                      className="skill-list-matrix-toggle"
                      onClick={(event) => {
                        event.stopPropagation();
                        setExpandedMatrixSkills((previous) => ({ ...previous, [skill.name]: !previous[skill.name] }));
                      }}
                      type="button"
                    >
                      {t(isMatrixExpanded ? "skillLibrary.hideMatrix" : "skillLibrary.showMatrix", lang)}
                      <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
                        <path d={isMatrixExpanded ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>
                  </div>
                )}

                {(skillView === "card" || isMatrixExpanded) && <div className={`agent-distribution-section ${skillView === "list" ? "agent-distribution-section--compact" : ""}`}>
                  <h4 className="matrix-title">{t("skillLibrary.agentMatrixTitle", lang)}</h4>
                  <div className={`agent-matrix-badges ${skillView === "list" ? "agent-matrix-badges--wrap" : ""}`}>
                {supportedAgents.map((agent) => {
                      const isLinked = Boolean(skill.linked_agents?.[agent.id]);
                      const key = `${agent.id}:${skill.name}`;
                      const isToggling = Boolean(togglingMap[key]);

                      return (
                        <button
                          key={agent.id}
                          type="button"
                          className={`agent-link-badge ${isLinked ? "linked" : "unlinked"}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleToggleAgent(agent.id, skill.name, isLinked);
                          }}
                          disabled={isToggling}
                          title={`${agent.name} (${isLinked ? t("skillLibrary.linked", lang) : t("skillLibrary.unlinked", lang)})`}
                          aria-label={`Toggle ${agent.name} link for ${skill.name}`}
                          data-testid={`agent-badge-${skill.name}-${agent.id}`}
                        >
                          <div className="badge-agent-info">
                            <AgentIdentityMark agentId={agent.id} size={skillView === "list" ? 20 : 32} />
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
                </div>}
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
