import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { getFeaturedSkillsByCategory, type FeaturedSkill } from "../data/featuredSkills";
import { parseSkillsShInput } from "../utils/skillsShParser";
import { SUPPORTED_AGENTS } from "./SkillLibrary";
import { AgentIdentityMark } from "../components/AgentVisual";
import { getOnlineSkillDetailPath, searchGlobalSkills, type GlobalSkillItem } from "../api/globalSkillsSearch";
import { isDiscoveredAgent } from "../agentDiscovery";
import { useScanStore } from "../stores/scanStore";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { inspectGitSkills, type GitSkillCandidate } from "../ipc/commands";

export type InstallTab = "marketplace" | "online" | "url" | "local";
export type SkillCategory = "all" | "ui" | "search" | "workflow";
type InstallProgress =
  | { stage: "installing" }
  | { stage: "distributing"; completed: number; total: number; agentName: string };

export default function InstallSkills() {
  const location = useLocation();
  const navigate = useNavigate();
  const lang = useI18nStore((s) => s.lang);
  const { skills: masterSkills, toggleAgentSkill, installSkillToMaster } = useMasterRepoStore();
  const scanReport = useScanStore((state) => state.report);
  const disabledAgentIds = useAgentConfigStore((state) => state.disabledAgentIds);

  const [toast, setToast] = useState<{
    type: "success" | "error";
    title: string;
    skillName: string;
    linkedAgents: string[];
    message?: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<InstallTab>(() => (
    new URLSearchParams(location.search).get("tab") === "online" ? "online" : "marketplace"
  ));
  const [activeCategory, setActiveCategory] = useState<SkillCategory>("all");
  const [urlInput, setUrlInput] = useState("");
  const [isResolvingUrl, setIsResolvingUrl] = useState(false);
  const [urlResolveError, setUrlResolveError] = useState<string | null>(null);
  const [localPath, setLocalPath] = useState("");

  const [onlineQuery, setOnlineQuery] = useState("");
  const [onlinePage, setOnlinePage] = useState(1);
  const [onlineSortBy, setOnlineSortBy] = useState<"stars" | "updated">("stars");
  const [onlineResults, setOnlineResults] = useState<GlobalSkillItem[]>([]);
  const [totalOnlineCount, setTotalOnlineCount] = useState(0);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);

  const onlineRegistryLabel = totalOnlineCount > 0
    ? (lang === "zh"
      ? `🌐 全网 ${totalOnlineCount.toLocaleString()} 技能库`
      : `🌐 Global ${totalOnlineCount.toLocaleString()} Registry`)
    : t("installSkills.tabOnline", lang);

  const fileCountLabel = (fileCount?: number) => lang === "zh"
    ? `${fileCount ?? 1} 个文件`
    : `${fileCount ?? 1} file${fileCount === 1 ? "" : "s"}`;

  const installsLabel = (installsText?: string) => {
    if (!installsText || /indexed on skills\.sh/i.test(installsText)) return null;
    return installsText.replace(/^⚡\s*/, "");
  };

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
  const [targetSkillSubdir, setTargetSkillSubdir] = useState<string | undefined>();
  const [skillPicker, setSkillPicker] = useState<{
    source: string;
    candidates: GitSkillCandidate[];
  } | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<Record<string, boolean>>({});
  const [installing, setInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const openedRequestedInstall = useRef(false);

  const installedSkillNames = useMemo(() => {
    return new Set(masterSkills.map((s) => s.name));
  }, [masterSkills]);

  const featuredSkillsList = useMemo(() => {
    return getFeaturedSkillsByCategory(activeCategory);
  }, [activeCategory]);

  const availableAgents = useMemo(() => {
    const scannedAgents = scanReport?.agents ?? [];
    return SUPPORTED_AGENTS.filter((agent) =>
      !disabledAgentIds.includes(agent.id)
      && scannedAgents.some((report) => report.agent_id === agent.id && isDiscoveredAgent(report)),
    );
  }, [disabledAgentIds, scanReport]);
  const selectedAgentCount = availableAgents.filter((agent) => selectedAgents[agent.id]).length;
  const selectedAgentsLabel = lang === "zh"
    ? `已选择 ${selectedAgentCount} 个 Agent`
    : `${selectedAgentCount} selected`;
  const distributeLabel = lang === "zh"
    ? `分发至 ${selectedAgentCount} 个 Agent`
    : `Distribute to ${selectedAgentCount} Agents`;

  const handleOpenInstallModal = (skillName: string, source?: string, sourceSubdir?: string) => {
    setTargetSkillName(skillName);
    setTargetSkillSource(source || skillName);
    setTargetSkillSubdir(sourceSubdir);
    const initialSelected: Record<string, boolean> = {};
    availableAgents.forEach((agent) => {
      initialSelected[agent.id] = true;
    });
    setSelectedAgents(initialSelected);
    setModalOpen(true);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedSkill = params.get("install");
    if (!requestedSkill || openedRequestedInstall.current) return;

    openedRequestedInstall.current = true;
    setActiveTab("online");
    handleOpenInstallModal(requestedSkill, params.get("source") || requestedSkill);
    navigate("/install?tab=online", { replace: true });
  }, [location.search, navigate, availableAgents]);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    const parsedUrl = parseSkillsShInput(urlInput);
    setUrlResolveError(null);
    setIsResolvingUrl(true);
    try {
      const candidates = await inspectGitSkills(parsedUrl);
      if (candidates.length === 0) {
        setUrlResolveError(lang === "zh"
          ? "未在此仓库中找到包含 SKILL.md 的 Skill。"
          : "No Skill containing SKILL.md was found in this repository.");
        return;
      }
      if (candidates.length === 1) {
        const candidate = candidates[0];
        handleOpenInstallModal(candidate.name, parsedUrl, candidate.relative_path);
        return;
      }
      setSkillPicker({ source: parsedUrl, candidates });
    } catch (err) {
      setUrlResolveError(lang === "zh"
        ? `无法解析该 Git 仓库：${String(err)}`
        : `Unable to inspect this Git repository: ${String(err)}`);
    } finally {
      setIsResolvingUrl(false);
    }
  };

  const handleLocalSubmit = (path: string) => {
    if (!path.trim()) return;
    const normalized = path.trim().replace(/[/\\]+$/, "");
    const parts = normalized.split(/[/\\]/);
    const folderName = parts[parts.length - 1] || "local-skill";
    handleOpenInstallModal(folderName, normalized);
  };

  const handleBrowseLocalDirectory = async () => {
    const selectedPath = await open({ directory: true, multiple: false });
    if (typeof selectedPath !== "string") return;

    setLocalPath(selectedPath);
    handleLocalSubmit(selectedPath);
  };

  const handleBrowseLocalZip = async () => {
    const selectedPath = await open({ directory: false, multiple: false, filters: [{ name: "ZIP", extensions: ["zip"] }] });
    if (typeof selectedPath !== "string") return;
    setLocalPath(selectedPath);
    const fileName = selectedPath.split(/[/\\]/).pop()?.replace(/\.zip$/i, "") || "local-skill";
    handleOpenInstallModal(fileName, selectedPath);
  };

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgents((prev) => ({
      ...prev,
      [agentId]: !prev[agentId],
    }));
  };

  const handleConfirmInstall = async () => {
    if (!targetSkillName) return;
    const installedSkill = targetSkillName;
    const targetAgentIds = availableAgents
      .filter((agent) => selectedAgents[agent.id])
      .map((agent) => agent.id);
    const agentNames = availableAgents.filter((agent) => targetAgentIds.includes(agent.id)).map((agent) => agent.name);

    setInstalling(true);
    setInstallProgress({ stage: "installing" });
    try {
      const installedPath = await installSkillToMaster(
        installedSkill,
        targetSkillSource || installedSkill,
        targetSkillSubdir,
      );
      if (!installedPath) {
        throw new Error(lang === "zh" ? "无法安装到主技能仓库。" : "Unable to install the skill to the master repository.");
      }
      for (const [index, agentId] of targetAgentIds.entries()) {
        setInstallProgress({
          stage: "distributing",
          completed: index,
          total: targetAgentIds.length,
          agentName: agentNames[index] ?? agentId,
        });
        await toggleAgentSkill(agentId, installedSkill, true);
        setInstallProgress({
          stage: "distributing",
          completed: index + 1,
          total: targetAgentIds.length,
          agentName: agentNames[index] ?? agentId,
        });
      }
      setToast({
        type: "success",
        title: lang === "zh" ? "技能安装成功" : "Skill Installed Successfully",
        skillName: installedSkill,
        linkedAgents: agentNames,
      });
    } catch (err) {
      setToast({
        type: "error",
        title: lang === "zh" ? "技能安装失败" : "Installation Failed",
        skillName: installedSkill,
        linkedAgents: [],
        message: String(err),
      });
    } finally {
      setInstalling(false);
      setInstallProgress(null);
      setModalOpen(false);
      setUrlInput("");
      setLocalPath("");
      setTargetSkillSource("");
      setTargetSkillSubdir(undefined);
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

      {toast && (
        <div className="modal-overlay install-toast-overlay" data-testid="install-toast">
          <div className={`install-toast-card ${toast.type}`}>
            <div className="install-toast-header">
              <div className="install-toast-icon">
                {toast.type === "success" ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div className="install-toast-title-group">
                <h3>{toast.title}</h3>
                <span className="install-toast-skill-name">{toast.skillName}</span>
              </div>
            </div>

            <div className="install-toast-content">
              {toast.type === "success" ? (
                lang === "zh" ? (
                  <>
                    <p className="install-toast-path">
                      存储位置：<code>~/.asm/skills/{toast.skillName}</code>
                    </p>
                    <p className="install-toast-agents">
                      {toast.linkedAgents.length > 0
                        ? `已分发软链接至 ${toast.linkedAgents.length} 个 Agent (${toast.linkedAgents.join("、")})`
                        : "未分发 Agent 软链接"}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="install-toast-path">
                      Master path: <code>~/.asm/skills/{toast.skillName}</code>
                    </p>
                    <p className="install-toast-agents">
                      {toast.linkedAgents.length > 0
                        ? `Symlinked to ${toast.linkedAgents.length} Agents (${toast.linkedAgents.join(", ")})`
                        : "No agent symlinks created"}
                    </p>
                  </>
                )
              ) : (
                <p className="install-toast-error-msg">
                  {toast.message || "An unexpected error occurred during installation."}
                </p>
              )}
            </div>

            <div className="install-toast-footer">
              <button
                type="button"
                className="btn secondary"
                onClick={() => setToast(null)}
              >
                {lang === "zh" ? "完成" : "Done"}
              </button>
              {toast.type === "success" && (
                <Link
                  to={`/library/skills/${encodeURIComponent(toast.skillName)}`}
                  className="btn primary install-toast-detail-btn"
                  onClick={() => setToast(null)}
                >
                  {lang === "zh" ? "查看技能详情 ↗" : "View Skill Detail ↗"}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

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
          {onlineRegistryLabel}
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
              const detailSkill: GlobalSkillItem = {
                id: skill.ownerRepo ? `${skill.ownerRepo}/${skill.name}` : skill.id,
                name: skill.name,
                ownerRepo: skill.ownerRepo || skill.author,
                description: skill.description[lang] || skill.description.en,
                installsText: skill.installsText || "",
                repoUrl: skill.repoUrl,
                isVerifiedSkillsSh: true,
                fileCount: skill.fileCount,
              };
              return (
                <div
                  className="install-card install-card--interactive"
                  key={skill.id}
                  data-testid={`featured-card-${skill.name}`}
                  role="link"
                  tabIndex={0}
                  aria-label={skill.name}
                  onClick={() => navigate(getOnlineSkillDetailPath(detailSkill, "marketplace"))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(getOnlineSkillDetailPath(detailSkill, "marketplace"));
                    }
                  }}
                >
                  <div className="install-card-header">
                    <div className="install-card-title-group">
                      <h3 className="install-card-title">{skill.name}</h3>
                      {skill.ownerRepo && (
                        <span className="install-card-owner-repo">{skill.ownerRepo}</span>
                      )}
                    </div>
                    <span className="skills-sh-badge">{lang === "zh" ? "来自 skills.sh" : "From skills.sh"}</span>
                  </div>
                  <p className="install-card-desc">
                    {skill.description[lang] || skill.description["en"]}
                  </p>
                  <div className="install-card-footer">
                    <div className="install-card-meta">
                      <span className="install-card-files">{fileCountLabel(skill.fileCount)}</span>
                      {installsLabel(skill.installsText) && (
                        <span className="skills-sh-installs">⚡ {installsLabel(skill.installsText)}</span>
                      )}
                    </div>
                    {isInstalled ? (
                      <span className="installed-badge" data-testid={`installed-badge-${skill.name}`}>
                        {t("installSkills.installed", lang)}
                      </span>
                    ) : (
                      <button
                        className="btn primary install-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpenInstallModal(skill.name, skill.ownerRepo || skill.repoUrl);
                        }}
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
                  const skillInstallsLabel = installsLabel(skill.installsText);
                  return (
                    <div
                      className="install-card install-card--interactive"
                      key={skill.id}
                      data-testid={`online-card-${skill.name}`}
                      role="link"
                      tabIndex={0}
                      aria-label={skill.name}
                      onClick={() => navigate(getOnlineSkillDetailPath(skill))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigate(getOnlineSkillDetailPath(skill));
                        }
                      }}
                    >
                      <div className="install-card-header">
                        <div className="install-card-title-group">
                          <h3 className="install-card-title">{skill.name}</h3>
                          {skill.ownerRepo && (
                            <span className="install-card-owner-repo">{skill.ownerRepo}</span>
                          )}
                        </div>
                        {skill.isVerifiedSkillsSh ? (
                          <span className="skills-sh-badge">{lang === "zh" ? "来自 skills.sh" : "From skills.sh"}</span>
                        ) : (
                          <span className="github-badge">GitHub</span>
                        )}
                      </div>
                      <p className="install-card-desc">{skill.description}</p>
                      <div className="install-card-footer">
                        <div className="install-card-meta">
                          <span className="install-card-files">{fileCountLabel(skill.fileCount)}</span>
                          {skillInstallsLabel && <span className="skills-sh-installs">⚡ {skillInstallsLabel}</span>}
                        </div>
                        {isInstalled ? (
                          <span className="installed-badge" data-testid={`installed-badge-${skill.name}`}>
                            {t("installSkills.installed", lang)}
                          </span>
                        ) : (
                          <button
                            className="btn primary install-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenInstallModal(skill.name, skill.ownerRepo || skill.repoUrl || skill.skillsShUrl);
                            }}
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
              onChange={(e) => {
                setUrlInput(e.target.value);
                setUrlResolveError(null);
              }}
              aria-label="Git or GitHub repository URL"
            />
            <button
              type="submit"
              className="btn primary install-url-submit"
              disabled={!urlInput.trim() || isResolvingUrl}
            >
              {isResolvingUrl ? (lang === "zh" ? "解析中…" : "Resolving…") : t("installSkills.urlSubmit", lang)}
            </button>
          </form>
          {urlResolveError && <p className="install-url-error" role="alert">{urlResolveError}</p>}
        </div>
      )}

      {/* Tab 3: Local Import */}
      {activeTab === "local" && (
        <div className="install-tab-content" data-testid="local-content">
          <div className="install-local-import-panel">
            <div className="install-local-import-heading">
              <span className="dropzone-icon">📁</span>
              <div><h2>{lang === "zh" ? "导入本地技能" : "Import Local Skill"}</h2><p>{t("installSkills.localPrompt", lang)}</p></div>
            </div>
            <div className="install-local-import-actions">
              <button type="button" className="install-local-choice" onClick={() => void handleBrowseLocalDirectory()}>
                <span className="install-local-choice-icon">📁</span><span><strong>{lang === "zh" ? "选择文件夹" : "Choose Folder"}</strong><small>{lang === "zh" ? "导入一个技能目录" : "Import a skill directory"}</small></span>
              </button>
              <button type="button" className="install-local-choice" onClick={() => void handleBrowseLocalZip()}>
                <span className="install-local-choice-icon">🗜️</span><span><strong>{lang === "zh" ? "选择 ZIP 文件" : "Choose ZIP File"}</strong><small>{lang === "zh" ? "导入已分享的技能包" : "Import a shared skill package"}</small></span>
              </button>
            </div>
            {localPath && <code className="dropzone-path">{localPath}</code>}
          </div>
        </div>
      )}

      {skillPicker && (
        <div className="modal-overlay" data-testid="git-skill-picker">
          <div className="modal-content git-skill-picker-modal" role="dialog" aria-modal="true" aria-labelledby="git-skill-picker-title">
            <div className="modal-header-row">
              <div>
                <h2 id="git-skill-picker-title">{lang === "zh" ? "选择要安装的 Skill" : "Choose a Skill to install"}</h2>
                <p className="modal-subtitle">
                  {lang === "zh"
                    ? "该仓库包含多个 Skill。请选择一个，再决定要分发到哪些 Agent。"
                    : "This repository contains multiple Skills. Choose one before selecting target Agents."}
                </p>
              </div>
            </div>
            <div className="git-skill-candidate-list">
              {skillPicker.candidates.map((candidate) => (
                <button
                  type="button"
                  className="git-skill-candidate"
                  key={candidate.relative_path}
                  onClick={() => {
                    handleOpenInstallModal(candidate.name, skillPicker.source, candidate.relative_path);
                    setSkillPicker(null);
                  }}
                >
                  <strong>{candidate.name}</strong>
                  <span>{candidate.description || (lang === "zh" ? "未提供描述" : "No description provided")}</span>
                  <code>{candidate.relative_path}</code>
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn secondary" onClick={() => setSkillPicker(null)}>
                {t("installSkills.cancel", lang)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Target Agent Distribution Modal */}
      {modalOpen && (
        <div className="modal-overlay" data-testid="target-agent-modal">
          <div className="modal-content install-target-modal" role="dialog" aria-modal="true" aria-labelledby="target-agent-modal-title">
            <div className="modal-header-row">
              <div>
                <h2 id="target-agent-modal-title">{t("installSkills.targetModalTitle", lang)}</h2>
                <p className="modal-subtitle">
                  Target Skill: <code className="target-skill-chip">{targetSkillName}</code>
                </p>
              </div>
              <div className="modal-header-actions">
                <span className="modal-selection-count" aria-live="polite">{selectedAgentsLabel}</span>
                <div className="modal-select-actions">
                  <button
                    type="button"
                    className="modal-text-btn"
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      availableAgents.forEach((a) => (all[a.id] = true));
                      setSelectedAgents(all);
                    }}
                  >
                    {lang === "zh" ? "全选" : "Select All"}
                  </button>
                  <span className="divider" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="modal-text-btn"
                    onClick={() => setSelectedAgents({})}
                  >
                    {lang === "zh" ? "清空" : "Clear"}
                  </button>
                </div>
              </div>
            </div>

            <div className="target-agent-grid">
              {availableAgents.map((agent) => {
                const isSelected = Boolean(selectedAgents[agent.id]);
                return (
                  <button
                    type="button"
                    key={agent.id}
                    className={`target-agent-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => toggleAgentSelection(agent.id)}
                    disabled={installing}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`${agent.name}, ${isSelected ? (lang === "zh" ? "已选择" : "selected") : (lang === "zh" ? "未选择" : "not selected")}`}
                  >
                    <div className="target-agent-card-left">
                      <AgentIdentityMark agentId={agent.id} />
                      <span className="agent-name">{agent.name}</span>
                    </div>
                    <span className={`target-check-indicator ${isSelected ? "is-active" : ""}`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        )}
                      </span>
                  </button>
                );
              })}
            </div>

            {installProgress && (
              <div className="install-progress-panel" aria-live="polite" data-testid="install-progress">
                <div className="install-progress-copy">
                  <span className="install-progress-title">{t("installSkills.progressTitle", lang)}</span>
                  <span className="install-progress-status">
                    {installProgress.stage === "installing"
                      ? t("installSkills.progressInstalling", lang)
                      : t("installSkills.progressDistributing", lang)
                          .replace("{completed}", String(installProgress.completed))
                          .replace("{total}", String(installProgress.total))
                          .replace("{agent}", installProgress.agentName)}
                  </span>
                </div>
                <div
                  className={`install-progress-track ${installProgress.stage === "installing" ? "is-indeterminate" : ""}`}
                  role="progressbar"
                  aria-label={t("installSkills.progressTitle", lang)}
                  aria-valuemin={0}
                  aria-valuemax={installProgress.stage === "distributing" ? installProgress.total : undefined}
                  aria-valuenow={installProgress.stage === "distributing" ? installProgress.completed : undefined}
                >
                  <span
                    className="install-progress-fill"
                    style={installProgress.stage === "distributing"
                      ? { width: `${Math.max(8, (installProgress.completed / installProgress.total) * 100)}%` }
                      : undefined}
                  />
                </div>
              </div>
            )}

            <div className="modal-actions">
              <span className="modal-actions-summary">{selectedAgentsLabel}</span>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setModalOpen(false)}
                disabled={installing}
              >
                {t("installSkills.cancel", lang)}
              </button>
              <button
                type="button"
                className="btn primary confirm-btn install-distribute-btn"
                onClick={handleConfirmInstall}
                disabled={installing || selectedAgentCount === 0}
                data-testid="confirm-install-btn"
              >
                {installing ? t("installSkills.installing", lang) : distributeLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
