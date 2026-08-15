//! MiniMax Code CLI adapter.
//!
//! MiniMax Code stores skills in:
//! - User skills: `$HOME/.minimax-code/skills` (primary) or `$HOME/.minimax/skills`
//! - Built-in skills: `$HOME/.minimax/.builtin-skills` or `$HOME/.minimax/builtin/skills`
//! - Shared skills fallback: `$HOME/.agents/skills`

use std::collections::HashSet;
use std::time::SystemTime;

use super::{
    AgentAdapter, AgentDescriptor, AgentId, CapabilitySet, ClaudeCodeAdapter, CompareConfidence,
    DetectContext, DetectionResult, DetectionStatus, Platform, RootScope, ScanContext,
    ScanResult, SkillRoot, SupportLevel,
};
use crate::modules::platform::user_home_dir;

pub struct MiniMaxCodeAdapter;

impl AgentAdapter for MiniMaxCodeAdapter {
    fn id(&self) -> AgentId {
        AgentId("minimax-code".to_string())
    }

    fn descriptor(&self) -> AgentDescriptor {
        AgentDescriptor {
            agent_id: self.id(),
            adapter_id: "minimax-code@1".into(),
            display_name: "MiniMax Code".into(),
            supported_platforms: vec![Platform::MacOs, Platform::Linux, Platform::Windows],
            documentation_url: Some("https://github.com/MiniMax-AI/skills".into()),
            adapter_version: "0.1.0".into(),
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
            notes: vec!["user-scope $HOME/.minimax-code/skills & $HOME/.minimax/.builtin-skills".into()],
        }
    }

    fn detect(&self, ctx: &DetectContext) -> DetectionResult {
        let now = SystemTime::now();

        if let Some(custom_path) = ctx.custom_path {
            if !custom_path.as_os_str().is_empty() {
                let exists = std::fs::metadata(custom_path).is_ok()
                    || std::fs::symlink_metadata(custom_path).is_ok();
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
                }
            }
        }

        let home = if !ctx.platform.home_dir.as_os_str().is_empty() {
            ctx.platform.home_dir.clone()
        } else {
            user_home_dir().unwrap_or_default()
        };

        let base_dir = home.join(".minimax-code");
        let alt_base_dir = home.join(".minimax");
        let user_skills = base_dir.join("skills");
        let alt_user_skills = alt_base_dir.join("skills");
        let builtin_skills = alt_base_dir.join(".builtin-skills");
        let alt_builtin_skills = alt_base_dir.join("builtin").join("skills");

        let base_present = std::fs::metadata(&base_dir).is_ok()
            || std::fs::symlink_metadata(&base_dir).is_ok()
            || std::fs::metadata(&alt_base_dir).is_ok()
            || std::fs::symlink_metadata(&alt_base_dir).is_ok();

        let mut candidate_roots = Vec::new();

        // 1. 用户/全局主技能目录（优先 ~/.minimax-code/skills，回退 ~/.minimax/skills）
        if std::fs::metadata(&user_skills).is_ok() || std::fs::symlink_metadata(&user_skills).is_ok() {
            candidate_roots.push((user_skills, "user-skills".to_string(), RootScope::User));
        } else if std::fs::metadata(&alt_user_skills).is_ok() || std::fs::symlink_metadata(&alt_user_skills).is_ok() {
            candidate_roots.push((alt_user_skills, "user-skills".to_string(), RootScope::User));
        }

        // 2. 官方内置技能目录（~/.minimax/.builtin-skills）
        if std::fs::metadata(&builtin_skills).is_ok() || std::fs::symlink_metadata(&builtin_skills).is_ok() {
            candidate_roots.push((builtin_skills, "builtin-skills".to_string(), RootScope::User));
        } else if std::fs::metadata(&alt_builtin_skills).is_ok() || std::fs::symlink_metadata(&alt_builtin_skills).is_ok() {
            candidate_roots.push((alt_builtin_skills, "builtin-skills".to_string(), RootScope::User));
        }

        let mut roots = Vec::new();
        let mut seen_paths = HashSet::new();
        for (path, root_id, scope) in candidate_roots {
            let present = std::fs::metadata(&path).is_ok() || std::fs::symlink_metadata(&path).is_ok();
            let canonical_path = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
            if present && seen_paths.insert(canonical_path.clone()) {
                roots.push(SkillRoot {
                    root_id,
                    display_path: path,
                    canonical_path,
                    scope,
                });
            }
        }

        // 3. 若无专属目录，回退至 ~/.agents/skills 共享目录
        if roots.is_empty() {
            let shared_agents_dir = home.join(".agents").join("skills");
            if std::fs::metadata(&shared_agents_dir).is_ok() || std::fs::symlink_metadata(&shared_agents_dir).is_ok() {
                let canonical_path = std::fs::canonicalize(&shared_agents_dir).unwrap_or_else(|_| shared_agents_dir.clone());
                roots.push(SkillRoot {
                    root_id: "shared-skills".into(),
                    display_path: shared_agents_dir,
                    canonical_path,
                    scope: RootScope::User,
                });
            }
        }

        let status = if base_present || !roots.is_empty() {
            DetectionStatus::Detected
        } else {
            DetectionStatus::Unavailable
        };

        DetectionResult {
            agent: self.id(),
            status,
            roots,
            issues: vec![],
            observed_at: now,
        }
    }

    fn skill_roots(&self, det: &DetectionResult) -> Vec<SkillRoot> {
        det.roots.clone()
    }

    fn scan(&self, ctx: &ScanContext) -> ScanResult {
        let mut result = ClaudeCodeAdapter.scan(ctx);
        result.agent_id = self.id();
        for installation in &mut result.installations {
            installation.agent_id = self.id();
            installation.adapter_id = "minimax-code@1".into();
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::modules::adapter::{Platform, PlatformContext};

    #[test]
    fn descriptor_matches_contract() {
        let adapter = MiniMaxCodeAdapter;
        let descriptor = adapter.descriptor();
        assert_eq!(descriptor.agent_id.0, "minimax-code");
        assert_eq!(descriptor.display_name, "MiniMax Code");
    }

    #[test]
    fn detects_minimax_code_when_skills_exist() {
        let temp = std::env::temp_dir().join(format!("minimax-detect-test-{}", std::process::id()));
        let skills_dir = temp.join(".minimax-code").join("skills");
        std::fs::create_dir_all(&skills_dir).unwrap();

        let adapter = MiniMaxCodeAdapter;
        let ctx = DetectContext {
            platform: &PlatformContext {
                platform: Platform::MacOs,
                home_dir: temp.clone(),
                cwd: temp.clone(),
            },
            custom_path: None,
        };

        let result = adapter.detect(&ctx);
        assert_eq!(result.status, DetectionStatus::Detected);
        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].display_path, skills_dir);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn detects_minimax_code_builtin_skills() {
        let temp = std::env::temp_dir().join(format!("minimax-builtin-test-{}", std::process::id()));
        let user_skills = temp.join(".minimax-code").join("skills");
        let builtin_skills = temp.join(".minimax").join(".builtin-skills");
        std::fs::create_dir_all(&user_skills).unwrap();
        std::fs::create_dir_all(&builtin_skills).unwrap();

        let adapter = MiniMaxCodeAdapter;
        let ctx = DetectContext {
            platform: &PlatformContext {
                platform: Platform::MacOs,
                home_dir: temp.clone(),
                cwd: temp.clone(),
            },
            custom_path: None,
        };

        let result = adapter.detect(&ctx);
        assert_eq!(result.status, DetectionStatus::Detected);
        assert_eq!(result.roots.len(), 2);

        let _ = std::fs::remove_dir_all(&temp);
    }

    #[test]
    fn detects_minimax_code_from_shared_agents_skills() {
        let temp = std::env::temp_dir().join(format!("minimax-shared-test-{}", std::process::id()));
        let skills_dir = temp.join(".agents").join("skills");
        std::fs::create_dir_all(&skills_dir).unwrap();

        let adapter = MiniMaxCodeAdapter;
        let ctx = DetectContext {
            platform: &PlatformContext {
                platform: Platform::MacOs,
                home_dir: temp.clone(),
                cwd: temp.clone(),
            },
            custom_path: None,
        };

        let result = adapter.detect(&ctx);
        assert_eq!(result.status, DetectionStatus::Detected);
        assert_eq!(result.roots.len(), 1);
        assert_eq!(result.roots[0].display_path, skills_dir);

        let _ = std::fs::remove_dir_all(&temp);
    }
}
