import { useState } from "react";
import { AgentIdentityMark } from "../components/AgentVisual";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { useI18nStore } from "../stores/i18nStore";
import { useScanStore } from "../stores/scanStore";
import { useThemeStore, type ThemeMode } from "../stores/themeStore";
import { t, type Language, type TranslationKey } from "../locales/dict";

interface ThemeOption {
  id: ThemeMode;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: string;
}

const themeOptions: ThemeOption[] = [
  {
    id: "light",
    titleKey: "settings.theme.light",
    descKey: "settings.theme.lightDesc",
    icon: "☀️",
  },
  {
    id: "dark",
    titleKey: "settings.theme.dark",
    descKey: "settings.theme.darkDesc",
    icon: "🌙",
  },
  {
    id: "system",
    titleKey: "settings.theme.system",
    descKey: "settings.theme.systemDesc",
    icon: "💻",
  },
];

interface LangOption {
  id: Language;
  titleKey: TranslationKey;
  descKey: TranslationKey;
  icon: string;
}

const langOptions: LangOption[] = [
  {
    id: "zh",
    titleKey: "settings.lang.zh",
    descKey: "settings.lang.zhDesc",
    icon: "🇨🇳",
  },
  {
    id: "en",
    titleKey: "settings.lang.en",
    descKey: "settings.lang.enDesc",
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
  { id: "codex", name: "Codex", defaultPath: "~/.codex/skills" },
  { id: "antigravity", name: "Antigravity", defaultPath: "~/.gemini/antigravity/skills" },
  { id: "pi-agent", name: "Pi Agent", defaultPath: "~/.pi/agent/skills" },
  { id: "oh-my-pi", name: "Oh My Pi (OPM)", defaultPath: "~/.omp/agent/skills" },
  { id: "opencode", name: "Open Code", defaultPath: "~/.config/opencode/skills" },
  { id: "cursor", name: "Cursor", defaultPath: "~/.cursor/skills" },
];

export default function Settings() {
  const { themeMode, setThemeMode } = useThemeStore();
  const { lang, setLanguage } = useI18nStore();
  const { customPaths, setCustomPath, clearCustomPath, resetAll } = useAgentConfigStore();
  const scan = useScanStore((state) => state.scan);

  // Local state for path inputs
  const [inputPaths, setInputPaths] = useState<Record<string, string>>(() => ({
    ...customPaths,
  }));

  const handleInputChange = (agentId: string, val: string) => {
    setInputPaths((prev) => ({ ...prev, [agentId]: val }));
  };

  const handleSave = async (agentId: string) => {
    const val = inputPaths[agentId]?.trim();
    if (val) {
      setCustomPath(agentId, val);
    } else {
      clearCustomPath(agentId);
    }
    await scan();
  };

  const handleReset = async (agentId: string) => {
    clearCustomPath(agentId);
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

  return (
    <section className="page settings-page">
      <div className="settings-header-card">
        <div className="settings-header-icon">⚙️</div>
        <div>
          <h1 className="settings-title">{t("settings.title", lang)}</h1>
          <p className="settings-subtitle">{t("settings.subtitle", lang)}</p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section__header">
          <h2 className="settings-section__title">{t("settings.appearance.title", lang)}</h2>
          <p className="settings-section__desc">{t("settings.appearance.desc", lang)}</p>
        </div>

        <div className="settings-theme-grid">
          {themeOptions.map((opt) => {
            const isActive = themeMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`settings-theme-card ${isActive ? "settings-theme-card--active" : ""}`}
                onClick={() => setThemeMode(opt.id)}
              >
                <div className="settings-theme-card__header">
                  <span className="settings-theme-card__icon">{opt.icon}</span>
                  {isActive && <span className="settings-theme-card__badge">{t("settings.active", lang)}</span>}
                </div>
                <div className="settings-theme-card__body">
                  <h3 className="settings-theme-card__title">{t(opt.titleKey, lang)}</h3>
                  <p className="settings-theme-card__desc">{t(opt.descKey, lang)}</p>
                </div>
                <div className={`settings-theme-preview settings-theme-preview--${opt.id}`}>
                  <div className="settings-theme-preview__sidebar" />
                  <div className="settings-theme-preview__content">
                    <div className="settings-theme-preview__bar" />
                    <div className="settings-theme-preview__card" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-section" style={{ marginTop: 32 }}>
        <div className="settings-section__header">
          <h2 className="settings-section__title">{t("settings.lang.title", lang)}</h2>
          <p className="settings-section__desc">{t("settings.lang.desc", lang)}</p>
        </div>

        <div className="settings-theme-grid">
          {langOptions.map((opt) => {
            const isActive = lang === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                className={`settings-theme-card ${isActive ? "settings-theme-card--active" : ""}`}
                onClick={() => setLanguage(opt.id)}
              >
                <div className="settings-theme-card__header">
                  <span className="settings-theme-card__icon">{opt.icon}</span>
                  {isActive && <span className="settings-theme-card__badge">{t("settings.active", lang)}</span>}
                </div>
                <div className="settings-theme-card__body">
                  <h3 className="settings-theme-card__title">{t(opt.titleKey, lang)}</h3>
                  <p className="settings-theme-card__desc">{t(opt.descKey, lang)}</p>
                </div>
              </button>
            );
          })}
        </div>
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

        <div className="settings-agent-paths-grid">
          {knownAgents.map((agent) => {
            const isCustom = Boolean(customPaths[agent.id]);
            const currentVal = inputPaths[agent.id] ?? customPaths[agent.id] ?? "";

            return (
              <div key={agent.id} className="settings-agent-path-card">
                <div className="settings-agent-path-card__header">
                  <div className="settings-agent-path-card__identity">
                    <AgentIdentityMark agentId={agent.id} />
                    <div>
                      <h3 className="settings-agent-path-card__name">{agent.name}</h3>
                      <span className="settings-agent-path-card__default-badge">
                        {t("settings.paths.default", lang)}: <code>{agent.defaultPath}</code>
                      </span>
                    </div>
                  </div>
                  {isCustom && <span className="settings-agent-path-card__custom-badge">{t("settings.paths.overridden", lang)}</span>}
                </div>

                <div className="settings-agent-path-card__body">
                  <div className="settings-agent-path-input-group">
                    <input
                      type="text"
                      className="settings-agent-path-input"
                      placeholder={`${t("settings.paths.placeholder", lang)} (${agent.defaultPath})`}
                      value={currentVal}
                      onChange={(e) => handleInputChange(agent.id, e.target.value)}
                    />
                    <button
                      type="button"
                      className="settings-agent-path-save-btn"
                      onClick={() => handleSave(agent.id)}
                    >
                      {t("settings.paths.save", lang)}
                    </button>
                    {isCustom && (
                      <button
                        type="button"
                        className="settings-agent-path-reset-btn"
                        onClick={() => handleReset(agent.id)}
                      >
                        {t("settings.paths.reset", lang)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
