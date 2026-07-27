import { useState, useMemo, useEffect } from "react";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";
import { getFeaturedSkillsByCategory, type FeaturedSkill } from "../data/featuredSkills";
import { parseSkillsShInput } from "../utils/skillsShParser";
import { SUPPORTED_AGENTS } from "./SkillLibrary";
import { AgentIdentityMark } from "../components/AgentVisual";
import { searchGlobalSkills, type GlobalSkillItem } from "../api/globalSkillsSearch";

export type InstallTab = "marketplace" | "online" | "url" | "local";
export type SkillCategory = "all" | "ui" | "search" | "workflow";

export default function InstallSkills() {
  const lang = useI18nStore((s) => s.lang);
  const { skills: masterSkills, toggleAgentSkill, importToMaster } = useMasterRepoStore();
  const { report } = useScanStore();

  const [activeTab, setActiveTab] = useState<InstallTab>("marketplace");
  const [activeCategory, setActiveCategory] = useState<SkillCategory>("all");
  const [urlInput, setUrlInput] = useState("");
  const [localPath, setLocalPath] = useState("");

  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlinePage, setOnlinePage] = useState(1);
  const [onlineSortBy, setOnlineSortBy] = useState<"stars" | "updated">("stars");
  const [onlineResults, setOnlineResults] = useState<GlobalSkillItem[]>([]);
  const [totalOnlineCount, setTotalOnlineCount] = useState(0);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  useEffect(() => {
    if (activeTab !== "online") return;

    let isMounted = true;
    setIsSearchingOnline(true);

    const timer = setTimeout(() => {
      searchGlobalSkills({ query: onlineQuery, page: onlinePage, pageSize: 18, sortBy: onlineSortBy })
        .then((res) => {
          if (isMounted) {
            setOnlineResults(res.items);
            setTotalOnlineCount(res.totalCount);
            setIsSearchingOnline(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setOnlineResults([]);
            setTotalOnlineCount(0);
            setIsSearchingOnline(false);
          }
        });
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeTab, onlineQuery, onlinePage, onlineSortBy]);

  // Target Agent Distribution Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetSkillName, setTargetSkillName] = useState<string>("");
  const [targetSkillSource, setTargetSkillSource] = useState<string>("");
  const [selectedAgents, setSelectedAgents] = useState<Record<string, boolean>>({});
  const [installing, setInstalling] = useState(false);

  const installedSkillNames = useMemo(() => {
    return new Set(masterSkills.map((s) => s.name));
  }, [masterSkills]);

  const featuredSkillsList = useMemo(() => {
    return getFeaturedSkillsByCategory(activeCategory);
  }, [activeCategory]);

  const availableAgents = useMemo(() => {
    if (report?.agents && report.agents.length > 0) {
      return report.agents.map((a) => ({
        id: a.agent_id,
        name: a.display_name || a.agent_id,
      }));
    }
    return SUPPORTED_AGENTS;
  }, [report]);

  const handleOpenInstallModal = (skillName: string, source?: string) => {
    setTargetSkillName(skillName);
    setTargetSkillSource(source || skillName);
    const initialSelected: Record<string, boolean> = {};
    availableAgents.forEach((agent) => {
      initialSelected[agent.id] = true;
    });
    setSelectedAgents(initialSelected);
    setModalOpen(true);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    const parsedUrl = parseSkillsShInput(urlInput);
    const parts = parsedUrl.trim().replace(/\/+$/, "").split("/");
    const repoName = parts[parts.length - 1] || "custom-skill";
    const cleanSkillName = repoName.replace(/\.git$/, "");
    handleOpenInstallModal(cleanSkillName, parsedUrl);
  };

  const handleLocalSubmit = (path: string) => {
    if (!path.trim()) return;
    const normalized = path.trim().replace(/[/\\]+$/, "");
    const parts = normalized.split(/[/\\]/);
    const folderName = parts[parts.length - 1] || "local-skill";
    handleOpenInstallModal(folderName, normalized);
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const handleConfirmInstall = async () => {
    if (!targetSkillName) return;
    setInstalling(true);
    try {
      const targetAgentIds = Object.keys(selectedAgents).filter((id) => selectedAgents[id]);
      for (const agentId of targetAgentIds) {
        await importToMaster(agentId, targetSkillSource || targetSkillName);
        await toggleAgentSkill(agentId, targetSkillName, true);
      }
    } finally {
      setInstalling(false);
      setModalOpen(false);
      setUrlInput("");
      setLocalPath("");
      setTargetSkillSource("");
    }
  };

  return (
    <div className="page install-skills-page">
      <header className="page-header">
        <div>
          <h1>{t("installSkills.title", lang)}</h1>
          <p className="page-subtitle">{t("installSkills.subtitle", lang)}</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="install-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "marketplace"}
          className={`install-tab-btn ${activeTab === "marketplace" ? "is-active" : ""}`}
          onClick={() => setActiveTab("marketplace")}
        >
          {t("installSkills.tabMarketplace", lang)}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "online"}
          className={`install-tab-btn ${activeTab === "online" ? "is-active" : ""}`}
          onClick={() => setActiveTab("online")}
        >
          {t("installSkills.tabOnline", lang)}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "url"}
          className={`install-tab-btn ${activeTab === "url" ? "is-active" : ""}`}
          onClick={() => setActiveTab("url")}
        >
          {t("installSkills.tabUrl", lang)}
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "local"}
          className={`install-tab-btn ${activeTab === "local" ? "is-active" : ""}`}
          onClick={() => setActiveTab("local")}
        >
          {t("installSkills.tabLocal", lang)}
        </button>
      </div>

      {/* Tab 1: Marketplace */}
      {activeTab === "marketplace" && (
        <div className="install-tab-content" data-testid="marketplace-content">
          <div className="install-category-bar" role="group" aria-label="Category filter">
            <button
              className={`install-category-chip ${activeCategory === "all" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("all")}
            >
              {t("installSkills.filterAll", lang)}
            </button>
            <button
              className={`install-category-chip ${activeCategory === "ui" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("ui")}
            >
              {t("installSkills.filterUi", lang)}
            </button>
            <button
              className={`install-category-chip ${activeCategory === "search" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("search")}
            >
              {t("installSkills.filterSearch", lang)}
            </button>
            <button
              className={`install-category-chip ${activeCategory === "workflow" ? "is-active" : ""}`}
              onClick={() => setActiveCategory("workflow")}
            >
              {t("installSkills.filterWorkflow", lang)}
            </button>
          </div>

          <div className="install-card-grid">
            {featuredSkillsList.map((skill: FeaturedSkill) => {
              const isInstalled = installedSkillNames.has(skill.name);
              return (
                <div className="install-card" key={skill.id} data-testid={`featured-card-${skill.name}`}>
                  <div className="install-card-header">
                    <div className="install-card-title-group">
                      <h3 className="install-card-title">{skill.name}</h3>
                      {skill.ownerRepo && (
                        <span className="install-card-owner-repo">{skill.ownerRepo}</span>
                      )}
                    </div>
                    <span className="skills-sh-badge">skills.sh Verified</span>
                  </div>
                  <p className="install-card-desc">
                    {skill.description[lang] || skill.description["en"]}
                  </p>
                  <div className="install-card-footer">
                    <div className="install-card-meta">
                      <span className="install-card-files">{skill.fileCount} files</span>
                      {skill.installsText && (
                        <span className="skills-sh-installs">⚡ {skill.installsText}</span>
                      )}
                    </div>
                    {isInstalled ? (
                      <span className="installed-badge" data-testid={`installed-badge-${skill.name}`}>
                        {t("installSkills.installed", lang)}
                      </span>
                    ) : (
                      <button
                        className="btn primary install-btn"
                        onClick={() => handleOpenInstallModal(skill.name, skill.ownerRepo || skill.repoUrl)}
                        data-testid={`install-btn-${skill.name}`}
                      >
                        {t("nav.install", lang)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab: Online Search */}
      {activeTab === "online" && (
        <div className="install-tab-content" data-testid="online-content">
          <div className="install-online-controls">
            <div className="install-online-search-box">
              <input
                type="text"
                className="install-online-input"
                placeholder={t("installSkills.searchOnlinePlaceholder", lang)}
                value={onlineQuery}
                onChange={(e) => {
                  setOnlineQuery(e.target.value);
                  setOnlinePage(1);
                }}
                aria-label="Online skill search query"
              />
            </div>
            <div className="install-sort-group" role="group" aria-label="Sort order">
              <button
                type="button"
                className={`install-sort-btn ${onlineSortBy === "stars" ? "is-active" : ""}`}
                onClick={() => {
                  setOnlineSortBy("stars");
                  setOnlinePage(1);
                }}
                data-testid="sort-stars-btn"
              >
                {t("installSkills.sortByStars", lang)}
              </button>
              <button
                type="button"
                className={`install-sort-btn ${onlineSortBy === "updated" ? "is-active" : ""}`}
                onClick={() => {
                  setOnlineSortBy("updated");
                  setOnlinePage(1);
                }}
                data-testid="sort-updated-btn"
              >
                {t("installSkills.sortByUpdated", lang)}
              </button>
            </div>
          </div>

          {isSearchingOnline ? (
            <div className="install-online-spinner" data-testid="online-spinner">
              <span>{t("installSkills.searching", lang)}</span>
            </div>
          ) : (
            <>
              <div className="install-card-grid" data-testid="online-card-grid">
                {onlineResults.map((skill: GlobalSkillItem) => {
                  const isInstalled = installedSkillNames.has(skill.name);
                  return (
                    <div className="install-card" key={skill.id} data-testid={`online-card-${skill.name}`}>
                      <div className="install-card-header">
                        <div className="install-card-title-group">
                          <h3 className="install-card-title">{skill.name}</h3>
                          {skill.ownerRepo && (
                            <span className="install-card-owner-repo">{skill.ownerRepo}</span>
                          )}
                        </div>
                        {skill.isVerifiedSkillsSh ? (
                          <span className="skills-sh-badge">skills.sh Verified</span>
                        ) : (
                          <span className="github-badge">GitHub</span>
                        )}
                      </div>
                      <p className="install-card-desc">{skill.description}</p>
                      <div className="install-card-footer">
                        <div className="install-card-meta">
                          {skill.installsText && (
                            <span className="skills-sh-installs">{skill.installsText}</span>
                          )}
                          {(skill.repoUrl || skill.skillsShUrl) && (
                            <a
                              href={skill.repoUrl || skill.skillsShUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="muted"
                              style={{ textDecoration: "none", fontSize: "12px" }}
                            >
                              🔗 ↗
                            </a>
                          )}
                        </div>
                        {isInstalled ? (
                          <span className="installed-badge" data-testid={`installed-badge-${skill.name}`}>
                            {t("installSkills.installed", lang)}
                          </span>
                        ) : (
                          <button
                            className="btn primary install-btn"
                            onClick={() => handleOpenInstallModal(skill.name, skill.ownerRepo || skill.repoUrl || skill.skillsShUrl)}
                            data-testid={`install-btn-${skill.name}`}
                          >
                            {t("nav.install", lang)}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="install-pagination" data-testid="online-pagination">
                <button
                  type="button"
                  className="btn install-page-btn"
                  disabled={onlinePage <= 1 || isSearchingOnline}
                  onClick={() => setOnlinePage((p) => Math.max(1, p - 1))}
                  data-testid="page-prev-btn"
                >
                  {t("installSkills.pagePrev", lang)}
                </button>
                <span className="install-page-info">
                  {lang === "zh"
                    ? `第 ${onlinePage} 页 (共 ${totalOnlineCount.toLocaleString()} 个技能)`
                    : `Page ${onlinePage} (${totalOnlineCount.toLocaleString()} skills)`}
                </span>
                <button
                  type="button"
                  className="btn install-page-btn"
                  disabled={onlinePage * 20 >= totalOnlineCount || isSearchingOnline}
                  onClick={() => setOnlinePage((p) => p + 1)}
                  data-testid="page-next-btn"
                >
                  {t("installSkills.pageNext", lang)}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: URL Import */}
      {activeTab === "url" && (
        <div className="install-tab-content" data-testid="url-content">
          <form className="install-url-box" onSubmit={handleUrlSubmit}>
            <input
              type="text"
              className="install-url-input"
              placeholder={t("installSkills.urlPlaceholder", lang)}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              aria-label="Git or GitHub repository URL"
            />
            <button
              type="submit"
              className="btn primary install-url-submit"
              disabled={!urlInput.trim()}
            >
              {t("installSkills.urlSubmit", lang)}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Local Import */}
      {activeTab === "local" && (
        <div className="install-tab-content" data-testid="local-content">
          <div
            className="install-local-dropzone"
            onClick={() => {
              const inputPath = prompt("Enter local folder path:");
              if (inputPath) {
                setLocalPath(inputPath);
                handleLocalSubmit(inputPath);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const folderName = e.dataTransfer.files[0].name || "local-skill";
                handleLocalSubmit(folderName);
              }
            }}
          >
            <div className="dropzone-icon">📁</div>
            <p className="dropzone-text">{t("installSkills.localPrompt", lang)}</p>
            {localPath && <code className="dropzone-path">{localPath}</code>}
          </div>
        </div>
      )}

      {/* Target Agent Distribution Modal */}
      {modalOpen && (
        <div className="modal-overlay" data-testid="target-agent-modal">
          <div className="modal-content install-target-modal">
            <h2>{t("installSkills.targetModalTitle", lang)}</h2>
            <p className="modal-subtitle">
              Target Skill: <strong>{targetSkillName}</strong>
            </p>

            <div className="target-agent-list">
              {availableAgents.map((agent) => {
                const isSelected = Boolean(selectedAgents[agent.id]);
                return (
                  <label key={agent.id} className={`target-agent-item ${isSelected ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAgentSelection(agent.id)}
                    />
                    <AgentIdentityMark agentId={agent.id} />
                    <span className="agent-name">{agent.name}</span>
                  </label>
                );
              })}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn"
                onClick={() => setModalOpen(false)}
                disabled={installing}
              >
                {t("installSkills.cancel", lang)}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleConfirmInstall}
                disabled={installing}
                data-testid="confirm-install-btn"
              >
                {installing ? "Installing..." : t("installSkills.targetModalConfirm", lang)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
