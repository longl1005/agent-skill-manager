//! Inventory 服务。
//!
//! 见 ARCHITECTURE.md §3 与 DOMAIN_MODEL.md：维护 Agent / Skill / Installation
//! 的归一化视图与查询接口。
//!
//! M0 阶段：占位。

use std::collections::{BTreeMap, BTreeSet};

use crate::commands::ScanReport;

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum MatrixState {
    Missing,
    Present,
    Conflict,
    Unknown,
}

#[derive(Clone, Debug)]
#[allow(dead_code)] // 后续 IPC/UI 读取完整投影；本任务仅负责生成和缓存。
pub(crate) struct InventorySkill {
    pub name: String,
    pub description: String,
    pub installation_count: usize,
    pub agent_ids: Vec<String>,
    pub fingerprints: Vec<String>,
}

#[derive(Clone, Debug)]
#[allow(dead_code)] // 后续 IPC/UI 读取完整投影；本任务仅负责生成和缓存。
pub(crate) struct InventoryAgent {
    pub agent_id: String,
    pub display_name: String,
    pub skill_count: usize,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct MatrixCell {
    pub skill_name: String,
    pub agent_id: String,
    pub state: MatrixState,
}

#[derive(Clone, Debug)]
#[allow(dead_code)] // 后续 IPC/UI 读取完整投影；本任务仅负责生成和缓存。
pub(crate) struct Inventory {
    pub skills: Vec<InventorySkill>,
    pub agents: Vec<InventoryAgent>,
    pub matrix: Vec<MatrixCell>,
}

pub(crate) fn project(report: &ScanReport) -> Inventory {
    let mut skills: BTreeMap<String, SkillAccumulator> = BTreeMap::new();
    let mut agents: BTreeMap<String, InventoryAgent> = BTreeMap::new();
    let mut cell_fingerprints: BTreeMap<(String, String), BTreeSet<String>> = BTreeMap::new();

    for agent in &report.agents {
        let agent_id = agent.agent_id.clone();
        agents.insert(
            agent_id.clone(),
            InventoryAgent {
                agent_id: agent_id.clone(),
                display_name: agent.display_name.clone(),
                skill_count: agent.skills.len(),
            },
        );

        for skill in &agent.skills {
            let entry = skills
                .entry(skill.name.clone())
                .or_insert_with(|| SkillAccumulator {
                    description: skill.description.clone(),
                    installation_count: 0,
                    agent_ids: BTreeSet::new(),
                    fingerprints: BTreeSet::new(),
                });
            entry.installation_count += 1;
            entry.agent_ids.insert(agent_id.clone());
            if !skill.fingerprint_short.is_empty() {
                entry.fingerprints.insert(skill.fingerprint_short.clone());
                cell_fingerprints
                    .entry((skill.name.clone(), agent_id.clone()))
                    .or_default()
                    .insert(skill.fingerprint_short.clone());
            } else {
                cell_fingerprints
                    .entry((skill.name.clone(), agent_id.clone()))
                    .or_default();
            }
        }
    }

    let skills = skills
        .into_iter()
        .map(|(name, skill)| InventorySkill {
            name,
            description: skill.description,
            installation_count: skill.installation_count,
            agent_ids: skill.agent_ids.into_iter().collect(),
            fingerprints: skill.fingerprints.into_iter().collect(),
        })
        .collect::<Vec<_>>();
    let agents = agents.into_values().collect::<Vec<_>>();
    let matrix = skills
        .iter()
        .flat_map(|skill| {
            agents.iter().map(|agent| {
                let state =
                    match cell_fingerprints.get(&(skill.name.clone(), agent.agent_id.clone())) {
                        None => MatrixState::Missing,
                        Some(fingerprints) if fingerprints.is_empty() => MatrixState::Unknown,
                        Some(fingerprints) if fingerprints.len() == 1 => MatrixState::Present,
                        Some(_) => MatrixState::Conflict,
                    };

                MatrixCell {
                    skill_name: skill.name.clone(),
                    agent_id: agent.agent_id.clone(),
                    state,
                }
            })
        })
        .collect();

    Inventory {
        skills,
        agents,
        matrix,
    }
}

struct SkillAccumulator {
    description: String,
    installation_count: usize,
    agent_ids: BTreeSet<String>,
    fingerprints: BTreeSet<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{AgentReport, ScanReport, SkillReport};

    #[test]
    fn project_aggregates_one_skill_across_agents() {
        let mut report = report_with_skills("claude-code", vec![skill("review", "aaa")]);
        report
            .agents
            .push(agent_with_skills("codex", vec![skill("review", "aaa")]));

        let inventory = project(&report);

        assert_eq!(inventory.skills[0].name, "review");
        assert_eq!(inventory.skills[0].installation_count, 2);
        assert_eq!(inventory.skills[0].agent_ids, ["claude-code", "codex"]);
        assert_eq!(inventory.agents[0].agent_id, "claude-code");
        assert_eq!(inventory.agents[1].agent_id, "codex");
    }

    #[test]
    fn project_marks_distinct_fingerprints_for_one_agent_as_conflict() {
        let report = report_with_skills(
            "claude-code",
            vec![skill("review", "aaa"), skill("review", "bbb")],
        );

        let inventory = project(&report);

        assert_eq!(inventory.matrix[0].state, MatrixState::Conflict);
        assert_eq!(inventory.skills[0].installation_count, 2);
    }

    #[test]
    fn project_treats_empty_fingerprints_as_unknown_not_conflict() {
        let report = report_with_skills(
            "claude-code",
            vec![skill("review", ""), skill("review", "")],
        );

        assert_eq!(project(&report).matrix[0].state, MatrixState::Unknown);
    }

    #[test]
    fn project_adds_missing_cells_for_uninstalled_skills() {
        let mut report = report_with_skills("claude-code", vec![skill("review", "aaa")]);
        report
            .agents
            .push(agent_with_skills("codex", vec![skill("format", "bbb")]));

        let inventory = project(&report);

        assert_eq!(
            inventory.matrix,
            vec![
                MatrixCell {
                    skill_name: "format".to_owned(),
                    agent_id: "claude-code".to_owned(),
                    state: MatrixState::Missing,
                },
                MatrixCell {
                    skill_name: "format".to_owned(),
                    agent_id: "codex".to_owned(),
                    state: MatrixState::Present,
                },
                MatrixCell {
                    skill_name: "review".to_owned(),
                    agent_id: "claude-code".to_owned(),
                    state: MatrixState::Present,
                },
                MatrixCell {
                    skill_name: "review".to_owned(),
                    agent_id: "codex".to_owned(),
                    state: MatrixState::Missing,
                },
            ]
        );
    }

    fn report_with_skills(agent_id: &str, skills: Vec<SkillReport>) -> ScanReport {
        ScanReport {
            scan_id: "scan-1".to_owned(),
            started_at: 0,
            completed_at: 1,
            agents: vec![agent_with_skills(agent_id, skills)],
            total_skills: 0,
            total_issues: 0,
        }
    }

    fn agent_with_skills(agent_id: &str, skills: Vec<SkillReport>) -> AgentReport {
        AgentReport {
            agent_id: agent_id.to_owned(),
            display_name: format!("{agent_id} display"),
            detection_status: "Available".to_owned(),
            roots: vec![],
            skills,
            issues: vec![],
            outcome: "Completed".to_owned(),
        }
    }

    fn skill(name: &str, fingerprint: &str) -> SkillReport {
        SkillReport {
            name: name.to_owned(),
            description: format!("{name} description"),
            license: None,
            location: format!("/skills/{name}"),
            modified_at: 0,
            fingerprint_short: fingerprint.to_owned(),
            file_count: 1,
            is_symlink: false,
            symlink_target: None,
            issues: vec![],
        }
    }
}
