//! SHA-256 manifest fingerprint 计算。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.2。
//!
//! 拼 manifest: "<rel_path>\0<size>\0<sha256_hex>\n" 排序后整体 sha256。
//!
//! 本文件类型/函数由 T5+ 的 ClaudeCodeAdapter 消费；当前 crate 内尚未使用，
//! 允许 dead_code 以通过 `-D warnings`。

#![allow(dead_code)]

use std::path::PathBuf;
use thiserror::Error;

#[derive(Debug)]
pub struct FingerprintInput {
    pub root: PathBuf,
    pub comparable_extensions: &'static [&'static str],
    pub exclude_names: &'static [&'static str],
}

#[derive(Debug, Error)]
pub enum FingerprintError {
    #[error("io error: {0}")]
    Io(String),
}

/// 计算 deterministic fingerprint。
/// 返回 `(digest_hex, file_count)`。T7 阶段会包成 ContentFingerprint。
pub fn compute_fingerprint(input: &FingerprintInput) -> Result<(String, usize), FingerprintError> {
    use sha2::{Digest, Sha256};
    use walkdir::WalkDir;

    let mut entries: Vec<(String, u64, String)> = Vec::new();

    for entry in WalkDir::new(&input.root).follow_links(false) {
        let e = match entry {
            Ok(e) => e,
            Err(_) => continue, // spec §5.2 容错
        };
        if !e.file_type().is_file() {
            continue;
        }
        let path = e.path();
        let name = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n,
            None => continue,
        };
        // 排除名单
        if input.exclude_names.contains(&name) {
            continue;
        }
        // 扩展名白名单
        let ext = match path.extension().and_then(|s| s.to_str()) {
            Some(s) => s,
            None => continue,
        };
        if !input.comparable_extensions.contains(&ext) {
            continue;
        }

        // 相对路径
        let rel = match path.strip_prefix(&input.root) {
            Ok(r) => r.to_string_lossy().into_owned(),
            Err(_) => continue,
        };

        // 读 + 单文件 sha256
        let bytes = match std::fs::read(path) {
            Ok(b) => b,
            Err(e) => return Err(FingerprintError::Io(e.to_string())),
        };
        let size = bytes.len() as u64;
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let digest = format!("{:x}", hasher.finalize());

        entries.push((rel, size, digest));
    }

    // 排序: 按 rel 字典序
    entries.sort_by(|a, b| a.0.cmp(&b.0));

    // 拼 manifest, 整体 sha256
    let mut manifest_hasher = Sha256::new();
    for (rel, size, digest) in &entries {
        manifest_hasher.update(rel.as_bytes());
        manifest_hasher.update(b"\0");
        manifest_hasher.update(size.to_string().as_bytes());
        manifest_hasher.update(b"\0");
        manifest_hasher.update(digest.as_bytes());
        manifest_hasher.update(b"\n");
    }
    let final_digest = format!("{:x}", manifest_hasher.finalize());
    let file_count = entries.len();

    Ok((final_digest, file_count))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;

    fn make_skill(tmp: &Path, files: &[(&str, &str)]) {
        for (rel, content) in files {
            let p = tmp.join(rel);
            fs::create_dir_all(p.parent().unwrap()).unwrap();
            fs::write(&p, content).unwrap();
        }
    }

    fn default_input(root: &Path) -> FingerprintInput {
        FingerprintInput {
            root: root.to_path_buf(),
            comparable_extensions: &["md", "txt", "json", "yaml", "yml"],
            exclude_names: &[".DS_Store"],
        }
    }

    #[test]
    fn fingerprint_deterministic() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "name: foo\n"), ("refs/a.md", "a")]);
        let input = default_input(&tmp);
        let (d1, n1) = compute_fingerprint(&input).unwrap();
        let (d2, n2) = compute_fingerprint(&input).unwrap();
        assert_eq!(d1, d2);
        assert_eq!(n1, n2);
        assert_eq!(n1, 2);
    }

    #[test]
    fn fingerprint_changes_on_rename() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "x")]);
        let (d1, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        // 重命名
        fs::rename(tmp.join("SKILL.md"), tmp.join("SKILL2.md")).unwrap();
        let (d2, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_ne!(d1, d2);
    }

    #[test]
    fn fingerprint_changes_on_content() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "v1")]);
        let (d1, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        fs::write(tmp.join("SKILL.md"), "v2").unwrap();
        let (d2, _) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_ne!(d1, d2);
    }

    #[test]
    fn fingerprint_excludes_hidden() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "x"), (".DS_Store", "junk")]);
        let (_, n) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_eq!(n, 1, ".DS_Store 必须被排除");
    }

    #[test]
    fn fingerprint_skips_symlink() {
        let tmp = tempdir();
        make_skill(&tmp, &[("SKILL.md", "x")]);
        // 创建 symlink 指向 SKILL.md
        std::os::unix::fs::symlink(tmp.join("SKILL.md"), tmp.join("link.md")).unwrap();
        let (_, n) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_eq!(n, 1, "symlink 必须不 follow");
    }

    #[test]
    fn fingerprint_skips_png() {
        let tmp = tempdir();
        // 写一个 .png
        fs::write(tmp.join("img.png"), b"\x89PNG\r\n\x1a\n").unwrap();
        let (_, n) = compute_fingerprint(&default_input(&tmp)).unwrap();
        assert_eq!(n, 0, ".png 不在 comparable_extensions");
    }

    // ----- helpers -----

    fn tempdir() -> PathBuf {
        let base = std::env::temp_dir();
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = base.join(format!("asm-fp-{}-{}", pid, nanos));
        fs::create_dir_all(&p).unwrap();
        p
    }
}
