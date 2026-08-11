import { useRef, useState } from "react";
import { AgentIdentityMark } from "../components/AgentVisual";
import { orderAgents, useAgentConfigStore } from "../stores/agentConfigStore";
import { useI18nStore } from "../stores/i18nStore";
import { useScanStore } from "../stores/scanStore";
import { isDiscoveredAgent } from "../agentDiscovery";
import { useThemeStore, type ThemeMode } from "../stores/themeStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useUpdateStore } from "../stores/updateStore";
import { migrateAgentSkillsDir, resetAgentSkillsDir } from "../ipc/commands";
import { usePerformanceDiagnosticsStore } from "../stores/performanceDiagnosticsStore";
import { t, type Language, type TranslationKey } from "../locales/dict";
import { save } from "@tauri-apps/plugin-dialog";

interface ThemeOption {
  id: ThemeMode;
  titleKey: TranslationKey;
  icon: string;
}

const themeOptions: ThemeOption[] = [
  {
    id: "light",
    titleKey: "settings.theme.light",
    icon: "☀️",
  },
  {
    id: "dark",
    titleKey: "settings.theme.dark",
    icon: "🌙",
  },
  {
    id: "system",
    titleKey: "settings.theme.system",
    icon: "💻",
  },
];

interface LangOption {
  id: Language;
  titleKey: TranslationKey;
  icon: string;
}

const langOptions: LangOption[] = [
  {
    id: "zh",
    titleKey: "settings.lang.zh",
    icon: "🇨🇳",
  },
  {
    id: "en",
    titleKey: "settings.lang.en",
    icon: "🇺🇸",
  },
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
  { id: "antigravity", name: "Antigravity", defaultPath: "~/.gemini/antigravity/skills" },
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
  const { themeMode, setThemeMode } = useThemeStore();
  const { lang, setLanguage } = useI18nStore();
  const { customPaths, setCustomPath, clearCustomPath, resetAll, disabledAgentIds, setAgentDisabled, agentOrder, setAgentOrder } = useAgentConfigStore();
  const unlinkAllAgentSkills = useMasterRepoStore((state) => state.unlinkAllAgentSkills);
  const scan = useScanStore((state) => state.scan);
  const report = useScanStore((state) => state.report);
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates);
  const updateStatus = useUpdateStore((state) => state.status);
  const diagnosticsEnabled = usePerformanceDiagnosticsStore((state) => state.enabled);
  const diagnosticsSummary = usePerformanceDiagnosticsStore((state) => state.summary);
  const setDiagnosticsEnabled = usePerformanceDiagnosticsStore((state) => state.setEnabled);
  const exportDiagnosticsReport = usePerformanceDiagnosticsStore((state) => state.exportReport);
  const clearDiagnosticsReports = usePerformanceDiagnosticsStore((state) => state.clearReports);

  // Local state for path inputs
  const [inputPaths, setInputPaths] = useState<Record<string, string>>(() => ({
    ...customPaths,
  }));
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

  const handleInputChange = (agentId: string, val: string) => {
    setInputPaths((prev) => ({ ...prev, [agentId]: val }));
  };

  const handleSave = async (agentId: string) => {
    setSavingAgentId(agentId);
    setSavedAgentId(null);
    setPathSaveError(null);
    const val = inputPaths[agentId]?.trim();
    try {
      if (val) {
        await migrateAgentSkillsDir(agentId, customPaths[agentId] ?? null, val, customPaths);
        setCustomPath(agentId, val);
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
    try { await resetAgentSkillsDir(agentId, customPaths[agentId] ?? null, customPaths); clearCustomPath(agentId); }
    catch (error) { setPathSaveError(lang === "zh" ? `目录迁移失败：${String(error)}` : `Directory migration failed: ${String(error)}`); return; }
    setInputPaths((prev) => {
      const next = { ...prev };
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

  const handleAgentToggle = async (agentId: string, enabled: boolean) => {
    if (enabled) { setAgentDisabled(agentId, false); return; }
    setPendingDisableAgentId(agentId);
  };

  const confirmDisableAgent = async () => {
    if (!pendingDisableAgentId) return;
    const agentId = pendingDisableAgentId;
    setTogglingAgentId(agentId); setAgentToggleError(null);
    const removed = await unlinkAllAgentSkills(agentId);
    if (removed === null) setAgentToggleError(lang === "zh" ? "关闭失败，请重试。" : "Unable to disable the Agent. Try again.");
    else setAgentDisabled(agentId, true);
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

  const beginPointerDrag = (agent: AgentPathItem, event: React.PointerEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    draggedAgentIdRef.current = agent.id;
    setDraggedAgentId(agent.id);
    setDragPreview({ id: agent.id, name: agent.name, x: Number.isFinite(event.clientX) ? event.clientX : 0, y: Number.isFinite(event.clientY) ? event.clientY : 0 });
  };

  const updatePointerDrag = (event: React.PointerEvent<HTMLSpanElement>) => {
    const sourceId = draggedAgentIdRef.current;
    if (!sourceId) return;
    const targetId = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-agent-id]")?.dataset.agentId;
    setDragPreview((preview) => preview ? { ...preview, x: Number.isFinite(event.clientX) ? event.clientX : 0, y: Number.isFinite(event.clientY) ? event.clientY : 0 } : preview);
    setDropTargetId(targetId ?? null);
  };

  const finishPointerDrag = (event?: React.PointerEvent<HTMLSpanElement>) => {
    const sourceId = draggedAgentIdRef.current;
    const targetId = event ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-agent-id]")?.dataset.agentId : null;
    if (sourceId && targetId) moveDetectedAgent(targetId, sourceId);
    draggedAgentIdRef.current = null;
    setDraggedAgentId(null);
    setDragPreview(null);
    setDropTargetId(null);
  };

  const renderAgentCard = (agent: AgentPathItem, detected: boolean) => {
    const isCustom = Boolean(customPaths[agent.id]);
    const isDisabled = disabledAgentIds.includes(agent.id);
    const isDetectedAndDisabled = detected && isDisabled;
    const currentVal = inputPaths[agent.id] ?? customPaths[agent.id] ?? "";
    const isConfigurable = detected;
    const isSaving = savingAgentId === agent.id;
    const wasSaved = savedAgentId === agent.id;

    return (
      <article key={agent.id} data-agent-id={agent.id} className={`settings-agent-path-card ${detected ? "" : "settings-agent-path-card--more"} ${isDetectedAndDisabled ? "settings-agent-path-card--disabled" : ""} ${draggedAgentId === agent.id ? "settings-agent-path-card--dragging" : ""} ${dropTargetId === agent.id && draggedAgentId !== agent.id ? "settings-agent-path-card--drop-target" : ""}`}>
        <div className="settings-agent-path-card__header">
          <div className="settings-agent-path-card__identity">
            {detected && <span className="settings-agent-drag-handle" onPointerDown={(event) => beginPointerDrag(agent, event)} onPointerMove={updatePointerDrag} onPointerUp={(event) => finishPointerDrag(event)} onPointerCancel={() => finishPointerDrag()} title={lang === "zh" ? "拖动排序" : "Drag to reorder"}>⠿</span>}
            <AgentIdentityMark agentId={agent.id} />
            <div>
              <h3 className="settings-agent-path-card__name">{agent.name}</h3>
              <span className="settings-agent-path-card__default-badge">
                {t("settings.paths.default", lang)}: <code>{agent.defaultPath}</code>
              </span>
            </div>
          </div>
          {isCustom && <span className="settings-agent-path-card__custom-badge">{t("settings.paths.overridden", lang)}</span>}
          {detected && <label className="agent-management-switch"><input type="checkbox" checked={!isDisabled} disabled={togglingAgentId === agent.id} onChange={(event) => void handleAgentToggle(agent.id, event.target.checked)} /><span aria-hidden="true" /></label>}
        </div>

        {isConfigurable && !isDetectedAndDisabled ? (
          <div className="settings-agent-path-card__body">
            <label className="settings-agent-path-label" htmlFor={`agent-path-${agent.id}`}>
              {t("settings.paths.inputLabel", lang)}
            </label>
            <div className="settings-agent-path-input-group">
              <input
                id={`agent-path-${agent.id}`}
                type="text"
                className="settings-agent-path-input"
                placeholder={`${t("settings.paths.placeholder", lang)} (${agent.defaultPath})`}
                value={currentVal}
                onChange={(event) => handleInputChange(agent.id, event.target.value)}
              />
              <button type="button" className="settings-agent-path-save-btn" onClick={() => handleSave(agent.id)} disabled={isSaving}>
                {isSaving ? t("settings.paths.saving", lang) : wasSaved ? t("settings.paths.saved", lang) : t("settings.paths.save", lang)}
              </button>
              {isCustom && (
                <button type="button" className="settings-agent-path-reset-btn" onClick={() => handleReset(agent.id)}>
                  {t("settings.paths.reset", lang)}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="settings-agent-path-card__empty">
            <p>{isDetectedAndDisabled ? (lang === "zh" ? "已关闭，重新开启后不会自动恢复 Skills 链接。" : "Disabled. Re-enabling does not restore skill links.") : t("settings.paths.moreHint", lang)}</p>
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="page settings-page">
      <div className="settings-header-card">
        <div>
          <h1 className="settings-title">{t("settings.title", lang)}</h1>
          <p className="settings-subtitle">{t("settings.subtitle", lang)}</p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-preferences-grid">
          <div className="settings-preference-block">
            <div className="settings-section__header">
              <h2 className="settings-section__title">{t("settings.appearance.title", lang)}</h2>
              <p className="settings-section__desc">{t("settings.appearance.desc", lang)}</p>
            </div>
            <div className="settings-option-list" role="radiogroup" aria-label={t("settings.appearance.title", lang)}>
              {themeOptions.map((opt) => {
                const isActive = themeMode === opt.id;
                return <button key={opt.id} type="button" role="radio" aria-checked={isActive} className={`settings-option ${isActive ? "settings-option--active" : ""}`} onClick={() => setThemeMode(opt.id)}><span className="settings-option__icon">{opt.icon}</span><span className="settings-option__copy"><strong>{t(opt.titleKey, lang)}</strong></span>{isActive && <span className="settings-option__check" aria-label={t("settings.active", lang)}>✓</span>}</button>;
              })}
            </div>
          </div>
          <div className="settings-preference-block">
            <div className="settings-section__header">
              <h2 className="settings-section__title">{t("settings.lang.title", lang)}</h2>
              <p className="settings-section__desc">{t("settings.lang.desc", lang)}</p>
            </div>
            <div className="settings-option-list settings-option-list--language" role="radiogroup" aria-label={t("settings.lang.title", lang)}>
              {langOptions.map((opt) => {
                const isActive = lang === opt.id;
                return <button key={opt.id} type="button" role="radio" aria-checked={isActive} className={`settings-option ${isActive ? "settings-option--active" : ""}`} onClick={() => setLanguage(opt.id)}><span className="settings-option__icon">{opt.icon}</span><span className="settings-option__copy"><strong>{t(opt.titleKey, lang)}</strong></span>{isActive && <span className="settings-option__check" aria-label={t("settings.active", lang)}>✓</span>}</button>;
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section" style={{ marginTop: 32 }}>
        <div className="settings-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="settings-section__title">{t("settings.update.title", lang)}</h2>
            <p className="settings-section__desc">{t("settings.update.desc", lang)}</p>
          </div>
          <button type="button" className="settings-reset-all-btn" onClick={() => void checkForUpdates(false)} disabled={updateStatus === "checking"}>
            {updateStatus === "checking" ? t("settings.update.checking", lang) : t("settings.update.check", lang)}
          </button>
        </div>
        {updateStatus === "upToDate" && <p className="settings-section__desc">{t("settings.update.upToDate", lang)}</p>}
        {updateStatus === "error" && <p className="settings-agent-toggle-error" role="alert">{t("settings.update.checkFailed", lang)}</p>}
      </div>

      <div className="settings-section" style={{ marginTop: 32 }}>
        <div className="settings-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="settings-section__title">{t("settings.performanceDiagnostics.title", lang)}</h2>
            <p className="settings-section__desc">{t("settings.performanceDiagnostics.description", lang)}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={diagnosticsEnabled}
            aria-label={t("settings.performanceDiagnostics.title", lang)}
            className="settings-reset-all-btn"
            onClick={() => void handleDiagnosticsToggle()}
          >
            {diagnosticsEnabled ? t("settings.performanceDiagnostics.enabled", lang) : t("settings.performanceDiagnostics.disabled", lang)}
          </button>
        </div>
        <p className="settings-section__desc">{t("settings.performanceDiagnostics.privacy", lang)}</p>
        <p className="settings-section__desc">{diagnosticsSummary?.report_directory_label ?? "~/.asm/diagnostics"}</p>
        <p className="settings-section__desc">{t("settings.performanceDiagnostics.reportCount", lang).replace("{count}", String(diagnosticsSummary?.report_count ?? 0))}</p>
        <p className="settings-section__desc">
          {t("settings.performanceDiagnostics.latestEvent", lang)}: {diagnosticsSummary?.newest_event_at_ms != null
            ? new Date(diagnosticsSummary.newest_event_at_ms).toLocaleString(lang === "zh" ? "zh-CN" : "en-US")
            : t("settings.performanceDiagnostics.noEvents", lang)}
        </p>
        {diagnosticsEnabled && (
          <div className="settings-section__header" style={{ display: "flex", gap: 12, marginTop: 16 }}>
            <button
              type="button"
              className="settings-reset-all-btn"
              onClick={() => void handleExportDiagnostics()}
              disabled={!diagnosticsSummary?.report_count || diagnosticsAction !== null}
            >
              {diagnosticsAction === "export" ? t("settings.performanceDiagnostics.exporting", lang) : t("settings.performanceDiagnostics.export", lang)}
            </button>
            <button
              type="button"
              className="settings-reset-all-btn"
              onClick={() => setIsClearDiagnosticsDialogOpen(true)}
              disabled={!diagnosticsSummary?.report_count || diagnosticsAction !== null}
            >
              {t("settings.performanceDiagnostics.clear", lang)}
            </button>
          </div>
        )}
        {diagnosticsError && <p className="settings-agent-toggle-error" role="alert">{t("settings.performanceDiagnostics.operationFailed", lang)}</p>}
      </div>

      <div className="settings-section" style={{ marginTop: 32 }}>
        <div className="settings-section__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 className="settings-section__title">{t("settings.paths.title", lang)}</h2>
            <p className="settings-section__desc">{t("settings.paths.desc", lang)}</p>
          </div>
          {Object.keys(customPaths).length > 0 && (
            <button type="button" className="settings-reset-all-btn" onClick={handleResetAll}>
              {t("settings.paths.resetAll", lang)}
            </button>
          )}
        </div>

        <h3 className="settings-agent-group-title">{t("settings.paths.detected", lang)} <span>{detectedAgents.length}</span></h3>
        <div className="settings-agent-paths-grid">
          {detectedAgents.map((agent) => renderAgentCard(agent, true))}
        </div>
        {agentToggleError && <p className="settings-agent-toggle-error" role="alert">{agentToggleError}</p>}
        {pathSaveError && <p className="settings-agent-toggle-error" role="alert">{pathSaveError}</p>}
        <div className="settings-more-agents">
          <button type="button" className="settings-more-toggle" onClick={() => setIsMoreExpanded((value) => !value)} aria-expanded={isMoreExpanded}>
            <span><strong>{t("settings.paths.more", lang)}</strong><small>{t("settings.paths.moreDescription", lang)}</small></span>
            <span className="settings-more-toggle__meta">{moreAgents.length} <span aria-hidden="true">{isMoreExpanded ? "⌃" : "⌄"}</span></span>
          </button>
          {isMoreExpanded && <div className="settings-agent-paths-grid settings-agent-paths-grid--more">{moreAgents.map((agent) => renderAgentCard(agent, false))}</div>}
        </div>
      </div>
      {pendingDisableAgentId && (
        <div className="modal-overlay" role="presentation">
          <div className="delete-confirm-card settings-disable-dialog" role="dialog" aria-modal="true" aria-labelledby="disable-agent-title">
            <div className="delete-confirm-header"><div><h3 id="disable-agent-title">{lang === "zh" ? "关闭 Agent" : "Disable Agent"}</h3><p>{knownAgents.find((agent) => agent.id === pendingDisableAgentId)?.name}</p></div></div>
            <div className="delete-confirm-body"><p>{lang === "zh" ? "关闭后将删除此 Agent 下所有由 ASM 管理的 Skills 软链接。" : "All ASM-managed skill symlinks for this Agent will be removed."}</p><p className="delete-confirm-warning">{lang === "zh" ? "重新开启不会自动恢复这些链接。" : "Re-enabling will not restore these links."}</p></div>
            <div className="delete-confirm-footer"><button type="button" className="btn secondary" onClick={() => setPendingDisableAgentId(null)}>{lang === "zh" ? "取消" : "Cancel"}</button><button type="button" className="btn danger" onClick={() => void confirmDisableAgent()}>{lang === "zh" ? "确认关闭" : "Disable"}</button></div>
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
          <span className="settings-agent-drag-preview__handle">⠿</span><AgentIdentityMark agentId={dragPreview.id} size={28} /><strong>{dragPreview.name}</strong><small>{lang === "zh" ? "松手以放置" : "Release to place"}</small>
        </div>
      )}
    </section>
  );
}
