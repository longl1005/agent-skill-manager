# ASM Domain Model

## 1. Purpose

This document defines the domain language and conceptual model for Agent Skill Manager (ASM) MVP. It is intentionally **not** a database schema, API contract, or filesystem implementation guide.

Its purpose is to give product, application, adapter, and persistence code a shared understanding of what ASM manages:

- an **Agent** provides a local environment that may contain Skills;
- a **Skill** is one logical capability in the unified inventory;
- an **Installation** is the observed presence of that Skill in one Agent;
- a **ScanResult** records what an adapter observed during a scan; and
- an **Inventory** is the current normalized view assembled from those observations.

Database tables and UI view models may represent these concepts differently, but they must preserve their meaning and boundaries.

## 2. Domain Design Principles

ASM uses domain-driven design (DDD) to keep its business language independent from agent-specific filesystems and storage choices.

1. **Use the ubiquitous language**
   `Agent`, `Skill`, `Installation`, `ScanResult`, and `Inventory` mean the same thing in product discussions, Rust code, UI copy, tests, and documentation. Terms such as “folder,” “row,” or “file” are implementation details, not substitutes for domain concepts.

2. **Model observed facts before recommendations**
   The MVP observes files owned by Agents and records what was found. A differing hash is a fact; a suggested synchronization is a later decision. Discovery never assumes that an installation is the canonical source.

3. **Keep Agent conventions at the boundary**
   Directory layouts, entry-file rules, metadata formats, and platform paths belong to an Agent Adapter. The domain model receives normalized observations, not Claude- or Codex-specific paths as business rules.

4. **Separate logical identity from physical presence**
   A `Skill` represents the capability users recognize in their library. An `Installation` represents one physical copy in an Agent. A Skill can have zero, one, or many Installations.

5. **Make uncertainty explicit**
   A scan may be partial, an identity match may be tentative, and a comparison may be unsupported. The model must retain diagnostics and confidence rather than silently presenting an assumption as fact.

6. **Keep the MVP read-first**
   The filesystem remains the observed source of truth during discovery. No entity grants permission to modify an Agent’s files; future write operations require an explicit, user-confirmed plan.

7. **Design for evolution without modeling future features as present facts**
   Repository, Profile, SyncTask, and HealthReport are named future concepts, but the MVP does not require them to perform scanning, inventory, or comparison.

## 3. Core Entities

### 3.1 Agent

**Definition:** An AI coding agent that ASM can detect, inspect, and potentially support for future synchronization.

**Responsibility:** Describe the agent environment in which Skills are discovered. An Agent does not own a global Skill definition; it owns the context in which an Installation is observed.

**Key attributes:**

- `id`: Stable ASM identity, such as `claude-code` or `codex`.
- `displayName`: Human-readable name shown in the UI.
- `adapterId`: The adapter responsible for detection and interpretation.
- `detectionStatus`: Whether the agent was detected, unavailable, partially available, or unsupported on this machine.
- `version`: Optional observed agent version when safely available.
- `skillRoots`: One or more candidate locations that the adapter reports for discovery.
- `capabilities`: Declared support for scanning, comparison confidence, watching, and future sync planning.
- `lastObservedAt`: The most recent time ASM successfully observed the agent.
- `diagnostics`: Non-fatal facts such as missing directories or unsupported layouts.

**Lifecycle:**

```text
Registered by Adapter Registry
        → detection attempted
        → detected, unavailable, or partially detected
        → scanned through one or more Skill roots
        → re-observed by manual, scheduled, or watcher-triggered scans
        → no longer observed when the agent or its configuration disappears
```

An Agent can remain in the Inventory with a historical diagnostic after becoming unavailable; it must not be treated as currently installed without a current observation.

### 3.2 Skill

**Definition:** A logical Agent capability shown as one item in ASM’s unified library, regardless of how many Agents contain a copy.

**Responsibility:** Provide the user-level identity used to group related Installations, display an inventory card or matrix row, and support cross-Agent analysis.

**Key attributes:**

- `id`: Stable ASM identity for the logical Skill.
- `name`: Display name derived from trusted metadata or the adapter’s normalized discovery rules.
- `normalizedIdentity`: The comparison key used to associate observations conservatively; it can include a normalized name and format context.
- `description`: Optional discovered description.
- `entryDescriptor`: A normalized description of the entry content, such as the discovered `SKILL.md` entry, without making a file path the Skill’s identity.
- `metadata`: Optional normalized fields such as version, author, tags, and declared compatibility.
- `identityConfidence`: How confidently ASM grouped its Installations as the same logical Skill.
- `firstDiscoveredAt` and `lastObservedAt`: Inventory timestamps for the logical asset.

**Lifecycle:**

```text
First qualifying installation discovered
        → logical Skill identified or created
        → additional matching installations associated
        → identity or metadata refined by later scans
        → becomes absent from the current inventory when no installations remain
```

The MVP does not claim that a Skill has an authoritative copy. It is a normalized inventory identity, not a managed source directory.

### 3.3 Installation

**Definition:** The relationship between one Skill and one Agent, representing one observed physical instance of that Skill in that Agent’s local environment.

**Responsibility:** Preserve the information needed to answer the operational questions users actually ask: where a Skill exists, what content was observed, whether it differs from peer copies, and whether it is still present.

**Key attributes:**

- `id`: Stable identity for this observed relationship.
- `skillId`: The logical Skill represented by the installation.
- `agentId`: The Agent in which it was observed.
- `location`: Adapter-qualified path or location descriptor for the physical installation.
- `format`: The adapter-recognized Skill format and entry convention.
- `contentHash`: Deterministic hash of the adapter-defined comparable content.
- `observedVersion`: Optional version as declared by the installed content.
- `status`: Observed state such as present, missing-since-last-scan, unreadable, malformed, or unsupported for comparison.
- `comparisonConfidence`: Whether this installation can be compared reliably with peers.
- `firstDiscoveredAt`, `lastObservedAt`, and `lastChangedAt`: Observation history needed for reconciliation and analysis.
- `diagnostics`: Local issues such as a missing entry file or unreadable content.

**Lifecycle:**

```text
Adapter discovers a qualifying physical Skill
        → Installation created and linked to Agent + Skill
        → content and diagnostics refreshed on each relevant scan
        → marked changed when comparable content changes
        → marked absent or retired when no longer found in a successful scan
```

More than one Installation may exist for the same `SkillId` and `AgentId` when the adapter recognizes multiple valid roots or copies. This is an observed duplicate condition, not an error that the domain silently collapses.

### 3.4 ScanResult

**Definition:** The immutable outcome of one adapter scan attempt over a defined scope at a point in time.

**Responsibility:** Preserve evidence for how Inventory facts were obtained, including successful discoveries, warnings, failures, and completeness. A ScanResult is an observation record, not the Inventory itself.

**Key attributes:**

- `scanId`: Unique identity for the scan attempt.
- `agentId` and `adapterId`: The owner of the scan behavior and its target Agent.
- `scope`: The roots, directories, or targeted path that were intended to be scanned.
- `startedAt` and `completedAt`: Timing of the attempt.
- `outcome`: Completed, completed-with-diagnostics, failed, or cancelled.
- `discoveredInstallations`: Normalized discovery candidates returned by the adapter.
- `diagnostics`: Warnings and errors with enough context for the UI and troubleshooting.
- `completeness`: Whether the result covers the intended scope or is partial.
- `fingerprint`: Optional summary used to avoid unnecessary downstream work when nothing observable changed.

**Lifecycle:**

```text
Scan requested
        → ScanStarted
        → adapter and scanner collect observations
        → normalized discoveries and diagnostics assembled
        → ScanCompleted or ScanFailed
        → Inventory reconciles only the scope that the result reliably covers
```

A failed or partial ScanResult must not imply that previously observed Installations were deleted. Only a sufficiently complete successful scan may establish absence within its scope.

### 3.5 Inventory

**Definition:** ASM’s current normalized catalog of Agents, Skills, Installations, and the evidence required to explain their state.

**Responsibility:** Act as the domain boundary between raw scan observations and user-facing queries such as the Library, Agent pages, Operations lists, and Agent Matrix.

**Key attributes:**

- `agents`: The current known Agent contexts and their detection state.
- `skills`: Logical Skill identities constructed from qualifying observations.
- `installations`: Observed Agent × Skill relationships, including physical details and status.
- `scanCoverage`: The recency and completeness of the scans supporting each portion of the catalog.
- `diagnostics`: Aggregated discovery and reconciliation concerns.
- `analysisFacts`: Derived but explainable facts, such as differing hashes, duplicate copies, or missing selected coverage.
- `asOf`: The latest point at which the Inventory is known to represent its observed scopes.

**Lifecycle:**

```text
Empty local catalog
        → initial ScanResults reconciled
        → Inventory published to queries
        → targeted or full ScanResults incrementally reconcile it
        → analysis recalculates affected facts
        → refreshed Inventory becomes the current operational view
```

The Inventory is not a second filesystem and not a central managed repository. It is an explainable, local projection of observed Agent-owned files.

## 4. Entity Relationships

The model can be read with ER-style relationships, while remaining independent of database cardinalities or table layout:

```text
Adapter 1 ────── operates on ────── * Agent

Agent 1 ────── contains context for ────── * Installation
Skill 1 ────── is represented by ────────── * Installation

Agent 1 ────── is scanned by ────────────── * ScanResult
ScanResult 1 ── discovers or diagnoses ──── * Installation candidates

Inventory 1 ── projects ─────────────────── * Agent
Inventory 1 ── projects ─────────────────── * Skill
Inventory 1 ── projects ─────────────────── * Installation
Inventory 1 ── is reconciled from ───────── * ScanResult
```

In user language, the central relationship is:

```text
Skill ── has an observed copy in ──> Installation ── belongs to ──> Agent
```

This relationship allows the same Skill to appear once in the Library while retaining each Agent-specific path, content hash, format, and condition. It also permits an Agent to have several copies of one logical Skill without hiding a duplicate.

## 5. Why Installation Is the Core Model

`Installation` is the core model because ASM is not primarily an editor or a catalog of abstract Skill definitions. It is an operations tool for the relationship between a capability and the Agent environments where that capability is installed.

The questions that create ASM’s value all require Installation data:

- **Where is this Skill installed?** — `agentId` and `location`.
- **Does Codex have the same Skill as Claude Code?** — Installations linked to one `skillId`.
- **Are those copies consistent?** — comparable `contentHash` values and confidence.
- **Is a Skill duplicated within an Agent?** — multiple Installations under the same Agent and Skill.
- **What would a future sync change?** — a selected source Installation and target Installations or missing targets.
- **What changed since the last scan?** — installation observation timestamps and content state.

Treating an Installation as only a join record would hide the very facts needed for discovery, explainable analysis, and safe synchronization. It is a first-class domain entity with its own lifecycle, diagnostics, and operational status.

## 6. Future Domain Extensions

The following concepts are intentionally outside the MVP, but fit around the core model without redefining it.

### Repository

A **Repository** represents a declared source of Skill content, such as a Git repository, local managed directory, or future marketplace source. It may provide provenance, available versions, and update information for a Skill. It must remain distinct from an Installation: a repository describes a source, while an Installation describes an observed local copy in an Agent.

### Profile

A **Profile** is a user-defined desired capability set for a context such as “Work,” “Backend,” or “Flutter.” It can declare intended Skills and target Agents. A Profile expresses desired state; it must not overwrite the observed Inventory or imply that a missing Installation is an error until the user applies that profile.

### SyncTask

A **SyncTask** represents an explicit, previewed, user-confirmed synchronization operation. It references a source Installation or a managed source, selected targets, a proposed change set, preconditions, execution outcome, and audit information. It is not created by passive scanning and must never authorize silent overwrites.

### HealthReport

A **HealthReport** is an explainable analysis projection over an Inventory snapshot. It can summarize coverage, inconsistent content, duplicates, malformed installations, stale scan coverage, and future profile drift. A HealthReport derives from observations; it is not an independent source of truth.

## 7. Domain Events

Domain events communicate meaningful changes in the model. They should be emitted by application use cases after the relevant domain transition, and can drive persistence, analysis, UI refreshes, logs, and future audit trails.

| Event | Meaning | Typical payload |
| --- | --- | --- |
| `ScanStarted` | A scan was accepted for an Agent and scope. | `scanId`, `agentId`, `scope`, `startedAt` |
| `AgentDetected` | An adapter confirmed an Agent environment. | `agentId`, `adapterId`, `skillRoots`, `observedAt` |
| `AgentUnavailable` | Detection found no usable Agent environment or reported a supported absence. | `agentId`, `reason`, `observedAt` |
| `SkillDiscovered` | A qualifying observation produced or enriched a logical Skill identity. | `skillId`, `normalizedIdentity`, `confidence`, `scanId` |
| `InstallationDiscovered` | A physical Skill instance was observed in an Agent. | `installationId`, `skillId`, `agentId`, `location`, `contentHash` |
| `InstallationChanged` | A known Installation’s comparable content, metadata, or diagnostics changed. | `installationId`, `changedFields`, `previousHash`, `currentHash` |
| `InstallationMissing` | A complete successful scan established that a previously known Installation is absent from its scoped location. | `installationId`, `agentId`, `scope`, `scanId` |
| `ScanCompleted` | A scan completed, possibly with diagnostics. | `scanId`, `agentId`, `outcome`, `completeness`, `completedAt` |
| `ScanFailed` | A scan could not produce a reliable result for its intended scope. | `scanId`, `agentId`, `scope`, `diagnostics` |
| `InventoryReconciled` | A ScanResult updated the normalized Inventory. | `scanId`, `affectedAgents`, `affectedSkills`, `asOf` |
| `ConflictDetected` | Comparable Installations of one logical Skill differ in content and require user attention before future sync. | `skillId`, `installationIds`, `evidence` |
| `DuplicateDetected` | Multiple qualifying Installations represent the same Skill in a relevant Agent scope. | `skillId`, `agentId`, `installationIds` |
| `CoverageGapDetected` | A selected compatibility or future profile expectation is not met. | `skillId`, `targetAgentId`, `basis` |

Events describe something that happened; they do not embed UI commands such as “show warning” or policy decisions such as “overwrite target.”

## 8. MVP Boundary and Evolution Rules

### In the MVP

- Agents are detected through registered adapters, beginning with Claude Code and Codex.
- Skills and Installations are derived from read-only filesystem observations.
- Inventory groups Skill identities conservatively and retains confidence and diagnostics.
- ScanResults supply the evidence needed to reconcile present, changed, and absent Installations.
- Analysis can surface discovered facts: installed state, different content hashes, duplicates, unsupported comparisons, and configured coverage gaps.
- The desktop UI queries the Inventory; it does not access agent files directly.
- Any synchronization capability remains explicit, previewed, and user-confirmed.

### Explicitly deferred

- A canonical central Skill repository or managed source of truth.
- Automatic conflict resolution, merge behavior, or silent overwrite.
- Marketplace, remote repositories, accounts, cloud sync, and team sharing.
- Profiles as enforceable desired state.
- Usage analytics based on Agent logs.
- Management of MCP servers, prompts, rules, commands, or non-Skill assets.

### Rules for future changes

Future features must preserve three invariants:

1. **Observed state and desired state remain distinct.** Inventory reports what exists; Profiles and SyncTasks may describe what the user wants to change.
2. **A logical Skill is not confused with any one physical copy.** Even if a future managed source becomes canonical, existing Agent copies remain Installations with their own status and evidence.
3. **Writes require an explicit operational boundary.** Discovery and analysis remain non-destructive; all filesystem changes flow through a previewable, confirmed SyncTask or equivalent future command.

With these boundaries, database design can optimize persistence, adapters can evolve with new Agent formats, and future synchronization can be added without weakening the MVP’s read-first trust model.
