import type { ScanReport } from "../ipc/types";
import { useScanStore } from "../stores/scanStore";

type MatrixState = "missing" | "present" | "conflict" | "unknown";

function groupSkills(report: ScanReport) {
  const groups = new Map<string, {
    description: string; agents: Set<string>; installations: number; fingerprints: Set<string>;
  }>();
  for (const agent of report.agents) {
    for (const skill of agent.skills) {
      const group = groups.get(skill.name) ?? {
        description: skill.description, agents: new Set<string>(), installations: 0, fingerprints: new Set<string>(),
      };
      group.agents.add(agent.agent_id);
      group.installations += 1;
      if (skill.fingerprint_short) group.fingerprints.add(skill.fingerprint_short);
      if (!group.description && skill.description) group.description = skill.description;
      groups.set(skill.name, group);
    }
  }
  return [...groups.entries()].map(([name, group]) => ({ name, ...group }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function matrixFor(report: ScanReport) {
  return groupSkills(report).map((skill) => ({
    name: skill.name,
    cells: report.agents.map((agent) => {
      const matches = agent.skills.filter((candidate) => candidate.name === skill.name);
      const fingerprints = new Set(matches.map((candidate) => candidate.fingerprint_short).filter(Boolean));
      const state: MatrixState = matches.length === 0 ? "missing" : fingerprints.size === 0 ? "unknown"
        : fingerprints.size === 1 ? "present" : "conflict";
      return { agentId: agent.agent_id, state };
    }),
  }));
}

const SYMBOLS = { missing: "—", present: "✓", conflict: "!", unknown: "?" } as const;

export default function AgentMatrix() {
  const { report, scanning } = useScanStore();

  if (scanning && report === null) {
    return <section className="page"><h1>Agent Matrix</h1><p className="empty-hint">Scanning...</p></section>;
  }

  if (report === null) {
    return <section className="page"><h1>Agent Matrix</h1><p className="empty-hint">Run scan to discover agents.</p></section>;
  }

  const matrix = matrixFor(report);

  return (
    <section className="page">
      <h1>Agent Matrix</h1>
      {report.agents.length === 0 ? (
        <p className="empty-hint">No agents discovered.</p>
      ) : matrix.length === 0 ? (
        <p className="empty-hint">No skills discovered.</p>
      ) : (
        <table className="matrix-table">
          <thead>
            <tr>
              <th>Skill</th>
              {report.agents.map((agent) => <th key={agent.agent_id}>{agent.display_name}</th>)}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                {row.cells.map((cell) => (
                  <td key={cell.agentId} className={`matrix-cell ${cell.state}`} aria-label={`${row.name} for ${cell.agentId}: ${cell.state}`}>
                    {SYMBOLS[cell.state]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
