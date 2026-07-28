use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

use crate::modules::platform::user_home_dir;
use crate::modules::util::parse_frontmatter;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MasterSkillReport {
    pub name: String,
    pub description: String,
    pub path: String,
    pub linked_agents: HashMap<String, bool>,
}

pub fn master_repo_dir() -> PathBuf {
    let home = user_home_dir().unwrap_or_else(|| PathBuf::from("/"));
    home.join(".asm").join("skills")
}

pub fn get_master_dir(custom_paths: Option<&HashMap<String, String>>) -> PathBuf {
    if let Some(path_str) = custom_paths.and_then(|m| m.get("master")) {
        PathBuf::from(path_str)
    } else {
        master_repo_dir()
    }
}

#[allow(dead_code)]
pub fn ensure_master_repo_dir() -> std::io::Result<PathBuf> {
    let dir = master_repo_dir();
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn ensure_master_dir_with_custom(custom_paths: Option<&HashMap<String, String>>) -> std::io::Result<PathBuf> {
    let dir = get_master_dir(custom_paths);
    if !dir.exists() {
        fs::create_dir_all(&dir)?;
    }
    Ok(dir)
}

pub fn get_agent_skills_dir(
    agent_id: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> Option<PathBuf> {
    if let Some(custom) = custom_paths.and_then(|m| m.get(agent_id)) {
        return Some(PathBuf::from(custom));
    }
    let home = user_home_dir()?;
    match agent_id {
        "claude-code" => Some(home.join(".claude").join("skills")),
        "codex" => Some(home.join(".codex").join("skills")),
        "antigravity" => Some(home.join(".gemini").join("antigravity").join("skills")),
        "pi-agent" => {
            let pi_agent_dir = home.join(".pi").join("agent").join("skills");
            let pi_dir = home.join(".pi").join("skills");
            let pi_dash_dir = home.join(".pi-agent").join("skills");
            if pi_dir.exists() {
                Some(pi_dir)
            } else if pi_dash_dir.exists() {
                Some(pi_dash_dir)
            } else {
                Some(pi_agent_dir)
            }
        }
        "opencode" | "open-code" => {
            let cfg_dir = home.join(".config").join("opencode").join("skills");
            let dot_dir = home.join(".opencode").join("skills");
            let dash_dir = home.join(".open-code").join("skills");
            if cfg_dir.exists() {
                Some(cfg_dir)
            } else if dot_dir.exists() {
                Some(dot_dir)
            } else if dash_dir.exists() {
                Some(dash_dir)
            } else {
                Some(cfg_dir)
            }
        }
        "cursor" => {
            let dot_dir = home.join(".cursor").join("skills");
            let rules_dir = home.join(".cursor").join("rules");
            let cfg_dir = home.join(".config").join("cursor").join("skills");
            if dot_dir.exists() {
                Some(dot_dir)
            } else if rules_dir.exists() {
                Some(rules_dir)
            } else if cfg_dir.exists() {
                Some(cfg_dir)
            } else {
                Some(dot_dir)
            }
        }
        _ => None,
    }
}

pub fn create_skill_symlink(master_skill_path: &Path, target_symlink: &Path) -> std::io::Result<()> {
    if let Some(parent) = target_symlink.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    remove_skill_symlink(target_symlink)?;
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(master_skill_path, target_symlink)?;
    }
    Ok(())
}

pub fn remove_skill_symlink(target_symlink: &Path) -> std::io::Result<()> {
    if target_symlink.exists() || fs::symlink_metadata(target_symlink).is_ok() {
        if fs::remove_file(target_symlink).is_err() {
            let _ = fs::remove_dir_all(target_symlink);
        }
    }
    Ok(())
}

pub fn is_valid_symlink_to(target_symlink: &Path, master_path: &Path) -> bool {
    let metadata = match fs::symlink_metadata(target_symlink) {
        Ok(m) => m,
        Err(_) => return false,
    };
    if !metadata.file_type().is_symlink() {
        return false;
    }
    if let Ok(link_target) = fs::read_link(target_symlink) {
        if link_target == master_path {
            return true;
        }
    }
    if let (Ok(canon_target), Ok(canon_master)) = (fs::canonicalize(target_symlink), fs::canonicalize(master_path)) {
        if canon_target == canon_master {
            return true;
        }
    }
    false
}

pub fn scan_master_repo(custom_paths: Option<&HashMap<String, String>>) -> Vec<MasterSkillReport> {
    let master_dir = get_master_dir(custom_paths);
    if !master_dir.exists() {
        return Vec::new();
    }

    let entries = match fs::read_dir(&master_dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(),
    };

    let mut reports = Vec::new();
    let known_agents = ["claude-code", "codex", "antigravity", "pi-agent", "opencode", "cursor"];

    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if file_name.starts_with('.') || !path.is_dir() {
            continue;
        }

        let skill_file = path.join("SKILL.md");
        let (parsed_name, parsed_desc) = if skill_file.exists() {
            if let Ok(content) = fs::read_to_string(&skill_file) {
                if let Ok(fm) = parse_frontmatter(&content) {
                    (fm.name, fm.description)
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        let name = parsed_name.unwrap_or_else(|| file_name.clone());
        let description = parsed_desc.unwrap_or_default();

        let mut linked_agents = HashMap::new();
        for &agent_id in &known_agents {
            let is_linked = if let Some(agent_dir) = get_agent_skills_dir(agent_id, custom_paths) {
                let target_symlink = agent_dir.join(&file_name);
                if is_valid_symlink_to(&target_symlink, &path) {
                    true
                } else if target_symlink.exists() || fs::symlink_metadata(&target_symlink).is_ok() {
                    let fp_input_tgt = FingerprintInput {
                        root: target_symlink.clone(),
                        comparable_extensions: &[],
                        exclude_names: &[],
                    };
                    let fp_input_mst = FingerprintInput {
                        root: path.clone(),
                        comparable_extensions: &[],
                        exclude_names: &[],
                    };
                    let tgt_fp = compute_fingerprint(&fp_input_tgt).map(|(h, _)| h).unwrap_or_default();
                    let mst_fp = compute_fingerprint(&fp_input_mst).map(|(h, _)| h).unwrap_or_default();
                    if !tgt_fp.is_empty() && tgt_fp == mst_fp {
                        let _ = remove_skill_symlink(&target_symlink);
                        let _ = create_skill_symlink(&path, &target_symlink);
                        true
                    } else {
                        false
                    }
                } else {
                    false
                }
            } else {
                false
            };
            linked_agents.insert(agent_id.to_string(), is_linked);
        }

        reports.push(MasterSkillReport {
            name,
            description,
            path: path.to_string_lossy().into_owned(),
            linked_agents,
        });
    }

    reports.sort_by(|a, b| a.name.cmp(&b.name));
    reports
}

pub fn toggle_skill_symlink(
    agent_id: &str,
    skill_name: &str,
    enable: bool,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<bool> {
    let master_dir = get_master_dir(custom_paths);
    let master_skill_path = master_dir.join(skill_name);
    let agent_dir = get_agent_skills_dir(agent_id, custom_paths)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, format!("Unknown agent: {}", agent_id)))?;

    let target_symlink = agent_dir.join(skill_name);

    if enable {
        if !master_skill_path.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Master skill '{}' does not exist at {:?}", skill_name, master_skill_path),
            ));
        }
        if !agent_dir.exists() {
            fs::create_dir_all(&agent_dir)?;
        }
        create_skill_symlink(&master_skill_path, &target_symlink)?;
    } else {
        remove_skill_symlink(&target_symlink)?;
    }

    Ok(true)
}

pub fn install_skill_to_master(
    skill_name: &str,
    source: Option<&str>,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<PathBuf> {
    let master_dir = ensure_master_dir_with_custom(custom_paths)?;
    let target_dir = master_dir.join(skill_name);

    if !target_dir.exists() {
        if let Some(src_str) = source {
            let src_path = PathBuf::from(src_str);
            if src_path.exists() && src_path.is_dir() {
                copy_dir_all(&src_path, &target_dir)?;
            } else {
                fs::create_dir_all(&target_dir)?;
                let desc = format!("Installed skill '{}' from {}", skill_name, src_str);
                let skill_md_content = format!(
                    "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}",
                    skill_name, desc, skill_name, desc
                );
                fs::write(target_dir.join("SKILL.md"), skill_md_content)?;
            }
        } else {
            fs::create_dir_all(&target_dir)?;
            let desc = format!("Skill '{}'", skill_name);
            let skill_md_content = format!(
                "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}",
                skill_name, desc, skill_name, desc
            );
            fs::write(target_dir.join("SKILL.md"), skill_md_content)?;
        }
    }

    Ok(target_dir)
}

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst_path)?;
        } else {
            fs::copy(entry.path(), dst_path)?;
        }
    }
    Ok(())
}

use crate::modules::util::{compute_fingerprint, FingerprintInput};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ImportResult {
    Success,
    Conflict {
        skill_name: String,
        existing_fingerprint: String,
        incoming_fingerprint: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum ImportMode {
    Auto,
    UseMaster,
    OverwriteMaster,
    RenameNew { new_name: String },
}

pub fn import_skill_to_master(
    agent_id: &str,
    skill_name: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<bool> {
    match import_skill_to_master_with_mode(agent_id, skill_name, ImportMode::Auto, custom_paths)? {
        ImportResult::Success => Ok(true),
        ImportResult::Conflict { .. } => Ok(false),
    }
}

pub fn import_skill_to_master_with_mode(
    agent_id: &str,
    skill_name: &str,
    mode: ImportMode,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<ImportResult> {
    let master_dir = ensure_master_dir_with_custom(custom_paths)?;
    let agent_dir = get_agent_skills_dir(agent_id, custom_paths)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, format!("Unknown agent: {}", agent_id)))?;

    let source_path = agent_dir.join(skill_name);
    if !source_path.exists() && fs::symlink_metadata(&source_path).is_err() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Source skill '{}' not found at {:?}", skill_name, source_path),
        ));
    }

    let target_name = match &mode {
        ImportMode::RenameNew { new_name } => new_name.as_str(),
        _ => skill_name,
    };

    let master_skill_path = master_dir.join(target_name);

    if is_valid_symlink_to(&source_path, &master_skill_path) {
        return Ok(ImportResult::Success);
    }

    match mode {
        ImportMode::Auto => {
            if master_skill_path.exists() {
                let fp_input_src = FingerprintInput {
                    root: source_path.clone(),
                    comparable_extensions: &[],
                    exclude_names: &[],
                };
                let fp_input_mst = FingerprintInput {
                    root: master_skill_path.clone(),
                    comparable_extensions: &[],
                    exclude_names: &[],
                };

                let src_fp = compute_fingerprint(&fp_input_src).map(|(h, _)| h).unwrap_or_default();
                let mst_fp = compute_fingerprint(&fp_input_mst).map(|(h, _)| h).unwrap_or_default();

                if !src_fp.is_empty() && src_fp == mst_fp {
                    remove_skill_symlink(&source_path)?;
                    create_skill_symlink(&master_skill_path, &source_path)?;
                    Ok(ImportResult::Success)
                } else {
                    Ok(ImportResult::Conflict {
                        skill_name: skill_name.to_string(),
                        existing_fingerprint: mst_fp,
                        incoming_fingerprint: src_fp,
                    })
                }
            } else {
                if source_path.is_dir() {
                    copy_dir_all(&source_path, &master_skill_path)?;
                } else if source_path.is_file() {
                    if let Some(parent) = master_skill_path.parent() {
                        fs::create_dir_all(parent)?;
                    }
                    fs::copy(&source_path, &master_skill_path)?;
                }
                remove_skill_symlink(&source_path)?;
                create_skill_symlink(&master_skill_path, &source_path)?;
                Ok(ImportResult::Success)
            }
        }
        ImportMode::UseMaster => {
            if !master_skill_path.exists() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    format!("Master skill '{}' does not exist", target_name),
                ));
            }
            remove_skill_symlink(&source_path)?;
            let _ = fs::remove_dir_all(&source_path);
            create_skill_symlink(&master_skill_path, &source_path)?;
            Ok(ImportResult::Success)
        }
        ImportMode::OverwriteMaster => {
            if master_skill_path.exists() {
                let _ = fs::remove_dir_all(&master_skill_path);
                let _ = fs::remove_file(&master_skill_path);
            }
            if source_path.is_dir() {
                copy_dir_all(&source_path, &master_skill_path)?;
            } else if source_path.is_file() {
                if let Some(parent) = master_skill_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(&source_path, &master_skill_path)?;
            }
            remove_skill_symlink(&source_path)?;
            create_skill_symlink(&master_skill_path, &source_path)?;
            Ok(ImportResult::Success)
        }
        ImportMode::RenameNew { new_name: ref _name } => {
            if master_skill_path.exists() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    format!("Master skill with new name '{}' already exists", target_name),
                ));
            }
            if source_path.is_dir() {
                copy_dir_all(&source_path, &master_skill_path)?;
            } else if source_path.is_file() {
                if let Some(parent) = master_skill_path.parent() {
                    fs::create_dir_all(parent)?;
                }
                fs::copy(&source_path, &master_skill_path)?;
            }
            remove_skill_symlink(&source_path)?;
            create_skill_symlink(&master_skill_path, &source_path)?;
            Ok(ImportResult::Success)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static NEXT_ID: AtomicUsize = AtomicUsize::new(1);

    fn temp_dir() -> PathBuf {
        let pid = std::process::id();
        let n = NEXT_ID.fetch_add(1, Ordering::Relaxed);
        let p = std::env::temp_dir().join(format!("asm-master-test-{}-{}", pid, n));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn test_master_repo_dir() {
        let dir = master_repo_dir();
        assert!(dir.to_string_lossy().contains(".asm"));
    }

    #[test]
    fn test_symlink_creation_and_removal() {
        let tmp = temp_dir();
        let master_skill = tmp.join("master").join("my-skill");
        fs::create_dir_all(&master_skill).unwrap();
        fs::write(master_skill.join("SKILL.md"), "---\nname: my-skill\ndescription: Test skill\n---\n").unwrap();

        let agent_symlink = tmp.join("claude").join("my-skill");
        create_skill_symlink(&master_skill, &agent_symlink).unwrap();

        assert!(is_valid_symlink_to(&agent_symlink, &master_skill));

        remove_skill_symlink(&agent_symlink).unwrap();
        assert!(!agent_symlink.exists());
        assert!(!is_valid_symlink_to(&agent_symlink, &master_skill));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_scan_master_repo_and_toggle() {
        let tmp = temp_dir();
        let master_dir = tmp.join("master_skills");
        let claude_dir = tmp.join("claude_skills");
        let codex_dir = tmp.join("codex_skills");
        let ag_dir = tmp.join("ag_skills");
        let pi_dir = tmp.join("pi_skills");

        fs::create_dir_all(&master_dir.join("skill-a")).unwrap();
        fs::write(
            master_dir.join("skill-a").join("SKILL.md"),
            "---\nname: skill-a\ndescription: Skill A desc\n---\n",
        ).unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert("master".to_string(), master_dir.to_string_lossy().to_string());
        custom_paths.insert("claude-code".to_string(), claude_dir.to_string_lossy().to_string());
        custom_paths.insert("codex".to_string(), codex_dir.to_string_lossy().to_string());
        custom_paths.insert("antigravity".to_string(), ag_dir.to_string_lossy().to_string());
        custom_paths.insert("pi-agent".to_string(), pi_dir.to_string_lossy().to_string());

        let reports = scan_master_repo(Some(&custom_paths));
        assert_eq!(reports.len(), 1);
        assert_eq!(reports[0].name, "skill-a");
        assert_eq!(reports[0].description, "Skill A desc");
        assert_eq!(reports[0].linked_agents.get("claude-code"), Some(&false));

        toggle_skill_symlink("claude-code", "skill-a", true, Some(&custom_paths)).unwrap();

        let reports_after = scan_master_repo(Some(&custom_paths));
        assert_eq!(reports_after[0].linked_agents.get("claude-code"), Some(&true));
        assert_eq!(reports_after[0].linked_agents.get("codex"), Some(&false));

        toggle_skill_symlink("claude-code", "skill-a", false, Some(&custom_paths)).unwrap();
        let reports_after_untoggle = scan_master_repo(Some(&custom_paths));
        assert_eq!(reports_after_untoggle[0].linked_agents.get("claude-code"), Some(&false));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_import_skill_to_master() {
        let tmp = temp_dir();
        let master_dir = tmp.join("master_skills");
        let claude_dir = tmp.join("claude_skills");

        let source_skill = claude_dir.join("imported-skill");
        fs::create_dir_all(&source_skill).unwrap();
        fs::write(
            source_skill.join("SKILL.md"),
            "---\nname: imported-skill\ndescription: Imported desc\n---\n",
        ).unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert("master".to_string(), master_dir.to_string_lossy().to_string());
        custom_paths.insert("claude-code".to_string(), claude_dir.to_string_lossy().to_string());

        let res = import_skill_to_master("claude-code", "imported-skill", Some(&custom_paths));
        assert!(res.is_ok());

        let master_skill_path = master_dir.join("imported-skill");
        assert!(master_skill_path.exists());
        assert!(is_valid_symlink_to(&source_skill, &master_skill_path));

        let _ = fs::remove_dir_all(&tmp);
    }
}
