import type { ScanReport } from "../ipc/types";
import { useScanStore } from "../stores/scanStore";

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

function statusFor(fingerprints: Set<string>) {
  if (fingerprints.size === 0) return "Unknown";
  return fingerprints.size === 1 ? "Consistent" : "Conflict";
}

export default function Library() {
  const { report, scanning } = useScanStore();

  if (scanning && report === null) {
    return <section className="page"><h1>Library</h1><p className="empty-hint">Scanning...</p></section>;
  }

  if (report === null) {
    return <section className="page"><h1>Library</h1><p className="empty-hint">Run scan to discover agents.</p></section>;
  }

  const skills = groupSkills(report);

  return (
    <section className="page">
      <h1>Library</h1>
      {skills.length === 0 ? (
        <p className="empty-hint">No skills discovered.</p>
      ) : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Agents</th>
              <th>Installations</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {skills.map((skill) => {
              const status = statusFor(skill.fingerprints);
              return (
                <tr key={skill.name}>
                  <td>{skill.name}</td>
                  <td className="description">{skill.description || <em className="muted">(no description)</em>}</td>
                  <td className="number">{skill.agents.size}</td>
                  <td className="number">{skill.installations}</td>
                  <td><span className={`status-badge ${status.toLowerCase()}`}>{status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
