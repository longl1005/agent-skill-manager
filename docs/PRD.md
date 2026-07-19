# Product Requirements Document

## 1. Product Background

AI developers increasingly use multiple agents—such as Claude Code, Codex, Aider, and OpenCode. Each agent stores and manages its skills independently, leaving users without a clear view of the skills installed across their computer.

Agent Skill Manager (ASM) is a desktop application that provides one place to discover, manage, analyze, and synchronize AI Agent Skills.

## 2. User Problems

Users need answers to practical questions that current agents do not solve together:

- Which agents are installed on this computer, and how many skills does each contain?
- Where is a particular skill installed?
- Which skills are duplicated, missing from an agent, or inconsistent across agents?
- Which skills are no longer used and may be candidates for cleanup?
- How can a skill be aligned across selected agents safely?

## 3. Product Positioning

ASM is a local-first desktop operations tool for AI Agent Skills.

It does not replace an agent or an editor. It gives users a unified inventory and operational view of their skills, then helps them keep those skills organized, visible, and synchronized across supported agents.

**Core value:** Discover. Organize. Analyze. Sync.

## 4. Target Users

- Developers who use two or more AI coding agents.
- Power users who install and maintain many third-party or custom skills.
- Teams and individual builders who want a consistent local skill setup across agents.

## 5. Core Use Cases

1. **Discover local skills**  
   Scan supported AI agents and show the skills found in their local directories.

2. **Review the skill inventory**  
   Browse a unified library of skills and see where each skill is installed.

3. **Compare agent coverage**  
   View an Agent × Skill matrix to identify installed, missing, duplicated, or inconsistent skills.

4. **Analyze operational status**  
   Surface skills that require synchronization, have conflicting content, are duplicated, or appear unused.

5. **Align skills across agents**  
   Select a skill and synchronize it to selected compatible agents after previewing the proposed changes.

## 6. MVP Scope

The first release focuses on a read-first inventory experience, with carefully scoped synchronization.

- Detect supported local agents, starting with Claude Code and Codex.
- Scan configured skill directories without modifying user files.
- Index agents, skills, and installations locally.
- Display agent-level skill counts and a unified skill library.
- Provide an Agent × Skill matrix.
- Detect same-name skills with different content, duplicate installations, and missing coverage.
- Provide search and basic filters.
- Preview and perform explicit, user-confirmed synchronization for supported skill formats.

## 7. Non Goals

The MVP will not include:

- A built-in Markdown or Skill editor.
- AI-generated or AI-rewritten skills.
- An online marketplace or skill ratings.
- User accounts, cloud sync, or team collaboration.
- Management of MCP servers, prompts, rules, commands, or other agent assets.
- Automatic conflict resolution or silent file overwrites.
- Usage analytics that depend on parsing agent execution logs.

## 8. MVP Acceptance Criteria

ASM MVP is successful when a user can:

- Detect at least Claude Code and Codex on a supported desktop platform.
- See the number of skills discovered for each detected agent.
- Browse a unified inventory of discovered skills and their installation paths.
- View a matrix showing whether each skill is installed for each detected agent.
- Identify skills with the same name but different content.
- Identify skills missing from selected compatible agents.
- Preview sync actions and explicitly confirm them before any file is changed.
- Complete a scan without modifying existing skill files.
