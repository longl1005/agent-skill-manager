# ASM Architecture

## 1. Architecture Goals and Design Principles

Agent Skill Manager (ASM) is a local-first desktop application that gives users a unified inventory and operational view of Skills installed across AI coding agents.

The MVP architecture is designed to:

- Discover supported agents and their local Skill directories.
- Scan and index Skills without changing the user's existing files.
- Present an accurate Agent × Skill inventory, including content differences and missing coverage.
- Keep agent-specific filesystem conventions isolated behind adapters.
- Support Windows, macOS, and Linux from one shared codebase.
- Leave a clear, safe path to explicitly confirmed synchronization in a later MVP increment.

### Design Principles

1. **Read-first, write-explicit**  
   Scanning, indexing, analysis, and file watching are read-only. No user Skill file may be created, changed, moved, or deleted unless the user previews and explicitly confirms a future sync action.

2. **Local-first and private by default**  
   Skill metadata, scan results, hashes, and application settings live on the user's computer. The MVP does not require an account, cloud service, or telemetry.

3. **Adapters own agent differences**  
   The core application must not depend on a particular agent's directory layout, naming convention, or installation mechanism. Those details belong only to an Agent Adapter.

4. **Inventory before automation**  
   The source of truth in the MVP is the observed local filesystem. ASM first reports what exists, where it exists, and whether it differs; it does not assume a central managed copy.

5. **Explainable analysis**  
   Every status shown in the UI—missing, duplicate, inconsistent, or unsupported—must be traceable to stored scan data and a clear rule.

6. **Cross-platform core, isolated platform behavior**  
   Product logic is shared. Platform-specific path discovery, executable detection, file-system behavior, and shell integration are isolated behind small platform services.

7. **Safe extension over premature abstraction**  
   The MVP supports Claude Code and Codex first. The adapter contract must make additional agents possible without adding a plugin marketplace or a general scripting runtime.

## 2. Overall Layered Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ Desktop UI                                                     │
│ React + TypeScript                                             │
│ Dashboard · Library · Agents · Agent Matrix · Operations       │
└──────────────────────────────┬───────────────────────────────┘
                               │ Tauri commands / events
┌──────────────────────────────▼───────────────────────────────┐
│ Application / Core                                             │
│ Use cases · orchestration · validation · DTO mapping           │
└───────┬────────────────┬────────────────┬────────────────────┘
        │                │                │
┌───────▼───────┐ ┌──────▼───────┐ ┌──────▼──────────────────┐
│ Agent Adapter │ │ Scanner      │ │ Inventory / Analyzer     │
│ Registry      │ │              │ │                           │
└───────┬───────┘ └──────┬───────┘ └──────┬──────────────────┘
        │                │                │
┌───────▼────────────────▼────────────────▼──────────────────┐
│ Infrastructure                                                 │
│ Local filesystem · hashing · SQLite · File Watcher · platform │
└──────────────────────────────────────────────────────────────┘
                               │
                    Future: explicit Sync Engine
```

The Desktop UI never accesses agent directories or SQLite directly. It calls Tauri commands exposed by the application layer. Rust owns filesystem access, hashing, persistence, adapters, and platform integration.

## 3. Core Modules and Responsibilities

### Desktop UI

The React application provides the user-facing inventory and operations experience:

- Dashboard: detected agents, Skill totals, and actionable status summaries.
- Library: searchable, filterable, unified Skill inventory.
- Agents: per-agent discovery status, directory details, and installed Skills.
- Agent Matrix: Skill rows and Agent columns showing installation and analysis status.
- Operations: filtered views for missing coverage, duplicates, and inconsistencies.
- Sync preview: a future confirmation interface that shows proposed file changes before execution.

The UI requests data and actions through typed Tauri commands. It renders state returned by the core and reacts to scan or watcher events. It does not interpret agent-specific paths or implement scan rules.

### Application / Core

The application layer coordinates user intent and domain operations:

- Detect known agents through the Adapter Registry.
- Start full and targeted scans.
- Persist and retrieve inventory data.
- Request analysis after inventory changes.
- Expose stable command-oriented DTOs for the UI.
- Enforce read-only behavior for discovery workflows.
- Later, build sync plans and require explicit confirmation before delegating them to the Sync Engine.

This layer owns use cases such as `scan_all_agents`, `get_agent_matrix`, `search_skills`, and `analyze_inventory`.

### Agent Adapter

An Agent Adapter translates a supported agent's local conventions into ASM's shared domain model. It is responsible for:

- Detecting whether the agent is installed or its configuration directory exists.
- Resolving one or more candidate Skill roots for the current platform.
- Discovering Skill directories and their entry files.
- Returning normalized discovery records and diagnostic warnings.
- Describing whether the adapter supports future synchronization and which formats are safe to handle.

Adapters must not write user files during scanning. Claude Code and Codex are the first MVP adapters.

### Scanner

The Scanner performs filesystem discovery using adapter-provided roots:

- Enumerates candidate Skill directories.
- Applies adapter rules to identify valid Skills.
- Reads only the metadata and content required for indexing.
- Calculates deterministic content hashes for comparison.
- Captures discovery errors without aborting other agents' scans.
- Emits normalized scan results to the Inventory service.

A scan does not infer that same-named Skills are identical; it uses hashes and adapter context.

### Inventory

The Inventory service is ASM's normalized local catalog. It:

- Upserts detected agents, Skills, installations, scan runs, and diagnostics.
- Associates one logical Skill with one or more observed installations.
- Records paths, content hashes, timestamps, and adapter identifiers.
- Provides query models for the dashboard, library, agent pages, and matrix.
- Keeps observed data separate from future user preferences such as favorites or desired coverage.

The inventory is an index of local state, not a replacement for the original Skill directories.

### Analyzer

The Analyzer derives operational status from inventory records:

- **Installed:** an installation was found for the Agent and Skill.
- **Missing coverage:** a Skill is absent from a user-selected or compatible target Agent.
- **Inconsistent:** installations identified as the same logical Skill have different content hashes.
- **Duplicate:** more than one qualifying installation represents the same Skill within a relevant scope.
- **Unavailable / unsupported:** the Agent or format cannot be scanned or compared with sufficient confidence.

The Analyzer records both the result and the evidence used to produce it. The UI should be able to show why a status was assigned.

### Database

SQLite provides durable, local persistence for:

- Agent detection and configuration-root observations.
- Scan runs and errors.
- Normalized Skills and their discovered metadata.
- Installations, paths, content hashes, and last-seen timestamps.
- Analysis results and user preferences.

Database access is private to Rust infrastructure and repository modules. The UI receives typed query results rather than raw tables.

### File Watcher

The File Watcher observes known Skill roots after a successful scan:

- Watches only roots returned by detected adapters.
- Debounces bursts of file events.
- Schedules a targeted re-scan for the affected agent or root.
- Updates the inventory and re-runs relevant analysis.
- Emits a refresh event to the UI.

Watching is advisory: missed events, unavailable watchers, and platform limitations must fall back safely to manual or scheduled scans. Watching never writes files.

### Future Sync Engine

The Sync Engine is intentionally separated from discovery. When introduced, it will:

- Consume a user-selected source installation and target agents.
- Ask adapters to validate target compatibility and construct a declarative sync plan.
- Show all planned creates, updates, removals, and conflicts to the user.
- Execute only after explicit user confirmation.
- Re-scan affected roots after completion and record an audit result.
- Refuse silent overwrite when the target differs from the planned baseline.

The initial architecture reserves this boundary; it does not authorize automatic synchronization.

## 4. Core Data Flows

### First Scan

```text
User opens ASM or chooses Scan
        │
        ▼
Application requests all registered adapters to detect agents
        │
        ▼
Each detected adapter returns Skill roots and scan rules
        │
        ▼
Scanner reads matching Skill directories and computes hashes
        │
        ▼
Inventory upserts agents, Skills, installations, and scan results
        │
        ▼
Analyzer derives matrix and operational statuses
        │
        ▼
SQLite persists results → UI receives refreshed dashboard, library, and matrix
```

A failure for one adapter or directory is stored as a diagnostic and does not prevent the rest of the inventory from being shown.

### Incremental Scan

```text
Filesystem event or manual refresh
        │
        ▼
File Watcher debounces and identifies the affected root
        │
        ▼
Application requests a targeted scan through its owning adapter
        │
        ▼
Scanner re-indexes only the affected scope
        │
        ▼
Inventory reconciles added, changed, and no-longer-present installations
        │
        ▼
Analyzer recalculates impacted statuses → UI refresh event
```

A periodic full scan remains available to correct for missed watcher events or changed agent configuration.

### Status Analysis

```text
Inventory query: logical Skill + observed installations
        │
        ├── compare normalized identity and compatibility
        ├── compare content hashes
        ├── compare Agent coverage against user intent, when configured
        └── retain source paths and scan evidence
        ▼
Analyzer produces explainable status records
        ▼
Dashboard counters, Operations lists, and Agent Matrix render the same results
```

The MVP distinguishes observed facts from recommendations. For example, “different content hashes” is an observed fact; “sync Codex from Claude” is a future user-confirmed recommendation.

## 5. Agent Adapter Extension Mechanism

Each supported agent is implemented as a Rust adapter registered with the Adapter Registry. The core communicates through a common contract conceptually equivalent to:

```rust
trait AgentAdapter {
    fn id(&self) -> AgentId;
    fn display_name(&self) -> &str;
    fn detect(&self, platform: &PlatformContext) -> DetectionResult;
    fn skill_roots(&self, detection: &DetectionResult) -> Vec<SkillRoot>;
    fn scan(&self, root: &SkillRoot) -> ScanResult;
    fn capabilities(&self) -> AdapterCapabilities;
}
```

The exact Rust types can evolve, but every adapter must provide:

- A stable adapter ID and display name.
- Platform-aware detection and path resolution.
- A declared Skill root model.
- A scan implementation that outputs normalized Skill discovery records.
- Explicit capability flags, including comparison confidence and future sync support.
- Diagnostics for unsupported layouts or malformed Skills.

To add an agent:

1. Implement the adapter contract in the adapter module.
2. Add fixture-based tests for its directory layouts and malformed inputs.
3. Register the adapter in the Adapter Registry.
4. Add its supported platforms, formats, and limitations to documentation.
5. Confirm that a failed detection or scan remains isolated from other adapters.

No adapter may expose arbitrary shell command execution to the UI.

## 6. Local Data and File Boundaries

ASM separates observed agent files from its own application data.

### Agent-Owned Data: Read-Only in Discovery

Examples include agent configuration directories and their Skill folders, such as a supported agent's local Skills root. During discovery, ASM may list directories, read files, inspect metadata, and compute hashes. It must not edit, rename, delete, relocate, or create files there.

### ASM-Owned Data: Writable

ASM stores only its own local state in an application-data directory determined by the operating system. It may write:

```text
<ASM application data>/
├── asm.db                 # SQLite database
├── logs/                  # application and scan diagnostics
└── settings/              # local user preferences
```

The exact location is resolved through the platform layer; the application must not hard-code a home-directory path.

Future snapshots, managed repositories, or sync staging directories must be introduced as separate, clearly documented ASM-owned locations. They are outside the read-only discovery MVP.

## 7. Cross-Platform Considerations

ASM targets Windows, macOS, and Linux with a shared UI and Rust core.

| Concern | Architecture approach |
| --- | --- |
| User and application data paths | Resolve through Tauri/Rust platform APIs; never hard-code path separators or home-directory strings. |
| Agent detection | Adapters use platform-aware candidate locations and executable discovery. |
| Filesystem paths | Use Rust `Path` and `PathBuf`; normalize only for display or comparison where appropriate. |
| File watching | Use a cross-platform watcher abstraction with debouncing and a manual re-scan fallback. |
| Symlinks and permissions | Treat them conservatively during scanning; record diagnostics rather than attempting repair. |
| Opening folders or external tools | Route through a small platform integration service and require user initiation. |
| Packaging | Build and sign per target platform; do not assume one platform can produce release artifacts for all others. |
| SQLite storage | Keep the database in the OS-appropriate application-data directory and protect it from partial writes through transactions. |

Windows-specific link permissions, macOS privacy prompts, and Linux distribution differences must be surfaced as actionable diagnostics rather than hidden failures.

## 8. MVP Architecture Scope

### Included

- Tauri desktop shell with a React + TypeScript UI.
- Rust application core and filesystem infrastructure.
- SQLite-backed local inventory.
- Claude Code and Codex adapters.
- Read-only full and targeted scans.
- Content hashing and explainable comparison analysis.
- Dashboard, Library, Agents, and Agent Matrix query flows.
- File watching with manual re-scan fallback.
- Foundations for an explicit future sync-plan boundary.

### Not Implemented in the Initial MVP

- Automatic synchronization, automatic conflict resolution, or silent overwrite.
- A central managed Skill repository.
- Any built-in Skill editor or AI content generation.
- Cloud storage, accounts, telemetry, team features, or a marketplace.
- MCP, prompts, rules, commands, and other non-Skill agent assets.
- A dynamic third-party plugin runtime.
- Usage analytics based on parsing agent execution logs.
- Full versioning, snapshots, rollback, or Git-based repository synchronization.

A later sync increment may be added only after its preview, confirmation, conflict, and audit behavior is designed and tested independently from the discovery engine.

## 9. Recommended Technology Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Desktop shell | Tauri 2 | Cross-platform application shell, native integration, command bridge, and packaging. |
| UI | React | Component-based desktop interface for dashboard, library, matrix, and operations views. |
| UI language | TypeScript | Typed UI state, command contracts, and safer data rendering. |
| Core and infrastructure | Rust | Filesystem scanning, hashing, watching, adapters, platform integration, and application logic. |
| Local persistence | SQLite | Durable, local-first inventory, scan history, analysis results, and preferences. |

This stack keeps the UI productive while placing filesystem-sensitive operations in a small, testable Rust core. It supports the MVP's most important guarantee: users can inspect their agent Skill landscape without ASM modifying their original Skill files.
