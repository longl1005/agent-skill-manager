import AgentCard from "../components/AgentCard";
import { isDiscoveredAgent } from "../agentDiscovery";
import { useScanStore } from "../stores/scanStore";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";

function DirectorySkeleton() {
  return <div aria-hidden="true" className="agent-card agent-directory-card agent-directory-skeleton" data-testid="agent-directory-skeleton" />;
}

export default function Agents() {
  const { report, scanning, error, scan } = useScanStore();
  const lang = useI18nStore((state) => state.lang);

  if (scanning && report === null) {
    return (
      <section aria-busy="true" aria-label="Loading agents" className="page agent-directory" role="region">
        <div className="agent-cards agent-directory-grid">
          <DirectorySkeleton />
          <DirectorySkeleton />
          <DirectorySkeleton />
        </div>
      </section>
    );
  }

  if (error && report === null) {
    return (
      <section className="page agent-directory agent-scan-recovery">
        <div className="agent-scan-error" role="alert">
          <h1>Unable to scan agents</h1>
          <p>The agent scan did not complete. Try scanning again to load the available skill workspaces.</p>
          <p className="agent-scan-error__detail">{error}</p>
        </div>
        <button className="agent-scan-recovery-button" disabled={scanning} onClick={() => void scan()} type="button">
          Rescan agents
        </button>
      </section>
    );
  }

  const detectedAgents = report?.agents.filter(isDiscoveredAgent) ?? [];

  return (
    <section className="page agent-directory">
      <header className="agent-directory-header">
        <h1>{t("agents.title", lang)}</h1>
        <p>{t("agents.detectedCount", lang).replace("{count}", String(detectedAgents.length))}</p>
        <p className="empty-hint">{t("agents.subtitle", lang)}</p>
      </header>

      {error && (
        <div className="agent-scan-error" role="alert">
          <p><strong>Latest scan failed.</strong> Showing the last available results.</p>
          <p className="agent-scan-error__detail">{error}</p>
          <button className="agent-scan-recovery-button" disabled={scanning} onClick={() => void scan()} type="button">
            Rescan agents
          </button>
        </div>
      )}

      {detectedAgents.length > 0 ? (
        <div className="agent-cards agent-directory-grid">
          {detectedAgents.map((agent) => <AgentCard agent={agent} key={agent.agent_id} />)}
        </div>
      ) : (
        <div className="agents-empty-panel">
          <h2>{t("agents.emptyTitle", lang)}</h2>
          <p>{t("agents.emptyDesc", lang)}</p>
        </div>
      )}
    </section>
  );
}
