import { useState, useMemo } from "react";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";
import { getFeaturedSkillsByCategory, type FeaturedSkill } from "../data/featuredSkills";
import { SUPPORTED_AGENTS } from "./SkillLibrary";
import { AgentIdentityMark } from "../components/AgentVisual";

export type InstallTab = "marketplace" | "url" | "local";
export type SkillCategory = "all" | "ui" | "search" | "workflow";

export default function InstallSkills() {
  const lang = useI18nStore((s) => s.lang);
  const { skills: masterSkills, toggleAgentSkill } = useMasterRepoStore();
  const { report } = useScanStore();

  const [activeTab, setActiveTab] = useState<InstallTab>("marketplace");
  const [activeCategory, setActiveCategory] = useState<SkillCategory>("all");
  const [urlInput, setUrlInput] = useState("");
  const [localPath, setLocalPath] = useState("");

  // Target Agent Distribution Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [targetSkillName, setTargetSkillName] = useState<string>("");
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

  const handleOpenInstallModal = (skillName: string) => {
    setTargetSkillName(skillName);
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
    const parts = urlInput.trim().replace(/\/+$/, "").split("/");
    const repoName = parts[parts.length - 1] || "custom-skill";
    const cleanSkillName = repoName.replace(/\.git$/, "");
    handleOpenInstallModal(cleanSkillName);
  };

  const handleLocalSubmit = (path: string) => {
    if (!path.trim()) return;
    const normalized = path.trim().replace(/[/\\]+$/, "");
    const parts = normalized.split(/[/\\]/);
    const folderName = parts[parts.length - 1] || "local-skill";
    handleOpenInstallModal(folderName);
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
        await toggleAgentSkill(agentId, targetSkillName, true);
      }
    } finally {
      setInstalling(false);
      setModalOpen(false);
      setUrlInput("");
      setLocalPath("");
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
                    <h3 className="install-card-title">{skill.name}</h3>
                    <span className="install-card-author">{skill.author}</span>
                  </div>
                  <p className="install-card-desc">
                    {skill.description[lang] || skill.description["en"]}
                  </p>
                  <div className="install-card-footer">
                    <span className="install-card-files">{skill.fileCount} files</span>
                    {isInstalled ? (
                      <span className="installed-badge" data-testid={`installed-badge-${skill.name}`}>
                        {t("installSkills.installed", lang)}
                      </span>
                    ) : (
                      <button
                        className="btn primary install-btn"
                        onClick={() => handleOpenInstallModal(skill.name)}
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
