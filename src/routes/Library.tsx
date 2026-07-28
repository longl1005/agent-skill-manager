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
  const { report } = useScanStore();
  const skills = report ? groupSkills(report) : [];

  return (
    <section className="page skill-library">
      <div className="page-header">
        <h1>All Skills</h1>
        <p className="page-subtitle">Cross-agent aggregated view of all installed skills</p>
      </div>

      {skills.length === 0 ? (
        <p className="empty-hint">No skills discovered across any agents.</p>
      ) : (
        <table className="skill-table">
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
