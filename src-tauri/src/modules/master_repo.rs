use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use crate::modules::platform::user_home_dir;
use crate::modules::util::parse_frontmatter;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MasterSkillReport {
    pub name: String,
    pub description: String,
    pub path: String,
    /// Filesystem modification time. Used to surface newly installed skills
    /// before the long-standing alphabetical inventory.
    pub modified_at: u64,
    pub linked_agents: HashMap<String, bool>,
}

pub fn master_repo_dir() -> PathBuf {
    let home = user_home_dir().unwrap_or_else(|| PathBuf::from("/"));
    home.join(".asm").join("skills")
}

pub fn expand_config_path(path: &str) -> PathBuf {
    if path == "~" {
        return user_home_dir().unwrap_or_else(|| PathBuf::from(path));
    }
    if let Some(rest) = path.strip_prefix("~/") {
        return user_home_dir()
            .unwrap_or_else(|| PathBuf::from("~"))
            .join(rest);
    }
    PathBuf::from(path)
}

pub fn get_master_dir(custom_paths: Option<&HashMap<String, String>>) -> PathBuf {
    if let Some(path_str) = custom_paths.and_then(|m| m.get("master")) {
        expand_config_path(path_str)
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

pub fn ensure_master_dir_with_custom(
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<PathBuf> {
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
        return Some(expand_config_path(custom));
    }
    let home = user_home_dir()?;
    match agent_id {
        "claude-code" => Some(home.join(".claude").join("skills")),
        "cline" => Some(home.join(".agents").join("skills")),
        "codebuddy" => Some(home.join(".codebuddy").join("skills")),
        "github-copilot" => Some(home.join(".copilot").join("skills")),
        "droid" => Some(home.join(".factory").join("skills")),
        "qoder" => Some(home.join(".qoder").join("skills")),
        "qwen-code" => Some(home.join(".qwen").join("skills")),
        "hermes" => Some(home.join(".hermes").join("skills")),
        "openclaw" => Some(home.join(".openclaw").join("skills")),
        "workbuddy" => Some(home.join(".workbuddy").join("skills")),
        "kimi-code" => Some(home.join(".kimi-code").join("skills")),
        "augment" => Some(home.join(".augment").join("skills")),
        "roo-code" => Some(home.join(".roo").join("skills")),
        "windsurf" => Some(home.join(".codeium").join("windsurf").join("skills")),
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
        "oh-my-pi" => Some(home.join(".omp").join("agent").join("skills")),
        "grok" => Some(home.join(".grok").join("skills")),
        "kiro" => Some(home.join(".kiro").join("skills")),
        "trae" => Some(home.join(".trae").join("skills")),
        "trae-cn" => Some(home.join(".trae-cn").join("skills")),
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

pub fn create_skill_symlink(
    master_skill_path: &Path,
    target_symlink: &Path,
) -> std::io::Result<()> {
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
    #[cfg(windows)]
    {
        use std::os::windows::fs::{symlink_dir, symlink_file};

        if master_skill_path.is_dir() {
            match symlink_dir(master_skill_path, target_symlink) {
                Ok(_) => return Ok(()),
                Err(e) => {
                    if e.raw_os_error() == Some(1314) {
                        // ERROR_PRIVILEGE_NOT_HELD - try junction instead
                        create_junction(master_skill_path, target_symlink)?;
                    } else {
                        return Err(e);
                    }
                }
            }
        } else {
            symlink_file(master_skill_path, target_symlink)?;
        }
    }
    #[cfg(not(any(unix, windows)))]
    {
        if master_skill_path.is_dir() {
            copy_dir_recursive(master_skill_path, target_symlink)?;
        } else {
            fs::copy(master_skill_path, target_symlink)?;
        }
    }
    Ok(())
}

#[cfg(windows)]
fn create_junction(source: &Path, junction: &Path) -> std::io::Result<()> {
    // Use Windows junction (directory symlink that doesn't require admin)
    // Implemented via symlink_dir with specific flags
    use std::process::Command;
    let output = Command::new("cmd")
        .args(["/C", "mklink", "/J", &junction.to_string_lossy(), &source.to_string_lossy()])
        .output()?;
    if output.status.success() {
        Ok(())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!(
                "Failed to create junction: {}",
                String::from_utf8_lossy(&output.stderr)
            ),
        ))
    }
}

#[cfg(not(unix))]
fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
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
    // On Windows, junctions don't report as symlinks but canonicalize still works
    #[cfg(windows)]
    {
        if !metadata.file_type().is_symlink() {
            // Check via canonicalization for junctions on Windows
            if let (Ok(canon_target), Ok(canon_master)) =
                (fs::canonicalize(target_symlink), fs::canonicalize(master_path))
            {
                return canon_target == canon_master;
            }
            return false;
        }
    }
    #[cfg(not(windows))]
    if !metadata.file_type().is_symlink() {
        return false;
    }
    if let Ok(link_target) = fs::read_link(target_symlink) {
        if link_target == master_path {
            return true;
        }
    }
    if let (Ok(canon_target), Ok(canon_master)) =
        (fs::canonicalize(target_symlink), fs::canonicalize(master_path))
    {
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
    let known_agents = [
        "claude-code",
        "cline",
        "codebuddy",
        "github-copilot",
        "droid",
        "qoder",
        "qwen-code",
        "hermes",
        "openclaw",
        "workbuddy",
        "kimi-code",
        "augment",
        "roo-code",
        "windsurf",
        "codex",
        "antigravity",
        "pi-agent",
        "oh-my-pi",
        "grok",
        "kiro",
        "trae",
        "trae-cn",
        "opencode",
        "cursor",
    ];

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
                } else {
                    false
                }
            } else {
                false
            };
            linked_agents.insert(agent_id.to_string(), is_linked);
        }

        // Sync to SQLite database
        if let Ok(conn) = crate::modules::db::open_db(None) {
            let _ = crate::modules::db::upsert_master_skill(&conn, &name, &description, "", "", 1);
            for (agent_id, &is_linked) in &linked_agents {
                let status = if is_linked { "linked" } else { "unlinked" };
                let _ = crate::modules::db::upsert_agent_symlink(&conn, agent_id, &name, status);
            }
        }

        reports.push(MasterSkillReport {
            name,
            description,
            path: path.to_string_lossy().into_owned(),
            modified_at: fs::metadata(&path)
                .and_then(|metadata| metadata.modified())
                .ok()
                .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
                .map(|duration| duration.as_millis() as u64)
                .unwrap_or(0),
            linked_agents,
        });
    }

    // The master library is an installation workspace, not a dictionary.
    // Show the newest folder first so a just-installed skill is immediately
    // visible; names are only the stable tie-breaker.
    reports.sort_by(|a, b| {
        b.modified_at
            .cmp(&a.modified_at)
            .then_with(|| a.name.cmp(&b.name))
    });
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
    let agent_dir = get_agent_skills_dir(agent_id, custom_paths).ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Unknown agent: {}", agent_id),
        )
    })?;

    let target_symlink = agent_dir.join(skill_name);

    if enable {
        if !master_skill_path.exists() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!(
                    "Master skill '{}' does not exist at {:?}",
                    skill_name, master_skill_path
                ),
            ));
        }
        if !agent_dir.exists() {
            fs::create_dir_all(&agent_dir)?;
        }
        create_skill_symlink(&master_skill_path, &target_symlink)?;
    } else {
        remove_skill_symlink(&target_symlink)?;
    }

    // Persist change into SQLite database
    if let Ok(conn) = crate::modules::db::open_db(None) {
        let status = if enable { "linked" } else { "unlinked" };
        let action = if enable { "LINK_SKILL" } else { "UNLINK_SKILL" };
        let _ = crate::modules::db::upsert_agent_symlink(&conn, agent_id, skill_name, status);
        let _ = crate::modules::db::log_activity(&conn, action, skill_name, agent_id);
    }

    Ok(true)
}

/// Applies a skill link change for multiple Agents in one command invocation.
/// The filesystem work remains per-Agent, but the desktop bridge and UI refresh
/// occur only once, which keeps "link all" responsive for large Agent lists.
pub fn toggle_skill_symlinks_batch(
    agent_ids: &[String],
    skill_name: &str,
    enable: bool,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<usize> {
    let mut changed = 0;
    for agent_id in agent_ids {
        toggle_skill_symlink(agent_id, skill_name, enable, custom_paths)?;
        changed += 1;
    }
    Ok(changed)
}

pub fn replace_agent_local_skill_with_symlink(
    agent_id: &str,
    skill_name: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<bool> {
    if skill_name.is_empty()
        || skill_name == "."
        || skill_name == ".."
        || skill_name.contains('/')
        || skill_name.contains('\\')
    {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid skill name"));
    }

    let master_skill_path = get_master_dir(custom_paths).join(skill_name);
    if !master_skill_path.is_dir() {
        return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Master skill does not exist"));
    }
    let agent_dir = get_agent_skills_dir(agent_id, custom_paths).ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, format!("Unknown agent: {agent_id}"))
    })?;
    let target = agent_dir.join(skill_name);
    let metadata = fs::symlink_metadata(&target)?;
    if metadata.file_type().is_symlink() {
        return Err(std::io::Error::new(std::io::ErrorKind::AlreadyExists, "Refusing to replace a symlink"));
    }

    if metadata.is_dir() {
        fs::remove_dir_all(&target)?;
    } else {
        fs::remove_file(&target)?;
    }
    create_skill_symlink(&master_skill_path, &target)?;

    if let Ok(conn) = crate::modules::db::open_db(None) {
        let _ = crate::modules::db::upsert_agent_symlink(&conn, agent_id, skill_name, "linked");
        let _ = crate::modules::db::log_activity(&conn, "REPLACE_LOCAL_SKILL_WITH_SYMLINK", skill_name, agent_id);
    }
    Ok(true)
}

/// Delete one skill entry from an Agent's configured skills directory.
///
/// A symlink is removed as a link only; its target is never followed or deleted.
/// Real skill directories are removed recursively, but only after validating that
/// `skill_name` is a single direct child of the Agent skills directory.
pub fn delete_agent_skill(
    agent_id: &str,
    skill_name: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<bool> {
    if skill_name.is_empty()
        || skill_name == "."
        || skill_name == ".."
        || skill_name.contains('/')
        || skill_name.contains('\\')
    {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid skill name"));
    }

    let agent_dir = get_agent_skills_dir(agent_id, custom_paths).ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, format!("Unknown agent: {agent_id}"))
    })?;
    let target = agent_dir.join(skill_name);
    let metadata = fs::symlink_metadata(&target)?;

    if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(&target)?;
    } else if metadata.is_dir() {
        fs::remove_dir_all(&target)?;
    } else {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Unsupported skill entry"));
    }

    if let Ok(conn) = crate::modules::db::open_db(None) {
        let _ = crate::modules::db::upsert_agent_symlink(&conn, agent_id, skill_name, "unlinked");
        let _ = crate::modules::db::log_activity(&conn, "DELETE_AGENT_SKILL", skill_name, agent_id);
    }
    Ok(true)
}

/// Remove only ASM-managed skill symlinks from one Agent directory.
pub fn unlink_all_agent_skills(
    agent_id: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<usize> {
    let master_dir = get_master_dir(custom_paths);
    let agent_dir = get_agent_skills_dir(agent_id, custom_paths).ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Unknown agent: {}", agent_id),
        )
    })?;
    let mut removed = 0;
    if !master_dir.exists() || !agent_dir.exists() {
        return Ok(0);
    }
    for entry in fs::read_dir(&master_dir)? {
        let entry = entry?;
        let master_skill = entry.path();
        if !master_skill.is_dir() {
            continue;
        }
        let target = agent_dir.join(entry.file_name());
        if is_valid_symlink_to(&target, &master_skill) {
            remove_skill_symlink(&target)?;
            removed += 1;
            if let Ok(conn) = crate::modules::db::open_db(None) {
                let skill_name = entry.file_name().to_string_lossy().to_string();
                let _ = crate::modules::db::upsert_agent_symlink(
                    &conn,
                    agent_id,
                    &skill_name,
                    "unlinked",
                );
                let _ =
                    crate::modules::db::log_activity(&conn, "UNLINK_SKILL", &skill_name, agent_id);
            }
        }
    }
    Ok(removed)
}

/// Atomically move ASM-managed links from the previous effective directory to a new Skills directory.
pub fn migrate_agent_skills_dir(
    agent_id: &str,
    old_custom_path: Option<&str>,
    new_path: &Path,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<usize> {
    let master_dir = get_master_dir(custom_paths);
    let old_dir = old_custom_path
        .map(expand_config_path)
        .unwrap_or_else(|| get_agent_skills_dir(agent_id, None).unwrap_or_default());
    fs::create_dir_all(new_path)?;
    if !master_dir.exists() {
        return Ok(0);
    }
    let mut links: Vec<(PathBuf, PathBuf, PathBuf)> = Vec::new();
    for entry in fs::read_dir(&master_dir)? {
        let entry = entry?;
        let master = entry.path();
        if !master.is_dir() {
            continue;
        }
        let old_link = old_dir.join(entry.file_name());
        if is_valid_symlink_to(&old_link, &master) {
            links.push((old_link, new_path.join(entry.file_name()), master));
        }
    }
    for (_, target, master) in &links {
        if target.exists() || fs::symlink_metadata(target).is_ok() {
            if !is_valid_symlink_to(target, master) {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    format!("Target conflict: {}", target.display()),
                ));
            }
        }
    }
    let mut created: Vec<PathBuf> = Vec::new();
    for (_, target, master) in &links {
        if !is_valid_symlink_to(target, master) {
            if let Err(error) = create_skill_symlink(master, target) {
                for path in created {
                    let _ = remove_skill_symlink(&path);
                }
                return Err(error);
            }
            created.push(target.clone());
        }
    }
    for (old, _, _) in &links {
        remove_skill_symlink(old)?;
    }
    Ok(links.len())
}

/// Known agent IDs for symlink cleanup during skill deletion.
const ALL_AGENT_IDS: &[&str] = &[
    "claude-code",
    "cline",
    "codebuddy",
    "github-copilot",
    "droid",
    "qoder",
    "qwen-code",
    "hermes",
    "openclaw",
    "workbuddy",
    "kimi-code",
    "augment",
    "roo-code",
    "windsurf",
    "codex",
    "antigravity",
    "pi-agent",
    "oh-my-pi",
    "grok",
    "kiro",
    "trae",
    "trae-cn",
    "opencode",
    "cursor",
];

/// Delete a master skill entirely: remove all agent symlinks first, then delete the master directory.
pub fn delete_master_skill(
    skill_name: &str,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<Vec<String>> {
    let master_dir = get_master_dir(custom_paths);
    let master_skill_path = master_dir.join(skill_name);

    // 1) Remove symlinks from all known agents
    let mut removed_agents: Vec<String> = Vec::new();
    for &agent_id in ALL_AGENT_IDS {
        if let Some(agent_dir) = get_agent_skills_dir(agent_id, custom_paths) {
            let symlink_path = agent_dir.join(skill_name);
            if is_valid_symlink_to(&symlink_path, &master_skill_path) {
                remove_skill_symlink(&symlink_path)?;
                removed_agents.push(agent_id.to_string());

                // Update DB
                if let Ok(conn) = crate::modules::db::open_db(None) {
                    let _ = crate::modules::db::upsert_agent_symlink(
                        &conn, agent_id, skill_name, "unlinked",
                    );
                    let _ = crate::modules::db::log_activity(
                        &conn,
                        "UNLINK_SKILL",
                        skill_name,
                        agent_id,
                    );
                }
            }
        }
    }

    // 2) Delete the master skill directory itself
    if master_skill_path.exists() {
        fs::remove_dir_all(&master_skill_path)?;
    }

    // 3) Log deletion activity
    if let Ok(conn) = crate::modules::db::open_db(None) {
        let _ = crate::modules::db::log_activity(&conn, "DELETE_SKILL", skill_name, "master");
    }

    Ok(removed_agents)
}

fn parse_git_url(source: &str) -> String {
    let trimmed = source.trim();
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        if trimmed.ends_with(".git") {
            trimmed.to_string()
        } else {
            format!("{}.git", trimmed.trim_end_matches('/'))
        }
    } else if trimmed.starts_with("npx skills add ") {
        let repo = trimmed.trim_start_matches("npx skills add ").trim();
        parse_git_url(repo)
    } else if trimmed.contains('/') {
        format!("https://github.com/{}.git", trimmed.trim_matches('/'))
    } else {
        format!("https://github.com/{}/skills.git", trimmed)
    }
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}-{}", since_the_epoch.as_millis(), std::process::id())
}

pub fn export_master_skill_zip(
    skill_name: &str,
    destination: &Path,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<PathBuf> {
    let source = get_master_dir(custom_paths).join(skill_name);
    if !source.is_dir() || !source.join("SKILL.md").is_file() {
        return Err(std::io::Error::new(std::io::ErrorKind::NotFound, "Master skill does not exist or has no SKILL.md"));
    }
    let file = fs::File::create(destination)?;
    let mut writer = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for entry in walkdir::WalkDir::new(&source).follow_links(false) {
        let entry = entry.map_err(|error| std::io::Error::other(error.to_string()))?;
        let path = entry.path();
        let relative = path.strip_prefix(&source).map_err(|error| std::io::Error::other(error.to_string()))?;
        let archive_path = Path::new(skill_name).join(relative).to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            if !relative.as_os_str().is_empty() { writer.add_directory(format!("{archive_path}/"), options)?; }
        } else if entry.file_type().is_file() {
            writer.start_file(archive_path, options)?;
            let mut input = fs::File::open(path)?;
            std::io::copy(&mut input, &mut writer)?;
        }
    }
    writer.finish()?;
    Ok(destination.to_path_buf())
}

fn extract_skill_zip(source: &Path) -> std::io::Result<(PathBuf, PathBuf)> {
    let temp_root = std::env::temp_dir().join(format!("asm-zip-{}", uuid_simple()));
    fs::create_dir_all(&temp_root)?;
    let result = (|| -> std::io::Result<PathBuf> {
        let file = fs::File::open(source)?;
        let mut archive = zip::ZipArchive::new(file).map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error.to_string()))?;
        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidData, error.to_string()))?;
            let enclosed = entry.enclosed_name().ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "ZIP contains an unsafe path"))?;
            let output = temp_root.join(enclosed);
            if entry.is_dir() {
                fs::create_dir_all(&output)?;
            } else {
                if let Some(parent) = output.parent() { fs::create_dir_all(parent)?; }
                let mut file = fs::File::create(output)?;
                std::io::copy(&mut entry, &mut file)?;
            }
        }
        find_first_skill_dir(&temp_root).ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "ZIP does not contain SKILL.md"))
    })();
    match result {
        Ok(skill_dir) => Ok((temp_root, skill_dir)),
        Err(error) => { let _ = fs::remove_dir_all(&temp_root); Err(error) }
    }
}

fn find_skill_dir_in_tree(root: &Path, target_skill: &str) -> Option<PathBuf> {
    if !root.exists() || !root.is_dir() {
        return None;
    }

    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        let name = entry.file_name();
                        let name_str = name.to_string_lossy();
                        if name_str.eq_ignore_ascii_case(target_skill) {
                            let candidate = entry.path();
                            if candidate.join("SKILL.md").exists()
                                || candidate.join("skill.md").exists()
                            {
                                return Some(candidate);
                            }
                        }
                        if name_str != ".git" {
                            stack.push(entry.path());
                        }
                    }
                }
            }
        }
    }

    if root.join("SKILL.md").exists() || root.join("skill.md").exists() {
        return Some(root.to_path_buf());
    }

    None
}

fn find_first_skill_dir(root: &Path) -> Option<PathBuf> {
    if root.join("SKILL.md").is_file() || root.join("skill.md").is_file() {
        return Some(root.to_path_buf());
    }
    fs::read_dir(root).ok()?.flatten().find_map(|entry| {
        let path = entry.path();
        if path.is_dir() && (path.join("SKILL.md").is_file() || path.join("skill.md").is_file()) {
            Some(path)
        } else {
            None
        }
    })
}

pub fn install_skill_to_master(
    skill_name: &str,
    source: Option<&str>,
    custom_paths: Option<&HashMap<String, String>>,
) -> std::io::Result<PathBuf> {
    let master_dir = ensure_master_dir_with_custom(custom_paths)?;
    let target_dir = master_dir.join(skill_name);

    // If target_dir exists, check if it's a dummy placeholder file (< 350 bytes with only 1 file)
    let is_dummy_placeholder = if target_dir.exists() {
        let skill_md = target_dir.join("SKILL.md");
        if let Ok(metadata) = fs::metadata(&skill_md) {
            metadata.len() < 350
                && fs::read_dir(&target_dir)
                    .map(|d| d.count() <= 1)
                    .unwrap_or(false)
        } else {
            false
        }
    } else {
        false
    };

    if !target_dir.exists() || is_dummy_placeholder {
        if is_dummy_placeholder {
            let _ = fs::remove_dir_all(&target_dir);
        }

        let mut installed = false;

        if let Some(src_str) = source {
            let src_path = PathBuf::from(src_str);
            if src_path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("zip")) {
                let (temp_root, skill_dir) = extract_skill_zip(&src_path)?;
                let copy_result = copy_dir_all(&skill_dir, &target_dir);
                let _ = fs::remove_dir_all(temp_root);
                copy_result?;
                installed = true;
            } else if src_path.exists() && src_path.is_dir() {
                let dir_to_copy = find_skill_dir_in_tree(&src_path, skill_name).unwrap_or(src_path);
                copy_dir_all(&dir_to_copy, &target_dir)?;
                installed = true;
            } else {
                let repo_url = parse_git_url(src_str);
                let temp_dir = std::env::temp_dir().join(format!("asm-clone-{}", uuid_simple()));
                let _ = fs::remove_dir_all(&temp_dir);

                let status = std::process::Command::new("git")
                    .args([
                        "clone",
                        "--depth",
                        "1",
                        &repo_url,
                        temp_dir.to_str().unwrap(),
                    ])
                    .status();

                if let Ok(st) = status {
                    if st.success() {
                        if let Some(skill_dir) = find_skill_dir_in_tree(&temp_dir, skill_name) {
                            copy_dir_all(&skill_dir, &target_dir)?;
                            installed = true;
                        } else if temp_dir.join("SKILL.md").exists()
                            || temp_dir.join("skill.md").exists()
                        {
                            copy_dir_all(&temp_dir, &target_dir)?;
                            let _ = fs::remove_dir_all(target_dir.join(".git"));
                            installed = true;
                        }
                    }
                }
                let _ = fs::remove_dir_all(&temp_dir);
            }
        }

        if !installed {
            fs::create_dir_all(&target_dir)?;
            let desc = format!("Skill '{}'", skill_name);
            let skill_md_content = format!(
                "---\nname: {}\ndescription: {}\n---\n\n# {}\n\n{}",
                skill_name, desc, skill_name, desc
            );
            fs::write(target_dir.join("SKILL.md"), skill_md_content)?;
        }
    }

    if let Ok(conn) = crate::modules::db::open_db(None) {
        let desc = format!("Skill '{}'", skill_name);
        let file_count = fs::read_dir(&target_dir).map(|d| d.count()).unwrap_or(1);
        let _ = crate::modules::db::upsert_master_skill(
            &conn,
            skill_name,
            &desc,
            "",
            source.unwrap_or(""),
            file_count,
        );
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
    let agent_dir = get_agent_skills_dir(agent_id, custom_paths).ok_or_else(|| {
        std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("Unknown agent: {}", agent_id),
        )
    })?;

    let source_path = agent_dir.join(skill_name);
    if !source_path.exists() && fs::symlink_metadata(&source_path).is_err() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!(
                "Source skill '{}' not found at {:?}",
                skill_name, source_path
            ),
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

    let source_is_external_symlink = fs::symlink_metadata(&source_path)
        .map(|metadata| metadata.file_type().is_symlink())
        .unwrap_or(false);
    if source_is_external_symlink {
        let external_target = fs::canonicalize(&source_path)?;
        if !external_target.is_dir() || !external_target.join("SKILL.md").is_file() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                format!(
                    "External symlink target for '{}' must be a Skill directory containing SKILL.md",
                    skill_name
                ),
            ));
        }
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

                let src_fp = compute_fingerprint(&fp_input_src)
                    .map(|(h, _)| h)
                    .unwrap_or_default();
                let mst_fp = compute_fingerprint(&fp_input_mst)
                    .map(|(h, _)| h)
                    .unwrap_or_default();

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
        ImportMode::RenameNew {
            new_name: ref _name,
        } => {
            if master_skill_path.exists() {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::AlreadyExists,
                    format!(
                        "Master skill with new name '{}' already exists",
                        target_name
                    ),
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
        fs::write(
            master_skill.join("SKILL.md"),
            "---\nname: my-skill\ndescription: Test skill\n---\n",
        )
        .unwrap();

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
        )
        .unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert(
            "master".to_string(),
            master_dir.to_string_lossy().to_string(),
        );
        custom_paths.insert(
            "claude-code".to_string(),
            claude_dir.to_string_lossy().to_string(),
        );
        custom_paths.insert("codex".to_string(), codex_dir.to_string_lossy().to_string());
        custom_paths.insert(
            "antigravity".to_string(),
            ag_dir.to_string_lossy().to_string(),
        );
        custom_paths.insert("pi-agent".to_string(), pi_dir.to_string_lossy().to_string());

        let reports = scan_master_repo(Some(&custom_paths));
        assert_eq!(reports.len(), 1);
        assert_eq!(reports[0].name, "skill-a");
        assert_eq!(reports[0].description, "Skill A desc");
        assert_eq!(reports[0].linked_agents.get("claude-code"), Some(&false));

        toggle_skill_symlink("claude-code", "skill-a", true, Some(&custom_paths)).unwrap();

        let reports_after = scan_master_repo(Some(&custom_paths));
        assert_eq!(
            reports_after[0].linked_agents.get("claude-code"),
            Some(&true)
        );
        assert_eq!(reports_after[0].linked_agents.get("codex"), Some(&false));

        toggle_skill_symlink("claude-code", "skill-a", false, Some(&custom_paths)).unwrap();
        let reports_after_untoggle = scan_master_repo(Some(&custom_paths));
        assert_eq!(
            reports_after_untoggle[0].linked_agents.get("claude-code"),
            Some(&false)
        );

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn batch_toggle_links_each_requested_agent() {
        let tmp = temp_dir();
        let master_dir = tmp.join("master_skills");
        let claude_dir = tmp.join("claude_skills");
        let codex_dir = tmp.join("codex_skills");
        fs::create_dir_all(master_dir.join("skill-a")).unwrap();
        fs::write(master_dir.join("skill-a").join("SKILL.md"), "# Skill A").unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert("master".to_string(), master_dir.to_string_lossy().to_string());
        custom_paths.insert("claude-code".to_string(), claude_dir.to_string_lossy().to_string());
        custom_paths.insert("codex".to_string(), codex_dir.to_string_lossy().to_string());
        let agent_ids = vec!["claude-code".to_string(), "codex".to_string()];

        assert_eq!(
            toggle_skill_symlinks_batch(&agent_ids, "skill-a", true, Some(&custom_paths)).unwrap(),
            2,
        );
        assert!(is_valid_symlink_to(&claude_dir.join("skill-a"), &master_dir.join("skill-a")));
        assert!(is_valid_symlink_to(&codex_dir.join("skill-a"), &master_dir.join("skill-a")));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn unlink_all_agent_skills_removes_only_asm_links() {
        let tmp = temp_dir();
        let master = tmp.join("master");
        let agent = tmp.join("agent");
        let skill = master.join("managed");
        fs::create_dir_all(&skill).unwrap();
        fs::write(skill.join("SKILL.md"), "---\nname: managed\n---").unwrap();
        create_skill_symlink(&skill, &agent.join("managed")).unwrap();
        fs::create_dir_all(agent.join("personal")).unwrap();
        let mut paths = HashMap::new();
        paths.insert("master".into(), master.to_string_lossy().to_string());
        paths.insert("claude-code".into(), agent.to_string_lossy().to_string());
        assert_eq!(
            unlink_all_agent_skills("claude-code", Some(&paths)).unwrap(),
            1
        );
        assert!(!agent.join("managed").exists());
        assert!(agent.join("personal").exists());
        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn replacement_deletes_only_a_real_agent_skill_and_creates_master_symlink() {
        let tmp = temp_dir();
        let master = tmp.join("master");
        let agent = tmp.join("agent");
        let master_skill = master.join("skill-a");
        let local_skill = agent.join("skill-a");
        fs::create_dir_all(&master_skill).unwrap();
        fs::write(master_skill.join("SKILL.md"), "---\nname: skill-a\n---").unwrap();
        fs::create_dir_all(&local_skill).unwrap();
        fs::write(local_skill.join("local.txt"), "local copy").unwrap();
        let mut paths = HashMap::new();
        paths.insert("master".into(), master.to_string_lossy().to_string());
        paths.insert("claude-code".into(), agent.to_string_lossy().to_string());

        assert!(replace_agent_local_skill_with_symlink("claude-code", "skill-a", Some(&paths)).unwrap());
        assert!(is_valid_symlink_to(&local_skill, &master_skill));
        assert!(!local_skill.join("local.txt").exists());
        assert!(replace_agent_local_skill_with_symlink("claude-code", "../skill-a", Some(&paths)).is_err());

        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn replacement_refuses_to_delete_an_existing_symlink() {
        let tmp = temp_dir();
        let master = tmp.join("master");
        let agent = tmp.join("agent");
        let master_skill = master.join("skill-a");
        fs::create_dir_all(&master_skill).unwrap();
        fs::write(master_skill.join("SKILL.md"), "---\nname: skill-a\n---").unwrap();
        create_skill_symlink(&master_skill, &agent.join("skill-a")).unwrap();
        let mut paths = HashMap::new();
        paths.insert("master".into(), master.to_string_lossy().to_string());
        paths.insert("claude-code".into(), agent.to_string_lossy().to_string());

        assert!(replace_agent_local_skill_with_symlink("claude-code", "skill-a", Some(&paths)).is_err());
        assert!(is_valid_symlink_to(&agent.join("skill-a"), &master_skill));

        let _ = fs::remove_dir_all(tmp);
    }

    #[test]
    fn delete_agent_skill_removes_local_entries_without_following_external_symlinks() {
        let tmp = temp_dir();
        let agent = tmp.join("agent");
        let local_skill = agent.join("local-skill");
        let external_target = tmp.join("external-skill");
        fs::create_dir_all(&local_skill).unwrap();
        fs::write(local_skill.join("SKILL.md"), "local").unwrap();
        fs::create_dir_all(&external_target).unwrap();
        fs::write(external_target.join("SKILL.md"), "external").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&external_target, agent.join("external-skill")).unwrap();

        let mut paths = HashMap::new();
        paths.insert("claude-code".into(), agent.to_string_lossy().to_string());

        assert!(delete_agent_skill("claude-code", "local-skill", Some(&paths)).unwrap());
        assert!(!local_skill.exists());
        #[cfg(unix)]
        {
            assert!(delete_agent_skill("claude-code", "external-skill", Some(&paths)).unwrap());
            assert!(external_target.exists());
        }
        assert!(delete_agent_skill("claude-code", "../external-skill", Some(&paths)).is_err());

        let _ = fs::remove_dir_all(tmp);
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
        )
        .unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert(
            "master".to_string(),
            master_dir.to_string_lossy().to_string(),
        );
        custom_paths.insert(
            "claude-code".to_string(),
            claude_dir.to_string_lossy().to_string(),
        );

        let res = import_skill_to_master("claude-code", "imported-skill", Some(&custom_paths));
        assert!(res.is_ok());

        let master_skill_path = master_dir.join("imported-skill");
        assert!(master_skill_path.exists());
        assert!(is_valid_symlink_to(&source_skill, &master_skill_path));

        let _ = fs::remove_dir_all(&tmp);
    }

    #[cfg(unix)]
    #[test]
    fn deleting_master_skill_preserves_same_named_external_agent_symlink() {
        let tmp = temp_dir();
        let master_dir = tmp.join("master_skills");
        let claude_dir = tmp.join("claude_skills");
        let skill_name = "delete-external-only";
        let master_skill = master_dir.join(skill_name);
        let external_skill = tmp.join("external-skill");
        fs::create_dir_all(&master_skill).unwrap();
        fs::write(master_skill.join("SKILL.md"), "# Master skill").unwrap();
        fs::create_dir_all(&external_skill).unwrap();
        fs::write(external_skill.join("SKILL.md"), "# External skill").unwrap();
        fs::create_dir_all(&claude_dir).unwrap();
        let agent_link = claude_dir.join(skill_name);
        std::os::unix::fs::symlink(&external_skill, &agent_link).unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert("master".to_string(), master_dir.to_string_lossy().to_string());
        custom_paths.insert("claude-code".to_string(), claude_dir.to_string_lossy().to_string());

        let removed_agents = delete_master_skill(skill_name, Some(&custom_paths)).unwrap();

        assert!(removed_agents.is_empty());
        assert!(!master_skill.exists());
        assert!(agent_link.exists());
        assert_eq!(fs::read_to_string(external_skill.join("SKILL.md")).unwrap(), "# External skill");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[cfg(unix)]
    #[test]
    fn import_external_symlink_requires_a_skill_manifest() {
        let tmp = temp_dir();
        let master_dir = tmp.join("master_skills");
        let claude_dir = tmp.join("claude_skills");
        let external_target = tmp.join("external-skill");
        fs::create_dir_all(&external_target).unwrap();
        fs::write(external_target.join("notes.md"), "not a skill").unwrap();
        fs::create_dir_all(&claude_dir).unwrap();
        std::os::unix::fs::symlink(&external_target, claude_dir.join("external-skill")).unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert("master".to_string(), master_dir.to_string_lossy().to_string());
        custom_paths.insert("claude-code".to_string(), claude_dir.to_string_lossy().to_string());

        assert!(import_skill_to_master(
            "claude-code",
            "external-skill",
            Some(&custom_paths),
        )
        .is_err());
        assert!(external_target.exists());
        assert!(!master_dir.join("external-skill").exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[cfg(unix)]
    #[test]
    fn import_external_symlink_copies_to_master_and_preserves_external_target() {
        let tmp = temp_dir();
        let master_dir = tmp.join("master_skills");
        let claude_dir = tmp.join("claude_skills");
        let external_target = tmp.join("external-skill");
        fs::create_dir_all(&external_target).unwrap();
        fs::write(external_target.join("SKILL.md"), "# External skill").unwrap();
        fs::write(external_target.join("reference.md"), "keep this external copy").unwrap();
        fs::create_dir_all(&claude_dir).unwrap();
        let source_link = claude_dir.join("external-skill");
        std::os::unix::fs::symlink(&external_target, &source_link).unwrap();

        let mut custom_paths = HashMap::new();
        custom_paths.insert("master".to_string(), master_dir.to_string_lossy().to_string());
        custom_paths.insert("claude-code".to_string(), claude_dir.to_string_lossy().to_string());

        assert_eq!(
            import_skill_to_master_with_mode(
                "claude-code",
                "external-skill",
                ImportMode::Auto,
                Some(&custom_paths),
            )
            .unwrap(),
            ImportResult::Success,
        );

        let master_skill = master_dir.join("external-skill");
        assert_eq!(fs::read_to_string(master_skill.join("reference.md")).unwrap(), "keep this external copy");
        assert!(is_valid_symlink_to(&source_link, &master_skill));
        assert_eq!(fs::read_to_string(external_target.join("reference.md")).unwrap(), "keep this external copy");

        let _ = fs::remove_dir_all(&tmp);
    }
}
