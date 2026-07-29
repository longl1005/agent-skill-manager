//! Cline Agent Adapter 真实实现。

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, CompareConfidence, ContentFingerprint,
    DetectContext, DetectionResult, DetectionStatus, EntryDescriptor, IdentitySource, IssuePhase,
    IssueSeverity, LocationDescriptor, NormalizedSkillMetadata, Platform, PlatformContext,
    RootScope, ScanCompleteness, ScanContext, ScanId, ScanIssue, ScanOutcome, ScanResult,
    SkillFormatDescriptor, SkillIdentityEvidence, SkillInstallation, SkillRoot, SupportLevel,
};
use crate::modules::platform::user_home_dir;
use crate::modules::util::{
    compute_fingerprint, enumerate_skill_dirs, parse_frontmatter, EnumerationInput,
    FingerprintInput,
};

const ADAPTER_VERSION: &str = "0.1.0";
const ENTRY_FILENAME: &str = "SKILL.md";
const COMPARABLE_EXTS: &[&str] = &["md", "txt", "json", "yaml", "yml"];
const EXCLUDE_NAMES: &[&str] = &[".DS_Store"];

pub struct ClineAdapter;

impl AgentAdapter for ClineAdapter {
    fn id(&self) -> AgentId {
        AgentId("cline".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "cline@1".to_string(),
            display_name: "Cline".to_string(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://github.com/cline/cline".to_string()),
            adapter_version: ADAPTER_VERSION.to_string(),
        }
    }

    fn capabilities(&self) -> CapabilitySet {
        CapabilitySet {
            detect: SupportLevel::Supported,
            scan: SupportLevel::Supported,
            compare_content: CompareConfidence::Reliable,
            watch: SupportLevel::Unsupported,
            install_planning: SupportLevel::Unsupported,
            uninstall_planning: SupportLevel::Unsupported,
            update_planning: SupportLevel::Unsupported,
            sync_planning: SupportLevel::Unsupported,
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            notes: vec!["user-scope $HOME/.cline/skills".to_string()],
        }
    }

    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        let now = SystemTime::now();

        if let Some(custom_path) = ctx.custom_path {
            if !custom_path.as_os_str().is_empty() {
                let exists = std::fs::metadata(custom_path).is_ok() || std::fs::symlink_metadata(custom_path).is_ok();
                if exists {
                    return DetectionResult {
                        agent: self.id(),
                        status: DetectionStatus::Detected,
                        roots: vec![SkillRoot {
                            root_id: "custom-skills".into(),
                            display_path: custom_path.to_path_buf(),
                            canonical_path: custom_path.to_path_buf(),
                            scope: RootScope::Custom,
                        }],
                        issues: vec![],
                        observed_at: now,
                    };
                } else {
                    return DetectionResult {
                        agent: self.id(),
                        status: DetectionStatus::Failed,
                        roots: vec![],
                        issues: vec![ScanIssue {
                            code: "CUSTOM_PATH_NOT_FOUND".into(),
                            severity: IssueSeverity::Error,
                            phase: IssuePhase::Detect,
                            path: Some(custom_path.to_path_buf()),
                            message: format!("Custom path does not exist: {}", custom_path.display()),
                            recoverable: true,
                        }],
                        observed_at: now,
                    };
                }
            }
        }
        let home = if !ctx.platform.home_dir.as_os_str().is_empty() {
            ctx.platform.home_dir.clone()
        } else {
            match user_home_dir() {
                Some(h) => h,
                None => {
                    return DetectionResult {
                        agent: self.id(),
                        status: DetectionStatus::Failed,
                        roots: vec![],
                        issues: vec![ScanIssue {
                            code: "HOME_UNAVAILABLE".into(),
                            severity: IssueSeverity::Error,
                            phase: IssuePhase::Detect,
                            path: None,
                            message: "dirs::home_dir() returned None".into(),
                            recoverable: false,
                        }],
                        observed_at: now,
                    };
                }
            }
        };

        let candidate_roots = [
            home.join(".cline").join("skills"),
            home.join(".config").join("cline").join("skills"),
        ];

        let mut roots = Vec::new();
        for path in &candidate_roots {
            let present = std::fs::metadata(path).is_ok() || std::fs::symlink_metadata(path).is_ok();
            if present {
                roots.push(SkillRoot {
                    root_id: "user-skills".into(),
                    display_path: path.clone(),
                    canonical_path: path.clone(),
                    scope: RootScope::User,
                });
                break;
            }
        }

        let status = if !roots.is_empty() {
            DetectionStatus::Detected
        } else {
            DetectionStatus::Unavailable
        };

        let mut issues = Vec::new();
        if matches!(status, DetectionStatus::Unavailable) {
            issues.push(ScanIssue {
                code: "NO_SKILLS_ROOTS".into(),
                severity: IssueSeverity::Info,
                phase: IssuePhase::Detect,
                path: None,
                message: "no Cline Skills roots found".into(),
                recoverable: true,
            });
        }

        DetectionResult {
            agent: self.id(),
            status,
            roots,
            issues,
            observed_at: now,
        }
    }

    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }

    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        let started_at = ctx.started_at;
        let mut installations = Vec::new();
        let mut issues = Vec::new();

        for root in ctx.roots {
            let input = EnumerationInput {
                root: &root.canonical_path,
                entry_filename: ENTRY_FILENAME,
                skip_hidden: true,
                max_depth: 1,
            };
            let (candidates, enum_issues) = enumerate_skill_dirs(&input);
            issues.extend(enum_issues);

            for cand in candidates {
                let bytes = match std::fs::read(&cand.entry_file) {
                    Ok(b) => b,
                    Err(e) => {
                        issues.push(ScanIssue {
                            code: "READ_FAILED".into(),
                            severity: IssueSeverity::Warning,
                            phase: IssuePhase::Read,
                            path: Some(cand.entry_file.clone()),
                            message: e.to_string(),
                            recoverable: true,
                        });
                        continue;
                    }
                };
                let text = match String::from_utf8(bytes) {
                    Ok(t) => t,
                    Err(e) => {
                        issues.push(ScanIssue {
                            code: "NOT_UTF8".into(),
                            severity: IssueSeverity::Warning,
                            phase: IssuePhase::Read,
                            path: Some(cand.entry_file.clone()),
                            message: e.to_string(),
                            recoverable: true,
                        });
                        continue;
                    }
                };

                let fm = match parse_frontmatter(&text) {
                    Ok(fm) => fm,
                    Err(e) => {
                        issues.push(ScanIssue {
                            code: "FRONTMATTER_INVALID".into(),
                            severity: IssueSeverity::Warning,
                            phase: IssuePhase::Parse,
                            path: Some(cand.entry_file.clone()),
                            message: format!("{:?}", e),
                            recoverable: true,
                        });
                        let dir_name = cand
                            .dir
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        let inst = build_installation(
                            self.id(),
                            root.root_id.clone(),
                            &cand,
                            &dir_name,
                            None,
                            IdentitySource::DirectoryName,
                        );
                        installations.push(inst);
                        continue;
                    }
                };

                let fp_input = FingerprintInput {
                    root: cand.dir.clone(),
                    comparable_extensions: COMPARABLE_EXTS,
                    exclude_names: EXCLUDE_NAMES,
                };
                let fp = match compute_fingerprint(&fp_input) {
                    Ok((digest, file_count)) => ContentFingerprint {
                        algorithm: "sha256",
                        version: 1,
                        scope: "ComparableEntry",
                        digest,
                        file_count,
                    },
                    Err(e) => {
                        issues.push(ScanIssue {
                            code: "FINGERPRINT_FAILED".into(),
                            severity: IssueSeverity::Warning,
                            phase: IssuePhase::Fingerprint,
                            path: Some(cand.dir.clone()),
                            message: format!("{:?}", e),
                            recoverable: true,
                        });
                        continue;
                    }
                };

                let (name, source) = match fm.name.clone() {
                    Some(n) => (n, IdentitySource::FrontmatterName),
                    None => {
                        let n = cand
                            .dir
                            .file_name()
                            .and_then(|s| s.to_str())
                            .unwrap_or("unknown")
                            .to_string();
                        (n, IdentitySource::DirectoryName)
                    }
                };

                let inst = build_installation_full(
                    self.id(),
                    root.root_id.clone(),
                    &cand,
                    &name,
                    fm.name.clone(),
                    fm.description.clone().unwrap_or_default(),
                    fm.license.clone(),
                    fm.raw.clone(),
                    Some(fp),
                    source,
                );
                installations.push(inst);
            }
        }

        installations.sort_by(|a, b| a.identity.normalized_name.cmp(&b.identity.normalized_name));

        let outcome = if issues
            .iter()
            .any(|i| matches!(i.severity, IssueSeverity::Error))
        {
            ScanOutcome::Failed
        } else if !issues.is_empty() {
            ScanOutcome::CompletedWithIssues
        } else {
            ScanOutcome::Completed
        };

        ScanResult {
            scan_id: ctx.scan_id,
            agent_id: self.id(),
            outcome,
            completeness: ScanCompleteness::Complete,
            installations,
            issues,
            started_at,
            completed_at: SystemTime::now(),
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn build_installation(
    agent_id: AgentId,
    root_id: String,
    cand: &crate::modules::util::SkillCandidate,
    name: &str,
    declared_name: Option<String>,
    source: IdentitySource,
) -> SkillInstallation {
    build_installation_full(
        agent_id,
        root_id,
        cand,
        name,
        declared_name,
        String::new(),
        None,
        None,
        None,
        source,
    )
}

#[allow(clippy::too_many_arguments)]
fn build_installation_full(
    agent_id: AgentId,
    root_id: String,
    cand: &crate::modules::util::SkillCandidate,
    name: &str,
    declared_name: Option<String>,
    description: String,
    license: Option<String>,
    raw_metadata: Option<serde_json::Value>,
    content_fingerprint: Option<ContentFingerprint>,
    source: IdentitySource,
) -> SkillInstallation {
    SkillInstallation {
        agent_id: agent_id.clone(),
        adapter_id: "cline@1".into(),
        root_id,
        location: LocationDescriptor {
            display_path: cand.dir.clone(),
            canonical_path: cand.dir.clone(),
        },
        format: SkillFormatDescriptor {
            id: "cline-skill".into(),
            display_name: "Cline Skill".into(),
            entry_file: ENTRY_FILENAME.into(),
        },
        identity: SkillIdentityEvidence {
            normalized_name: name.to_string(),
            declared_name,
            source,
        },
        entry: EntryDescriptor {
            path: cand.entry_file.clone(),
            size: cand.entry_size,
            modified: cand.entry_modified,
        },
        metadata: NormalizedSkillMetadata {
            name: name.to_string(),
            description,
            license,
            raw_metadata,
        },
        content_fingerprint,
        comparison_confidence: CompareConfidence::Reliable,
        observed_at: SystemTime::now(),
        diagnostics: vec![],
    }
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
        let nanos = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let p = std::env::temp_dir().join(format!("asm-cline-{}-{}-{}", pid, nanos, n));
        fs::create_dir_all(&p).unwrap();
        p
    }

    fn fake_platform(home: &Path, cwd: &Path) -> PlatformContext {
        PlatformContext {
            platform: Platform::MacOs,
            home_dir: home.to_path_buf(),
            cwd: cwd.to_path_buf(),
        }
    }

    #[test]
    fn cline_detect_only_user() {
        let tmp = tempdir();
        let home = tmp.join("home");
        let skills = home.join(".cline/skills");
        fs::create_dir_all(&skills).unwrap();
        let cwd = tmp.join("cwd");
        fs::create_dir_all(&cwd).unwrap();
        let ctx = DetectContext {
            platform: Box::leak(Box::new(fake_platform(&home, &cwd))),
            custom_path: None,
        };
        let r = ClineAdapter.detect(&ctx);
        assert_eq!(r.status, DetectionStatus::Detected);
        assert_eq!(r.roots.len(), 1);
        assert_eq!(r.roots[0].scope, RootScope::User);
    }

    #[test]
    fn cline_detect_neither() {
        let tmp = tempdir();
        let home = tmp.join("home");
        fs::create_dir_all(&home).unwrap();
        let cwd = tmp.join("cwd");
        fs::create_dir_all(&cwd).unwrap();
        let ctx = DetectContext {
            platform: Box::leak(Box::new(fake_platform(&home, &cwd))),
            custom_path: None,
        };
        let r = ClineAdapter.detect(&ctx);
        assert_eq!(r.status, DetectionStatus::Unavailable);
    }
}
