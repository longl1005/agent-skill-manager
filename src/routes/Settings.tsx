import { useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import appPackage from "../../package.json";
import { AgentIdentityMark } from "../components/AgentVisual";
import { SettingsIcon, type SettingsIconName } from "../components/SettingsIcon";
import { SettingsSelect } from "../components/SettingsSelect";
import { isDiscoveredAgent } from "../agentDiscovery";
import { migrateAgentSkillsDir, resetAgentSkillsDir } from "../ipc/commands";
import { t, type Language, type TranslationKey } from "../locales/dict";
import { orderAgents, useAgentConfigStore } from "../stores/agentConfigStore";
import { useI18nStore } from "../stores/i18nStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { usePerformanceDiagnosticsStore } from "../stores/performanceDiagnosticsStore";
import { useScanStore } from "../stores/scanStore";
import { useThemeStore, type ThemeMode, type ThemeStyle } from "../stores/themeStore";
import { useUpdateStore } from "../stores/updateStore";

type SettingsSectionId = "general" | "agents" | "diagnostics" | "updates";

interface ThemeOption {
  id: ThemeMode;
  titleKey: TranslationKey;
}

const colorSchemeOptions: ThemeOption[] = [
  { id: "system", titleKey: "settings.theme.system" },
  { id: "light", titleKey: "settings.theme.light" },
  { id: "dark", titleKey: "settings.theme.dark" },
];

interface ThemeStyleOption {
  id: ThemeStyle;
  titleKey: TranslationKey;
}

const themeStyleOptions: ThemeStyleOption[] = [
  { id: "graphite", titleKey: "settings.style.graphite" },
  { id: "aura", titleKey: "settings.style.aura" },
  { id: "jade", titleKey: "settings.style.jade" },
];

interface LangOption {
  id: Language;
  titleKey: TranslationKey;
}

const langOptions: LangOption[] = [
  { id: "zh", titleKey: "settings.lang.zh" },
  { id: "en", titleKey: "settings.lang.en" },
];

interface AgentPathItem {
  id: string;
  name: string;
  defaultPath: string;
}

const knownAgents: AgentPathItem[] = [
  { id: "claude-code", name: "Claude Code", defaultPath: "~/.claude/skills" },
  { id: "cline", name: "Cline", defaultPath: "~/.agents/skills" },
  { id: "codebuddy", name: "CodeBuddy", defaultPath: "~/.codebuddy/skills" },
  { id: "github-copilot", name: "GitHub Copilot", defaultPath: "~/.copilot/skills" },
  { id: "droid", name: "Droid", defaultPath: "~/.factory/skills" },
  { id: "qoder", name: "Qoder", defaultPath: "~/.qoder/skills" },
  { id: "qwen-code", name: "Qwen Code", defaultPath: "~/.qwen/skills" },
  { id: "hermes", name: "Hermes Agent", defaultPath: "~/.hermes/skills" },
  { id: "openclaw", name: "OpenClaw", defaultPath: "~/.openclaw/skills" },
  { id: "workbuddy", name: "WorkBuddy", defaultPath: "~/.workbuddy/skills" },
  { id: "kimi-code", name: "Kimi Code CLI", defaultPath: "~/.kimi-code/skills" },
  { id: "augment", name: "Augment", defaultPath: "~/.augment/skills" },
  { id: "roo-code", name: "Roo Code", defaultPath: "~/.roo/skills" },
  { id: "windsurf", name: "Windsurf", defaultPath: "~/.codeium/windsurf/skills" },
  { id: "codex", name: "Codex", defaultPath: "~/.codex/skills" },
  { id: "antigravity", name: "Antigravity", defaultPath: "~/.gemini/config/skills" },
  { id: "pi-agent", name: "Pi Agent", defaultPath: "~/.pi/agent/skills" },
  { id: "oh-my-pi", name: "Oh My Pi (OPM)", defaultPath: "~/.omp/agent/skills" },
  { id: "grok", name: "Grok", defaultPath: "~/.grok/skills" },
  { id: "kiro", name: "Kiro CLI", defaultPath: "~/.kiro/skills" },
  { id: "trae", name: "TRAE", defaultPath: "~/.trae/skills" },
  { id: "trae-cn", name: "TRAE CN", defaultPath: "~/.trae-cn/skills" },
  { id: "opencode", name: "Open Code", defaultPath: "~/.config/opencode/skills" },
  { id: "cursor", name: "Cursor", defaultPath: "~/.cursor/skills" },
];

export default function Settings() {
  const { themeMode, themeStyle, setThemeMode, setThemeStyle } = useThemeStore();
  const { lang, setLanguage } = useI18nStore();
  const {
    customPaths,
    setCustomPath,
    clearCustomPath,
    resetAll,
    disabledAgentIds,
    setAgentDisabled,
    agentOrder,
    setAgentOrder,
  } = useAgentConfigStore();
  const unlinkAllAgentSkills = useMasterRepoStore((state) => state.unlinkAllAgentSkills);
  const scan = useScanStore((state) => state.scan);
  const report = useScanStore((state) => state.report);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const updateStatus = useUpdateStore((state) => state.status);
  const diagnosticsEnabled = usePerformanceDiagnosticsStore((state) => state.enabled);
  const diagnosticsSummary = usePerformanceDiagnosticsStore((state) => state.summary);
  const refreshDiagnosticsSummary = usePerformanceDiagnosticsStore((state) => state.refreshSummary);
  const setDiagnosticsEnabled = usePerformanceDiagnosticsStore((state) => state.setEnabled);
  const exportDiagnosticsReport = usePerformanceDiagnosticsStore((state) => state.exportReport);
  const clearDiagnosticsReports = usePerformanceDiagnosticsStore((state) => state.clearReports);

  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
  const [inputPaths, setInputPaths] = useState<Record<string, string>>(() => ({ ...customPaths }));
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);
  const [isMoreExpanded, setIsMoreExpanded] = useState(false);
  const [savingAgentId, setSavingAgentId] = useState<string | null>(null);
  const [savedAgentId, setSavedAgentId] = useState<string | null>(null);
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [agentToggleError, setAgentToggleError] = useState<string | null>(null);
  const [pathSaveError, setPathSaveError] = useState<string | null>(null);
  const [pendingDisableAgentId, setPendingDisableAgentId] = useState<string | null>(null);
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ id: string; name: string; x: number; y: number } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [diagnosticsAction, setDiagnosticsAction] = useState<"export" | "clear" | null>(null);
  const [diagnosticsError, setDiagnosticsError] = useState(false);
  const [isClearDiagnosticsDialogOpen, setIsClearDiagnosticsDialogOpen] = useState(false);
  const draggedAgentIdRef = useRef<string | null>(null);

  useEffect(() => {
    void refreshDiagnosticsSummary().catch(() => undefined);
  }, [refreshDiagnosticsSummary]);

  const handleInputChange = (agentId: string, value: string) => {
    setInputPaths((previous) => ({ ...previous, [agentId]: value }));
  };

  const handleSave = async (agentId: string) => {
    setSavingAgentId(agentId);
    setSavedAgentId(null);
    setPathSaveError(null);
    const value = inputPaths[agentId]?.trim();
    try {
      if (value) {
        await migrateAgentSkillsDir(agentId, customPaths[agentId] ?? null, value, customPaths);
        setCustomPath(agentId, value);
      } else {
        clearCustomPath(agentId);
      }
      await scan();
      setSavedAgentId(agentId);
    } catch (error) {
      setPathSaveError(lang === "zh" ? `目录迁移失败：${String(error)}` : `Directory migration failed: ${String(error)}`);
    } finally {
      setSavingAgentId(null);
    }
  };

  const handleReset = async (agentId: string) => {
    setPathSaveError(null);
    try {
      await resetAgentSkillsDir(agentId, customPaths[agentId] ?? null, customPaths);
      clearCustomPath(agentId);
    } catch (error) {
      setPathSaveError(lang === "zh" ? `目录迁移失败：${String(error)}` : `Directory migration failed: ${String(error)}`);
      return;
    }
    setInputPaths((previous) => {
      const next = { ...previous };
      delete next[agentId];
      return next;
    });
    await scan();
  };

  const handleResetAll = async () => {
    resetAll();
    setInputPaths({});
    await scan();
  };

  const handleDiagnosticsToggle = async () => {
    setDiagnosticsError(false);
    try {
      await setDiagnosticsEnabled(!diagnosticsEnabled);
    } catch {
      setDiagnosticsError(true);
    }
  };

  const handleExportDiagnostics = async () => {
    setDiagnosticsError(false);
    setDiagnosticsAction("export");
    try {
      const destination = await save({
        defaultPath: "asm-performance-diagnostics.jsonl",
        filters: [{ name: "JSONL", extensions: ["jsonl"] }],
      });
      if (destination) await exportDiagnosticsReport(destination);
    } catch {
      setDiagnosticsError(true);
    } finally {
      setDiagnosticsAction(null);
    }
  };

  const confirmClearDiagnostics = async () => {
    setDiagnosticsError(false);
    setDiagnosticsAction("clear");
    try {
      await clearDiagnosticsReports();
      setIsClearDiagnosticsDialogOpen(false);
    } catch {
      setDiagnosticsError(true);
    } finally {
      setDiagnosticsAction(null);
    }
  };

  const handleAgentToggle = (agentId: string, enabled: boolean) => {
    if (enabled) {
      setAgentDisabled(agentId, false);
      return;
    }
    setPendingDisableAgentId(agentId);
  };

  const confirmDisableAgent = async () => {
    if (!pendingDisableAgentId) return;
    const agentId = pendingDisableAgentId;
    setTogglingAgentId(agentId);
    setAgentToggleError(null);
    const removed = await unlinkAllAgentSkills(agentId);
    if (removed === null) {
      setAgentToggleError(lang === "zh" ? "关闭失败，请重试。" : "Unable to disable the Agent. Try again.");
    } else {
      setAgentDisabled(agentId, true);
      setExpandedAgentId((current) => current === agentId ? null : current);
    }
    setTogglingAgentId(null);
    setPendingDisableAgentId(null);
  };

  const orderedKnownAgents = orderAgents(knownAgents, agentOrder);
  const detectedAgents = orderedKnownAgents.filter((agent) =>
    report?.agents.some((item) => item.agent_id === agent.id && isDiscoveredAgent(item)),
  );
  const moreAgents = orderedKnownAgents.filter((agent) => !detectedAgents.some((item) => item.id === agent.id));

  const moveDetectedAgent = (targetId: string, sourceId = draggedAgentId) => {
    if (!sourceId || sourceId === targetId) return;
    const ids = detectedAgents.map((agent) => agent.id);
    const sourceIndex = ids.indexOf(sourceId);
    const targetIndex = ids.indexOf(targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    ids.splice(sourceIndex, 1);
    ids.splice(targetIndex, 0, sourceId);
    setAgentOrder([...ids, ...moreAgents.map((agent) => agent.id)]);
  };

  const moveDetectedAgentByOffset = (agentId: string, offset: -1 | 1) => {
    const ids = detectedAgents.map((agent) => agent.id);
    const sourceIndex = ids.indexOf(agentId);
    const targetIndex = sourceIndex + offset;
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= ids.length) return;
    [ids[sourceIndex], ids[targetIndex]] = [ids[targetIndex], ids[sourceIndex]];
    setAgentOrder([...ids, ...moreAgents.map((agent) => agent.id)]);
  };

  const beginPointerDrag = (agent: AgentPathItem, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggedAgentIdRef.current = agent.id;
    setDraggedAgentId(agent.id);
    setDragPreview({
      id: agent.id,
      name: agent.name,
      x: Number.isFinite(event.clientX) ? event.clientX : 0,
      y: Number.isFinite(event.clientY) ? event.clientY : 0,
    });
  };

  const updatePointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const sourceId = draggedAgentIdRef.current;
    if (!sourceId) return;
    const targetId = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-agent-id]")?.dataset.agentId;
    setDragPreview((preview) => preview ? {
      ...preview,
      x: Number.isFinite(event.clientX) ? event.clientX : 0,
      y: Number.isFinite(event.clientY) ? event.clientY : 0,
    } : preview);
    setDropTargetId(targetId ?? null);
  };

  const finishPointerDrag = (event?: React.PointerEvent<HTMLButtonElement>) => {
    const sourceId = draggedAgentIdRef.current;
    const targetId = event
      ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-agent-id]")?.dataset.agentId
      : null;
    if (sourceId && targetId) moveDetectedAgent(targetId, sourceId);
    draggedAgentIdRef.current = null;
    setDraggedAgentId(null);
    setDragPreview(null);
    setDropTargetId(null);
  };

  const renderAgentRow = (agent: AgentPathItem, detected: boolean) => {
    const isCustom = Boolean(customPaths[agent.id]);
    const isDisabled = detected && disabledAgentIds.includes(agent.id);
    const currentValue = inputPaths[agent.id] ?? customPaths[agent.id] ?? "";
    const effectivePath = customPaths[agent.id] || agent.defaultPath;
    const isSaving = savingAgentId === agent.id;
    const wasSaved = savedAgentId === agent.id;
    const isExpanded = expandedAgentId === agent.id && detected && !isDisabled;
    const switchAction = isDisabled
      ? (lang === "zh" ? `开启 ${agent.name}` : `Enable ${agent.name}`)
      : (lang === "zh" ? `关闭 ${agent.name}` : `Disable ${agent.name}`);
    const editAction = lang === "zh" ? `修改 ${agent.name} 目录` : `Edit ${agent.name} directory`;

    return (
      <article
        key={agent.id}
        data-agent-id={agent.id}
        className={`settings-agent-row ${!detected ? "settings-agent-row--undetected" : ""} ${isDisabled ? "settings-agent-row--disabled" : ""} ${draggedAgentId === agent.id ? "settings-agent-row--dragging" : ""} ${dropTargetId === agent.id && draggedAgentId !== agent.id ? "settings-agent-row--drop-target" : ""}`}
      >
        <div className="settings-agent-row__summary">
          {detected ? (
            <button
              type="button"
              className="settings-agent-drag-handle"
              aria-label={lang === "zh" ? `拖动 ${agent.name} 排序` : `Drag ${agent.name} to reorder`}
              title={lang === "zh" ? "拖动排序" : "Drag to reorder"}
              onPointerDown={(event) => beginPointerDrag(agent, event)}
              onPointerMove={updatePointerDrag}
              onPointerUp={(event) => finishPointerDrag(event)}
              onPointerCancel={() => finishPointerDrag()}
              onKeyDown={(event) => {
                if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                event.preventDefault();
                moveDetectedAgentByOffset(agent.id, event.key === "ArrowUp" ? -1 : 1);
              }}
            >
              <SettingsIcon name="grip" size={18} />
            </button>
          ) : <span className="settings-agent-drag-spacer" />}

          <AgentIdentityMark agentId={agent.id} size={34} />
          <div className="settings-agent-row__identity">
            <div className="settings-agent-row__title-line">
              <h3>{agent.name}</h3>
              <span className={`settings-status-badge ${isDisabled ? "settings-status-badge--disabled" : !detected ? "settings-status-badge--muted" : "settings-status-badge--success"}`}>
                {isDisabled
                  ? t("settings.performanceDiagnostics.disabled", lang)
                  : detected
                    ? t("settings.performanceDiagnostics.enabled", lang)
                    : (lang === "zh" ? "未检测" : "Not detected")}
              </span>
              {isCustom && <span className="settings-status-badge settings-status-badge--accent">{t("settings.paths.overridden", lang)}</span>}
            </div>
            <code title={effectivePath}>{effectivePath}</code>
            {agent.id === "antigravity" && detected && <small>{t("settings.paths.antigravityHint", lang)}</small>}
          </div>

          <div className="settings-agent-row__actions">
            {detected && !isDisabled && (
              <button
                type="button"
                className={`settings-icon-button ${isExpanded ? "settings-icon-button--active" : ""}`}
                aria-label={editAction}
                aria-expanded={isExpanded}
                onClick={() => setExpandedAgentId((current) => current === agent.id ? null : agent.id)}
              >
                <SettingsIcon name="edit" size={16} />
              </button>
            )}
            {detected && (
              <label className="settings-switch-control">
                <span>{isDisabled ? t("settings.performanceDiagnostics.disabled", lang) : t("settings.performanceDiagnostics.enabled", lang)}</span>
                <input
                  type="checkbox"
                  checked={!isDisabled}
                  disabled={togglingAgentId === agent.id}
                  aria-label={switchAction}
                  onChange={(event) => handleAgentToggle(agent.id, event.target.checked)}
                />
                <span className="settings-switch" aria-hidden="true" />
              </label>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="settings-agent-row__editor">
            <label className="settings-agent-path-label" htmlFor={`agent-path-${agent.id}`}>
              {agent.name} {t("settings.paths.inputLabel", lang)}
            </label>
            <div className="settings-agent-path-input-group">
              <input
                id={`agent-path-${agent.id}`}
                type="text"
                className="settings-agent-path-input"
                placeholder={`${t("settings.paths.placeholder", lang)} (${agent.defaultPath})`}
                value={currentValue}
                onChange={(event) => handleInputChange(agent.id, event.target.value)}
              />
              <button type="button" className="settings-primary-btn" onClick={() => void handleSave(agent.id)} disabled={isSaving}>
                {isSaving ? t("settings.paths.saving", lang) : wasSaved ? t("settings.paths.saved", lang) : t("settings.paths.save", lang)}
              </button>
              {isCustom && (
                <button type="button" className="settings-secondary-btn" onClick={() => void handleReset(agent.id)}>
                  {t("settings.paths.reset", lang)}
                </button>
              )}
            </div>
          </div>
        )}

        {!detected && (
          <p className="settings-agent-row__hint">{t("settings.paths.moreHint", lang)}</p>
        )}
      </article>
    );
  };

  const navigationItems: Array<{ id: SettingsSectionId; label: string; icon: SettingsIconName }> = [
    { id: "general", label: lang === "zh" ? "通用设置" : "General", icon: "general" },
    { id: "agents", label: lang === "zh" ? "Agent 管理" : "Agent management", icon: "agents" },
    { id: "diagnostics", label: t("settings.performanceDiagnostics.title", lang), icon: "diagnostics" },
    { id: "updates", label: lang === "zh" ? "更新与关于" : "Updates & about", icon: "updates" },
  ];

  return (
    <section className="page settings-page">
      <header className="settings-page-header">
        <h1 className="settings-title">{t("settings.title", lang)}</h1>
        <p className="settings-subtitle">{t("settings.subtitle", lang)}</p>
      </header>

      <div className="settings-shell">
        <nav className="settings-category-nav" aria-label={lang === "zh" ? "设置分类" : "Settings categories"}>
          {navigationItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`settings-category-nav__item ${activeSection === item.id ? "settings-category-nav__item--active" : ""}`}
              aria-current={activeSection === item.id ? "page" : undefined}
              onClick={() => setActiveSection(item.id)}
            >
              <SettingsIcon name={item.icon} />
              <span>{item.label}</span>
              <SettingsIcon name="chevron" size={14} />
            </button>
          ))}
        </nav>

        <main className="settings-content-panel" key={activeSection}>
          {activeSection === "general" && (
            <section aria-labelledby="settings-general-title">
              <div className="settings-panel-header">
                <h2 id="settings-general-title">{lang === "zh" ? "通用设置" : "General"}</h2>
                <p>{lang === "zh" ? "调整应用的显示方式与界面语言。" : "Control how the application looks and which language it uses."}</p>
              </div>
              <div className="settings-list">
                <div className="settings-row">
                  <div className="settings-row__copy">
                    <h3 id="settings-color-scheme-label">{t("settings.appearance.title", lang)}</h3>
                    <p>{t("settings.appearance.desc", lang)}</p>
                  </div>
                  <SettingsSelect
                    labelId="settings-color-scheme-label"
                    value={themeMode}
                    options={colorSchemeOptions.map((option) => ({ value: option.id, label: t(option.titleKey, lang) }))}
                    onChange={setThemeMode}
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-row__copy">
                    <h3 id="settings-theme-style-label">{t("settings.style.title", lang)}</h3>
                    <p>{t("settings.style.desc", lang)}</p>
                  </div>
                  <SettingsSelect
                    labelId="settings-theme-style-label"
                    value={themeStyle}
                    options={themeStyleOptions.map((option) => ({ value: option.id, label: t(option.titleKey, lang) }))}
                    onChange={setThemeStyle}
                  />
                </div>

                <div className="settings-row">
                  <div className="settings-row__copy">
                    <h3 id="settings-language-label">{t("settings.lang.title", lang)}</h3>
                    <p>{t("settings.lang.desc", lang)}</p>
                  </div>
                  <SettingsSelect
                    labelId="settings-language-label"
                    value={lang}
                    options={langOptions.map((option) => ({ value: option.id, label: t(option.titleKey, lang) }))}
                    onChange={setLanguage}
                  />
                </div>
              </div>
            </section>
          )}

          {activeSection === "agents" && (
            <section aria-labelledby="settings-agents-title">
              <div className="settings-panel-header settings-panel-header--actions">
                <div>
                  <h2 id="settings-agents-title">{t("settings.paths.title", lang)}</h2>
                  <p>{t("settings.paths.desc", lang)}</p>
                </div>
                {Object.keys(customPaths).length > 0 && (
                  <button type="button" className="settings-secondary-btn" onClick={() => void handleResetAll()}>
                    {t("settings.paths.resetAll", lang)}
                  </button>
                )}
              </div>

              <div className="settings-agent-group-header">
                <h3>{t("settings.paths.detected", lang)}</h3>
                <span>{detectedAgents.length}</span>
              </div>
              <div className="settings-agent-list">
                {detectedAgents.map((agent) => renderAgentRow(agent, true))}
              </div>
              {agentToggleError && <p className="settings-inline-error" role="alert">{agentToggleError}</p>}
              {pathSaveError && <p className="settings-inline-error" role="alert">{pathSaveError}</p>}

              <div className="settings-more-agents">
                <button
                  type="button"
                  className="settings-more-toggle"
                  onClick={() => setIsMoreExpanded((value) => !value)}
                  aria-expanded={isMoreExpanded}
                >
                  <span>
                    <strong>{t("settings.paths.more", lang)}</strong>
                    <small>{t("settings.paths.moreDescription", lang)}</small>
                  </span>
                  <span className="settings-more-toggle__meta">
                    {moreAgents.length}
                    <SettingsIcon name="chevron" size={15} />
                  </span>
                </button>
                {isMoreExpanded && (
                  <div className="settings-agent-list settings-agent-list--more">
                    {moreAgents.map((agent) => renderAgentRow(agent, false))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSection === "diagnostics" && (
            <section aria-labelledby="settings-diagnostics-title">
              <div className="settings-panel-header">
                <h2 id="settings-diagnostics-title">{t("settings.performanceDiagnostics.title", lang)}</h2>
                <p>{t("settings.performanceDiagnostics.description", lang)}</p>
              </div>

              <div className="settings-list">
                <div className="settings-row">
                  <div className="settings-row__copy">
                    <h3>{lang === "zh" ? "记录性能事件" : "Record performance events"}</h3>
                    <p>{t("settings.performanceDiagnostics.privacy", lang)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={diagnosticsEnabled}
                    aria-label={t("settings.performanceDiagnostics.title", lang)}
                    className="settings-switch-button"
                    onClick={() => void handleDiagnosticsToggle()}
                  >
                    <span>{diagnosticsEnabled ? t("settings.performanceDiagnostics.enabled", lang) : t("settings.performanceDiagnostics.disabled", lang)}</span>
                    <span className="settings-switch" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="settings-diagnostics-summary">
                <div>
                  <span>{lang === "zh" ? "报告数量" : "Reports"}</span>
                  <strong>{t("settings.performanceDiagnostics.reportCount", lang).replace("{count}", String(diagnosticsSummary?.reportCount ?? 0))}</strong>
                </div>
                <div>
                  <span>{t("settings.performanceDiagnostics.latestEvent", lang)}</span>
                  <strong>{diagnosticsSummary?.newestEventAtMs != null
                    ? new Date(diagnosticsSummary.newestEventAtMs).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")
                    : t("settings.performanceDiagnostics.noEvents", lang)}</strong>
                </div>
                <div>
                  <span>{lang === "zh" ? "存储位置" : "Storage"}</span>
                  <strong><code>{diagnosticsSummary?.reportDirectoryLabel ?? "~/.asm/diagnostics"}</code></strong>
                </div>
              </div>

              {diagnosticsEnabled && (
                <div className="settings-panel-actions">
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={() => void handleExportDiagnostics()}
                    disabled={!diagnosticsSummary?.reportCount || diagnosticsAction !== null}
                  >
                    {diagnosticsAction === "export" ? t("settings.performanceDiagnostics.exporting", lang) : t("settings.performanceDiagnostics.export", lang)}
                  </button>
                  <button
                    type="button"
                    className="settings-danger-btn"
                    onClick={() => setIsClearDiagnosticsDialogOpen(true)}
                    disabled={!diagnosticsSummary?.reportCount || diagnosticsAction !== null}
                  >
                    {t("settings.performanceDiagnostics.clear", lang)}
                  </button>
                </div>
              )}
              {diagnosticsError && <p className="settings-inline-error" role="alert">{t("settings.performanceDiagnostics.operationFailed", lang)}</p>}
            </section>
          )}

          {activeSection === "updates" && (
            <section aria-labelledby="settings-updates-title">
              <div className="settings-panel-header">
                <h2 id="settings-updates-title">{lang === "zh" ? "更新与关于" : "Updates & about"}</h2>
                <p>{lang === "zh" ? "查看应用版本并检查可用更新。" : "View application details and check for available updates."}</p>
              </div>
              <div className="settings-list">
                <div className="settings-row">
                  <div className="settings-row__copy">
                    <h3>{t("settings.update.title", lang)}</h3>
                    <p>{updateStatus === "upToDate" ? t("settings.update.upToDate", lang) : t("settings.update.desc", lang)}</p>
                    {updateStatus === "error" && <p className="settings-inline-error" role="alert">{t("settings.update.checkFailed", lang)}</p>}
                  </div>
                  <button
                    type="button"
                    className="settings-secondary-btn"
                    onClick={() => void checkForUpdates(false)}
                    disabled={updateStatus === "checking"}
                  >
                    {updateStatus === "checking" ? t("settings.update.checking", lang) : t("settings.update.check", lang)}
                  </button>
                </div>
                <div className="settings-row settings-row--about">
                  <div className="settings-about-mark" aria-hidden="true">ASM</div>
                  <div className="settings-row__copy">
                    <h3>Agent Skill Manager</h3>
                    <p>{lang === "zh" ? "集中管理主技能仓库与 Agent 分发关系。" : "Centralized management for master skills and Agent distribution."}</p>
                  </div>
                  <span className="settings-version">v{appPackage.version}</span>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {pendingDisableAgentId && (
        <div className="modal-overlay" role="presentation">
          <div className="delete-confirm-card settings-disable-dialog" role="dialog" aria-modal="true" aria-labelledby="disable-agent-title">
            <div className="delete-confirm-header">
              <div>
                <h3 id="disable-agent-title">{lang === "zh" ? "关闭 Agent" : "Disable Agent"}</h3>
                <p>{knownAgents.find((agent) => agent.id === pendingDisableAgentId)?.name}</p>
              </div>
            </div>
            <div className="delete-confirm-body">
              <p>{lang === "zh" ? "关闭后将删除此 Agent 下所有由 ASM 管理的 Skills 软链接。" : "All ASM-managed skill symlinks for this Agent will be removed."}</p>
              <p className="delete-confirm-warning">{lang === "zh" ? "重新开启不会自动恢复这些链接。" : "Re-enabling will not restore these links."}</p>
            </div>
            <div className="delete-confirm-footer">
              <button type="button" className="btn secondary" onClick={() => setPendingDisableAgentId(null)} disabled={togglingAgentId !== null}>{lang === "zh" ? "取消" : "Cancel"}</button>
              <button type="button" className="btn danger" onClick={() => void confirmDisableAgent()} disabled={togglingAgentId !== null}>
                {togglingAgentId !== null ? (lang === "zh" ? "正在关闭…" : "Disabling…") : (lang === "zh" ? "确认关闭" : "Disable")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isClearDiagnosticsDialogOpen && (
        <div className="modal-overlay" role="presentation">
          <div className="delete-confirm-card settings-disable-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-diagnostics-title">
            <div className="delete-confirm-header"><div><h3 id="clear-diagnostics-title">{t("settings.performanceDiagnostics.clear", lang)}</h3></div></div>
            <div className="delete-confirm-body"><p>{t("settings.performanceDiagnostics.clearConfirmation", lang)}</p></div>
            <div className="delete-confirm-footer">
              <button type="button" className="btn secondary" onClick={() => setIsClearDiagnosticsDialogOpen(false)} disabled={diagnosticsAction === "clear"}>{t("settings.performanceDiagnostics.cancel", lang)}</button>
              <button type="button" className="btn danger" onClick={() => void confirmClearDiagnostics()} disabled={diagnosticsAction === "clear"}>{diagnosticsAction === "clear" ? t("settings.performanceDiagnostics.clearing", lang) : t("settings.performanceDiagnostics.clear", lang)}</button>
            </div>
          </div>
        </div>
      )}

      {dragPreview && (
        <div className="settings-agent-drag-preview" style={{ left: dragPreview.x + 14, top: dragPreview.y + 14 }} aria-hidden="true">
          <span className="settings-agent-drag-preview__handle"><SettingsIcon name="grip" size={18} /></span>
          <AgentIdentityMark agentId={dragPreview.id} size={28} />
          <strong>{dragPreview.name}</strong>
          <small>{lang === "zh" ? "松手以放置" : "Release to place"}</small>
        </div>
      )}
    </section>
  );
}
