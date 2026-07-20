# ASM Project Overview

> 这是 ASM 项目的高层概述（产品定位、原则、MVP 路线图）。想了解如何跑起来或贡献代码，请看根目录 [`README.md`](../../README.md)。

---

# Agent Skill Manager

> Discover, organize, and keep Skills in sync across every AI Agent.

**Agent Skill Manager (ASM)** is a cross-platform desktop application for understanding and managing the Skills installed on your computer. It gives developers one clear view of their AI-agent capabilities—where each Skill is installed, whether copies match, and what needs attention.

## The problem

Modern development workflows often involve several AI agents: Claude Code, Codex, OpenCode, Aider, and others. Each agent stores and manages Skills independently.

That creates unnecessary uncertainty:

- Which Skills are installed for each agent?
- Is the same Skill missing from another agent?
- Are copies consistent, outdated, or manually changed?
- Which Skills are no longer useful?
- How can a preferred set of Skills be aligned safely across agents?

ASM is designed to answer these questions without turning Skill management into a collection of folders and scripts.

## Core capabilities

- **Discover** — scan supported AI agents and identify installed Skills automatically.
- **Inventory** — browse every Skill in one library, including its locations, source, and installation status.
- **Agent Matrix** — compare Skills across agents at a glance and spot missing or inconsistent installations.
- **Analyze** — surface synchronization gaps, duplicates, conflicts, and potentially unused Skills.
- **Sync & Align** — install, update, remove, or align Skills across selected agents with explicit, safe actions.
- **Health Operations** — make Skill state visible and actionable instead of leaving it hidden in local directories.

## Product principles

1. **Skills are assets, not files.** ASM manages the capability represented by a Skill—not merely a Markdown file in a directory.
2. **One global view.** Every supported agent contributes to a single, understandable inventory.
3. **Safe by default.** ASM detects differences before overwriting files and never silently replaces user changes.
4. **Agents remain independent.** ASM manages installations; it does not interfere with how an agent works or writes code.
5. **Sync should be intentional.** Users choose the source, targets, and action before changes are applied.
6. **Extensible by design.** Agent-specific behavior belongs in adapters so new agents can be supported without rewriting the core.

## MVP roadmap

### Milestone 0 — Discovery

- Detect supported agents on the local machine
- Scan their Skill locations
- Build a unified local inventory

### Milestone 1 — Visibility

- Dashboard with agent and Skill totals
- Searchable Skill library
- Agent Matrix for installation coverage and consistency

### Milestone 2 — Synchronization

- Install, update, and remove Skills across agents
- Preview changes before applying them
- Basic alignment workflows and conflict detection

### Milestone 3 — Operations

- Health checks for drift, duplicates, missing files, and conflicts
- Usage and lifecycle signals where agent data permits
- Improved adapter coverage and platform packaging

## Current status

ASM is in the **planning and architecture phase**. The first implementation milestone focuses on discovery: scanning a local machine and presenting a reliable inventory of installed Skills before any synchronization features are introduced.

The initial target is a desktop application built for macOS, Windows, and Linux, with a design that can support multiple agent ecosystems through dedicated adapters.

## Contributing

Ideas, product feedback, agent compatibility research, and implementation contributions are welcome. If you use multiple AI agents, the most valuable early feedback is practical:

- Which agents do you use?
- Where do they store Skills?
- How are Skills installed, updated, or disabled?
- What cross-agent management problem wastes the most time today?

Please open an issue to share findings, discuss a supported agent, or propose an improvement.

---

**ASM** — one place for every agent skill.
