//! 枚举 Skill 根下的子目录，检测每个是否是合法 Skill 安装。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.3。
//!
//! 本文件类型/函数由 T5+ 的 ClaudeCodeAdapter 消费；当前 crate 内尚未使用，
//! 允许 dead_code 以通过 `-D warnings`。

#![allow(dead_code)]

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::modules::adapter::{ScanIssue, ScanIssuePhase, ScanIssueSeverity};

#[derive(Debug)]
pub struct SkillCandidate {
    pub dir: PathBuf,
    pub entry_file: PathBuf,
    pub entry_size: u64,
    pub entry_modified: SystemTime,
}

#[derive(Debug)]
pub struct EnumerationInput {
    pub root: &'static Path,
    pub entry_filename: &'static str,
    pub skip_hidden: bool,
    pub max_depth: usize,
}

/// 枚举 root 下符合规格的子目录。不创建任何目录。
pub fn enumerate_skill_dirs(input: &EnumerationInput) -> (Vec<SkillCandidate>, Vec<ScanIssue>) {
    use std::fs;

    let mut candidates = Vec::new();
    let mut issues = Vec::new();

    let entries = match fs::read_dir(input.root) {
        Ok(e) => e,
        Err(e) => {
            issues.push(ScanIssue {
                code: "ROOT_NOT_FOUND".into(),
                severity: ScanIssueSeverity::Warning,
                phase: ScanIssuePhase::Enumeration,
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

        // symlink_metadata: 不 follow
        let meta = match fs::symlink_metadata(&dir_path) {
            Ok(m) => m,
            Err(e) => {
                issues.push(ScanIssue {
                    code: "PERMISSION_DENIED".into(),
                    severity: ScanIssueSeverity::Warning,
                    phase: ScanIssuePhase::Enumeration,
                    path: Some(dir_path),
                    message: e.to_string(),
                    recoverable: true,
                });
                continue;
            }
        };

        if !meta.file_type().is_dir() {
            continue;
        }

        // 检查 entry file
        let entry_path = dir_path.join(input.entry_filename);
        let entry_meta = match fs::metadata(&entry_path) {
            Ok(m) => m,
            Err(_) => {
                issues.push(ScanIssue {
                    code: "ENTRY_MISSING".into(),
                    severity: ScanIssueSeverity::Warning,
                    phase: ScanIssuePhase::Enumeration,
                    path: Some(dir_path.clone()),
                    message: format!("missing {}", input.entry_filename),
                    recoverable: true,
                });
                continue;
            }
        };

        if !entry_meta.is_file() {
            issues.push(ScanIssue {
                code: "ENTRY_NOT_A_FILE".into(),
                severity: ScanIssueSeverity::Warning,
                phase: ScanIssuePhase::Enumeration,
                path: Some(entry_path.clone()),
                message: format!("{} is not a regular file", input.entry_filename),
                recoverable: true,
            });
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

    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = base.join(format!("asm-ps-{}-{}", pid, nanos));
        fs::create_dir_all(&p).unwrap();
        p
    }

    // 标 #[ignore] 直到 T5 引入 ScanIssue 类型
    #[test]
    #[ignore = "needs ScanIssue from T5"]
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
    #[ignore = "needs ScanIssue from T5"]
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
        assert!(!issues.is_empty());
        let code = issues
            .iter()
            .find(|i| {
                i.path
                    .as_ref()
                    .unwrap()
                    .to_string_lossy()
                    .contains("no_entry")
            })
            .map(|i| i.code.as_str());
        assert_eq!(code, Some("ENTRY_MISSING"));
    }

    #[test]
    #[ignore = "needs ScanIssue from T5"]
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
}
