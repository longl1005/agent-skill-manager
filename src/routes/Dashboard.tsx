import { useState } from "react";
import { scanAgents } from "../ipc/commands";
import type { ScanReport, IssueReport } from "../ipc/types";

function formatTime(unixMillis: number): string {
  if (unixMillis === 0) return "—";
  const d = new Date(unixMillis);
  return d.toLocaleTimeString();
}

function shortenPath(p: string, home: string): string {
  if (home && p.startsWith(home)) {
    return "~" + p.slice(home.length);
  }
  return p;
}

const SEVERITY_RANK: Record<string, number> = {
  Error: 0,
  Warning: 1,
  Info: 2,
};

function sortedIssues(issues: IssueReport[]): IssueReport[] {
  return [...issues].sort(
    (a, b) => (SEVERITY_RANK[a.severity] ?? 3) - (SEVERITY_RANK[b.severity] ?? 3),
  );
}

export default function Dashboard() {
  const [report, setReport] = useState<ScanReport | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onScan = async () => {
    setScanning(true);
    setError(null);
    try {
      const r = await scanAgents();
      setReport(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
    }
  };

  const homeFromAgent = (r: ScanReport | null): string => {
    // 尝试从 agent roots 推断 home: 找以 /Users/<name>/.claude/skills 结尾的路径
    if (!r) return "";
    for (const a of r.agents) {
      for (const root of a.roots) {
        const m = root.display_path.match(/^(.*?)\/\.claude\/skills$/);
        if (m) return m[1];
      }
    }
    return "";
  };

  const home = homeFromAgent(report);
  const totalMs =
    report ? report.completed_at - report.started_at : 0;

  return (
    <section className="page">
      <h1>Dashboard</h1>

      <div className="scan-status">
        {report ? (
          <>
            <span>
              <strong>{report.total_skills}</strong> skills
            </span>
            <span>·</span>
            <span>
              <strong>{report.agents.length}</strong> agent
            </span>
            <span>·</span>
            <span>scanned <strong>{formatTime(report.started_at)}</strong> ({totalMs}ms)</span>
          </>
        ) : (
          <span>No scan yet.</span>
        )}
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
        <button
          className="btn primary"
          onClick={onScan}
          disabled={scanning}
        >
          {scanning ? "Scanning..." : "Scan now"}
        </button>
        {report && (
          <span style={{ color: "var(--muted)", fontSize: 12 }}>
            Last scan: {formatTime(report.completed_at)}
          </span>
        )}
      </div>

      {error && <div className="scan-error">{error}</div>}

      {scanning && !report && (
        <p className="empty-hint" style={{ marginTop: 16 }}>Scanning...</p>
      )}

      {!scanning && !report && (
        <p className="empty-hint">Run scan to discover agents.</p>
      )}

      {report && report.agents.map((agent) => (
        <div key={agent.agent_id} style={{ marginTop: 16 }}>
          <div className="agent-header">
            <strong>{agent.display_name}</strong>
            <span className="muted">
              {agent.detection_status} · {agent.outcome}
            </span>
          </div>

          {agent.skills.length > 0 && (
            <table className="skills-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Path</th>
                  <th>Files</th>
                  <th>FP</th>
                </tr>
              </thead>
              <tbody>
                {agent.skills.map((s) => (
                  <tr key={s.location + s.name}>
                    <td>{s.name}</td>
                    <td className="desc">{s.description || <em className="muted">(no description)</em>}</td>
                    <td className="path">{shortenPath(s.location, home)}</td>
                    <td className="num">{s.file_count}</td>
                    <td className="fp">{s.fingerprint_short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {agent.issues.length > 0 && (
            <div className="issues-section">
              <h2>Issues</h2>
              {sortedIssues(agent.issues).map((i, idx) => (
                <div key={idx} className="issue-row">
                  <span className={`severity ${i.severity.toLowerCase()}`}>
                    {i.severity}
                  </span>
                  <span className="code">{i.code}</span>
                  {i.path && <span className="path">{shortenPath(i.path, home)}</span>}
                  <span className="msg">{i.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </section>
  );
}