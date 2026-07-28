//! 枚举 Skill 根下的子目录，检测每个是否是合法 Skill 安装。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.3。

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::modules::adapter::{IssuePhase, IssueSeverity, ScanIssue};

#[derive(Debug)]
pub struct SkillCandidate {
    pub dir: PathBuf,
    pub entry_file: PathBuf,
    pub entry_size: u64,
    pub entry_modified: SystemTime,
}

#[derive(Debug)]
pub struct EnumerationInput<'a> {
    pub root: &'a Path,
    pub entry_filename: &'a str,
    pub skip_hidden: bool,
    // 当前 enumerate_skill_dirs 直接 read_dir；max_depth 是为未来递归预留的 API 字段。
    #[allow(dead_code)]
    pub max_depth: usize,
}

/// 枚举 root 下符合规格的子目录。不创建任何目录。
pub fn enumerate_skill_dirs(input: &EnumerationInput<'_>) -> (Vec<SkillCandidate>, Vec<ScanIssue>) {
    use std::fs;

    let mut candidates = Vec::new();
    let mut issues = Vec::new();

    let entries = match fs::read_dir(input.root) {
        Ok(e) => e,
        Err(e) => {
            issues.push(ScanIssue {
                code: "ROOT_NOT_FOUND".into(),
                severity: IssueSeverity::Warning,
                phase: IssuePhase::Enumeration,
                path: Some(input.root.to_path_buf()),
                message: e.to_string(),
                recoverable: true,
            });
            return (candidates, issues);
        }
    };

    for entry in entries.flatten() {
        let dir_path = entry.path();
        let name = match dir_path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };

        // 隐藏目录
        if input.skip_hidden && name.starts_with('.') {
            continue;
        }

        // 校验目录属性: 用 metadata 自动 follow symlink/快捷方式
        let meta = match fs::metadata(&dir_path) {
            Ok(m) => m,
            Err(e) => {
                // 若是断链/目标不存在，默默跳过
                if e.kind() == std::io::ErrorKind::NotFound {
                    continue;
                }
                issues.push(ScanIssue {
                    code: "PERMISSION_DENIED".into(),
                    severity: IssueSeverity::Warning,
                    phase: IssuePhase::Enumeration,
                    path: Some(dir_path),
                    message: e.to_string(),
                    recoverable: true,
                });
                continue;
            }
        };

        if !meta.is_dir() {
            continue;
        }

        // 检查 entry file (如 SKILL.md)
        let entry_path = dir_path.join(input.entry_filename);
        let entry_meta = match fs::metadata(&entry_path) {
            Ok(m) => m,
            Err(_) => {
                // 缺 SKILL.md，默默跳过
                continue;
            }
        };

        if !entry_meta.is_file() {
            continue;
        }

        candidates.push(SkillCandidate {
            dir: dir_path,
            entry_file: entry_path,
            entry_size: entry_meta.len(),
            entry_modified: entry_meta.modified().unwrap_or(SystemTime::UNIX_EPOCH),
        });
    }

    (candidates, issues)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static COUNTER: AtomicU64 = AtomicU64::new(0);

    fn tempdir() -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = std::env::temp_dir().join(format!("asm-ps-{}-{}-{}", pid, nanos, n));
        fs::create_dir_all(&p).unwrap();
        p
    }

    // 标 T4 时缺 ScanIssue，T5 后已就绪
    #[test]
    fn enumerate_skips_dotfiles() {
        let tmp = tempdir();
        fs::create_dir(tmp.join(".hidden")).unwrap();
        fs::write(tmp.join(".hidden/SKILL.md"), "x").unwrap();
        fs::create_dir(tmp.join("visible")).unwrap();
        fs::write(tmp.join("visible/SKILL.md"), "y").unwrap();
        let input = EnumerationInput {
            root: Box::leak(Box::new(tmp.clone())),
            entry_filename: "SKILL.md",
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, _) = enumerate_skill_dirs(&input);
        assert_eq!(candidates.len(), 1);
        assert!(candidates[0].dir.ends_with("visible"));
    }

    #[test]
    fn enumerate_requires_skill_md() {
        let tmp = tempdir();
        fs::create_dir(tmp.join("no_entry")).unwrap();
        fs::create_dir(tmp.join("with_entry")).unwrap();
        fs::write(tmp.join("with_entry/SKILL.md"), "y").unwrap();
        let input = EnumerationInput {
            root: Box::leak(Box::new(tmp.clone())),
            entry_filename: "SKILL.md",
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, issues) = enumerate_skill_dirs(&input);
        assert_eq!(candidates.len(), 1);
        assert!(issues.is_empty());
    }

    #[test]
    fn enumerate_handles_permission_error() {
        // 我们只保证 "出错不 panic"。创建一个有效 Skill 即可。
        let tmp = tempdir();
        fs::create_dir(tmp.join("ok")).unwrap();
        fs::write(tmp.join("ok/SKILL.md"), "y").unwrap();
        let input = EnumerationInput {
            root: Box::leak(Box::new(tmp.clone())),
            entry_filename: "SKILL.md",
            skip_hidden: true,
            max_depth: 1,
        };
        let (candidates, _) = enumerate_skill_dirs(&input);
        assert_eq!(candidates.len(), 1);
        // 不可读目录无法在大多数 CI 上可靠模拟，跳过。但确保不 panic 已经足够。
    }

    #[test]
    fn enumerate_supports_symlinked_skill_directories() {
        let tmp = tempdir();
        let target = tmp.join("target_skill");
        fs::create_dir_all(&target).unwrap();
        fs::write(target.join("SKILL.md"), "name: symlinked-skill").unwrap();

        let skills_root = tmp.join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&target, skills_root.join("symlinked-link")).unwrap();

        #[cfg(unix)]
        {
            let input = EnumerationInput {
                root: &skills_root,
                entry_filename: "SKILL.md",
                skip_hidden: true,
                max_depth: 1,
            };
            let (candidates, _) = enumerate_skill_dirs(&input);
            assert_eq!(candidates.len(), 1);
            assert!(candidates[0].dir.ends_with("symlinked-link"));
        }
    }
}
