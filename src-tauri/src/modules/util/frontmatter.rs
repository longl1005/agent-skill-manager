//! YAML frontmatter 解析，输出 ParsedFrontmatter。
//! 见 docs/superpowers/specs/2026-07-20-claude-code-adapter-design.md §6.1。
//!
//! 本文件类型/函数由 T5+ 的 ClaudeCodeAdapter 消费；当前 crate 内尚未使用，
//! 允许 dead_code 以通过 `-D warnings`。

#![allow(dead_code)]

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Default, Serialize)]
pub struct ParsedFrontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub license: Option<String>,
    pub raw: Option<serde_json::Value>,
}

#[derive(Debug, Error)]
pub enum FrontmatterError {
    #[error("missing --- delimiters")]
    MissingDelimiters,
    #[error("empty frontmatter body")]
    EmptyBody,
    #[error("yaml parse error: {0}")]
    YamlParse(String),
}

/// 解析 `---` 包围的 YAML frontmatter。允许 frontmatter 完全缺失（返回 Default）。
pub fn parse_frontmatter(text: &str) -> Result<ParsedFrontmatter, FrontmatterError> {
    // 找第一个 --- 起始
    let lines: Vec<&str> = text.lines().collect();
    let start_idx = lines
        .iter()
        .position(|l| l.trim() == "---")
        .ok_or(FrontmatterError::MissingDelimiters)?;

    // 找下一个 --- 结束
    let end_idx = lines
        .iter()
        .skip(start_idx + 1)
        .position(|l| l.trim() == "---")
        .ok_or(FrontmatterError::MissingDelimiters)?;

    let body_lines = &lines[start_idx + 1..start_idx + 1 + end_idx];
    if body_lines.is_empty() {
        return Err(FrontmatterError::EmptyBody);
    }
    let body = body_lines.join("\n");

    // YAML -> JSON Value
    let value: serde_json::Value =
        serde_yml::from_str(&body).map_err(|e| FrontmatterError::YamlParse(e.to_string()))?;

    // 抽取标量字段
    let mut r = ParsedFrontmatter::default();
    if let Some(obj) = value.as_object() {
        r.name = obj.get("name").and_then(|v| v.as_str()).map(String::from);
        r.description = obj
            .get("description")
            .and_then(|v| v.as_str())
            .map(String::from);
        r.license = obj
            .get("license")
            .and_then(|v| v.as_str())
            .map(String::from);
    }
    r.raw = Some(value);
    Ok(r)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_frontmatter_basic() {
        let text = "---\nname: foo\ndescription: bar skill\nlicense: MIT\n---\nbody text\n";
        let r = parse_frontmatter(text).unwrap();
        assert_eq!(r.name.as_deref(), Some("foo"));
        assert_eq!(r.description.as_deref(), Some("bar skill"));
        assert_eq!(r.license.as_deref(), Some("MIT"));
    }

    #[test]
    fn parse_frontmatter_missing_delim() {
        // 没有 --- 起始
        let r = parse_frontmatter("name: foo\n---\n");
        assert!(matches!(r, Err(FrontmatterError::MissingDelimiters)));
    }

    #[test]
    fn parse_frontmatter_yaml_error() {
        // 坏语法
        let r = parse_frontmatter("---\nname: : :\n---\n");
        assert!(matches!(r, Err(FrontmatterError::YamlParse(_))));
    }

    #[test]
    fn parse_frontmatter_extra_fields() {
        // 未知字段进 raw 不报错
        let text = "---\nname: foo\ncustom_field: hello\n---\nbody\n";
        let r = parse_frontmatter(text).unwrap();
        assert_eq!(r.name.as_deref(), Some("foo"));
        let raw = r.raw.expect("raw should be Some");
        assert_eq!(raw["custom_field"], "hello");
    }

    #[test]
    fn parse_frontmatter_empty_body() {
        let r = parse_frontmatter("---\n---\nbody\n");
        assert!(matches!(r, Err(FrontmatterError::EmptyBody)));
    }
}
