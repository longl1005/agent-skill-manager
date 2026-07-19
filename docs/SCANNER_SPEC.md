# Scanner Engine Specification

## 1. Purpose and Scope

This document defines the scanner engine for Agent Skill Manager (ASM). It is the implementation contract for the Rust Scanner that turns local, agent-owned Skill directories into safe, normalized observations for the Inventory and Analyzer.

The scanner coordinates this lifecycle while Agent Adapters retain ownership of agent-specific path, format, and metadata rules:

```text
Detect → Discover → Parse → Fingerprint → Analyze → Persist
```

The scanner supports ASM's local-first, read-first inventory. It provides evidence for Dashboard, Skills, Agents, Agent Matrix, Conflict Center, and Scan History without changing a user's agent configuration or Skill files.

This specification complements [PRD](PRD.md), [Architecture](ARCHITECTURE.md), [Domain Model](DOMAIN_MODEL.md), [Agent Adapter Specification](ADAPTER_SPEC.md), and [UI Specification](UI_SPEC.md).

## 2. Goals and Principles

### 2.1 Goals

The scanner must:

- detect supported local agents and their Skill roots;
- discover valid Skill installations inside trusted roots;
- normalize evidence for logical-Skill grouping;
- produce deterministic content fingerprints where comparison is supported;
- identify coverage gaps, comparable differences, duplicates, and scan-health issues; and
- persist only ASM-owned scan data locally.

### 2.2 Non-negotiable principles

1. **Read-only.** Detect, discover, parse, fingerprint, analyze, and watch operations must never create, modify, rename, move, delete, or change permissions on an agent-owned file.
2. **Safe scope.** Read only roots returned by a trusted adapter detection result or explicitly configured by the user; validate every child path remains inside its root.
3. **Local and private.** The MVP does not upload Skill content, paths, hashes, diagnostics, or telemetry.
4. **Evidence over guesses.** Unknown, malformed, unreadable, and incomparable states are explicit. The scanner must not claim matching or absence without enough evidence.
5. **Partial results are safe.** A local failure must not block unrelated roots or adapters, and a partial, failed, or cancelled scan must not mark an old installation absent.
6. **Deterministic output.** The same filesystem state, adapter version, and scan configuration produce the same observations and fingerprints, apart from timestamps and diagnostic ordering.
7. **Explainable analysis.** Every UI status must be traceable to stored observations, fingerprints, adapter capabilities, or structured issues.

## 3. Boundaries and Responsibilities

| Concern | Owner |
| --- | --- |
| Agent availability and candidate Skill roots | Agent Adapter |
| Lifecycle orchestration, root validation, cancellation | Scanner |
| Agent-specific entry files, layouts, metadata, exclusions | Agent Adapter |
| Generic hashing over adapter-declared file sets | Scanner |
| Logical-Skill grouping, coverage, duplicate and conflict findings | Inventory / Analyzer |
| Scan history and SQLite writes | Persistence layer |
| File-writing operations | Future confirmed Sync Engine; never Scanner |

The Desktop UI invokes typed Tauri commands. It never accesses agent directories or SQLite directly.

## 4. Scan Lifecycle

The scanner records phase timing, outcome, completeness, and issues. Independent adapters or roots may run concurrently with bounded resource use, but persisted results remain deterministic.

### 4.1 Detect

For each enabled adapter:

1. Load the adapter descriptor and capability set.
2. Verify supported platform.
3. Run `detect(DetectionContext)`.
4. Collect availability, trusted `SkillRoot` values, and diagnostics.
5. Classify the result as `Detected`, `Unavailable`, `Partial`, `Unsupported`, or `Failed`.

Missing roots are never created. An unavailable agent is a valid result rather than a scan failure.

### 4.2 Discover

For every trusted root:

1. Canonicalize or validate it where platform behavior permits.
2. Verify each candidate remains inside the root after normalization.
3. Enumerate only the adapter's documented layout.
4. Exclude generated, volatile, private, and unsupported paths by adapter rule.
5. Do not follow symbolic links, junctions, or aliases by default.

Discovery returns candidates and entry descriptors; it does not yet claim every candidate is a valid Skill.

### 4.3 Parse

For each candidate:

1. Validate the adapter-defined entry file or directory convention.
2. Read only recognized entry and metadata files.
3. Extract declared ID, name, description, version, source, and format metadata where available.
4. Normalize without modifying original content.
5. Produce identity evidence, normalized metadata, and an agent-qualified physical location.
6. Emit a recoverable `ScanIssue` for missing entries, malformed metadata, unreadable files, or unsupported layouts.

Identity evidence is not global identity. The Inventory groups observations conservatively after scanning.

### 4.4 Fingerprint

For every installation with an adapter-declared comparable file set:

1. Obtain its scope and exclusions.
2. Build a deterministic manifest from sorted relative paths.
3. Stream file bytes into a digest in manifest order.
4. Record algorithm, version, scope, exclusions, digest, and comparison confidence.
5. Emit a non-fatal issue if safe fingerprinting cannot complete.

Timestamps, absolute paths, filesystem traversal order, and non-content metadata must not affect a fingerprint.

### 4.5 Analyze

After selected adapters complete:

1. Reconcile observations into logical Skill candidates using the Inventory's confidence rules.
2. Compare fingerprints only where identity, format, algorithm, version, scope, and confidence are compatible.
3. Derive coverage, duplicate, different-content, conflict, missing-path, unreadable-path, unsupported, and unknown findings.
4. Generate a `HealthReport` that distinguishes health from incomplete coverage.
5. Retain the observations and issues behind every finding.

Partial coverage must produce `Unknown` or `Scan incomplete`, never a false `Missing`, `Matching`, or health percentage.

### 4.6 Persist

Persist only ASM-owned local data:

- scan metadata and adapter outcomes;
- root and installation observations;
- fingerprints and comparison metadata;
- issues, findings, health report, timings, and safe diagnostics.

Persistence is transactional per completed scope. Only a complete scan may reconcile absence inside that proven-complete scope. A partial, failed, or cancelled scan retains prior successful observations and records its own result separately.

## 5. Directory Discovery Strategy

### 5.1 Cross-platform rules

Use native path APIs, never string concatenation, hard-coded home directories, usernames, drive letters, or separators. Adapters resolve roots with this precedence:

1. Valid explicit user configuration for that agent.
2. Adapter-supported platform defaults obtained through platform APIs.
3. Safely readable, adapter-documented agent configuration references.

The core receives normalized `SkillRoot` values, not platform path heuristics. The initial Claude Code and Codex adapters remain independently versioned even when their layouts look similar.

### 5.2 Default and custom paths

Each adapter documents candidate roots, platform support, scope, valid entries, exclusions, and fallback behavior. A configured custom root must exist, be a directory, be associated with an owning adapter, retain configuration provenance, and be validated without creating it. It does not enable arbitrary recursive directory scanning; the adapter's Skill rules still apply.

### 5.3 Links and root escape

The default policy skips symbolic links, Windows junctions, and aliases, reporting `SYMLINK_SKIPPED` when relevant. Any future constrained-link policy must prevent cycles and root escape, retain link provenance, and treat inaccessible links as partial coverage.

## 6. Skill Recognition and Metadata

A physical location is an installation only when it matches an adapter-defined Skill format. A folder name alone is insufficient.

```text
SkillInstallation {
  agentId
  adapterId
  rootId
  location
  format
  entry
  identity
  metadata
  contentFingerprint?
  comparisonConfidence
  observedAt
  diagnostics
}
```

### 6.1 Identity evidence

Preferred evidence order:

1. stable format-defined Skill ID;
2. trusted declared name with format and adapter context;
3. normalized directory name with entry convention.

Normalization trims whitespace, uses Unicode normalization where supported, and case-normalizes only for logical comparison. Physical paths retain native filesystem case semantics. Similar names never prove that two installations are the same Skill.

### 6.2 Metadata rules

When present and safely readable, adapters may return `id`, `name`, `description`, `version`, `author`, `tags`, `source`, `entry`, and `format`. Missing metadata is valid. Malformed metadata creates an issue and must not be silently replaced with invented values.

Source and version are descriptive only: equal versions do not imply identical content, while unequal versions do not prove a conflict without compatible fingerprints.

## 7. Content Fingerprints and Conflict Rules

### 7.1 SHA-256 baseline

ASM uses versioned SHA-256 fingerprints over an adapter-defined comparable file set. The deterministic byte stream is:

```text
for each comparable file in lexicographically sorted relative-path order:
  write(relative_path UTF-8 bytes)
  write(NUL separator)
  write(file bytes)
  write(NUL separator)
```

```text
ContentFingerprint {
  algorithm: "sha256"
  version: 1
  scope: ComparableEntry | DeclaredFileSet | FullInstallation
  digest: HexString
  excludedPaths?: List<RelativePath>
}
```

Files are streamed, not fully held in memory. Exclusions must be documented and include only volatile, generated, or agent-private content.

### 7.2 Comparison and conflict determination

Fingerprints are comparable only when installations have sufficient identity confidence, compatible formats, matching algorithm/version/scope, equivalent comparable-file rules, and `Reliable` confidence.

When compatible fingerprints differ, ASM reports **installed, different content**. ASM reports **conflict** when user review is required because the relationship or baseline is ambiguous, such as divergent multiple copies, unclear identity, or incomplete comparison scope.

Incompatible, absent, partial, or unknown fingerprints are `Unknown` or `Uncomparable`, never matching or conflicting. The MVP never selects a winner, merges content, or writes a resolution.

## 8. Full and Incremental Scans

### 8.1 Full scans

A full scan evaluates every enabled adapter and trusted root. It is the authoritative refresh for its scope and the only scan mode that can mark a prior installation absent. It records root completeness, adapter outcomes, findings, and a current inventory baseline.

The MVP supports user-initiated, read-only full scans and may offer a user-controlled startup scan preference.

### 8.2 Future incremental scans and File Watch

File Watch is deferred. A future watcher event triggers a bounded, read-only targeted re-scan; it is never authoritative state and never writes files. It must debounce bursts, coalesce rename/create/delete events, revalidate root containment, fall back to root or full scan after overflow or ambiguity, preserve old observations until the targeted scope completes, and record watcher-triggered scans in history.

## 9. Output Models

### 9.1 `ScanResult`

```text
ScanResult {
  scanId: ScanId
  trigger: UserInitiated | Startup | Watcher | Scheduled
  mode: Full | Targeted
  outcome: Completed | CompletedWithIssues | Partial | Failed | Cancelled
  completeness: Complete | Partial | Unknown
  startedAt: Timestamp
  completedAt?: Timestamp
  adapters: List<AdapterScanSummary>
  installations: List<SkillInstallation>
  issues: List<ScanIssue>
  healthReport?: HealthReport
}
```

An empty completed result is valid when readable roots contain no valid Skills. Failed and cancelled scans are never proof of absence.

### 9.2 `ScanIssue`

```text
ScanIssue {
  code: String
  severity: Info | Warning | Error
  phase: Detect | Discover | Parse | Fingerprint | Analyze | Persist | Watch
  agentId?: String
  rootId?: String
  path?: SafeDisplayPath
  message: String
  recoverable: Boolean
  cause?: SafeErrorDetail
}
```

Common codes: `ROOT_NOT_FOUND`, `ROOT_UNREADABLE`, `ROOT_ESCAPE_BLOCKED`, `SYMLINK_SKIPPED`, `ENTRY_MISSING`, `MALFORMED_METADATA`, `UNSUPPORTED_LAYOUT`, `PERMISSION_DENIED`, `FINGERPRINT_UNAVAILABLE`, `ADAPTER_FAILED`, `SCAN_CANCELLED`, and `PERSISTENCE_FAILED`.

Issue text must not contain Skill contents, credentials, tokens, environment values, or unnecessary path details.

### 9.3 `HealthReport`

```text
HealthReport {
  scanId: ScanId
  status: Healthy | NeedsAttention | ScanIncomplete | Unavailable
  coverage: Complete | Partial | Unknown
  summary: HealthSummary
  findings: List<HealthFinding>
  generatedAt: Timestamp
}
```

`HealthSummary` includes detected/scanned/failed agents, distinct Skills where unambiguous, installations, different content, conflicts, missing and unreadable paths, duplicates, and unknown comparisons. The UI displays `ScanIncomplete` or `Unavailable`, not a percentage, when coverage is insufficient.

## 10. Error Handling and Tolerance

- An unavailable agent is a normal detection result.
- Candidate, installation, or root failures do not stop sibling scopes when safe continuation is possible.
- Adapter panics and unexpected failures are isolated as `ADAPTER_FAILED`; they must not crash the desktop application.
- Parse or fingerprint failures preserve safely observed metadata and add diagnostics.
- Cancellation is cooperative and produces `Cancelled` or partial results.
- Persistence failure keeps the prior successful inventory intact and raises an actionable application issue.
- Any transient I/O retry must be bounded, back off, and stay read-only.

## 11. Performance Targets

Initial targets on a contemporary desktop with local SSD storage:

| Scenario | Target |
| --- | --- |
| Detect 10 registered adapters | under 1 second |
| Full scan: 4 agents, up to 250 installations, up to 5,000 comparable files | under 5 seconds |
| Full scan: 10 agents, up to 1,000 installations, up to 20,000 comparable files | under 20 seconds |
| Memory | bounded; do not retain full file contents |
| UI | scan runs off the UI thread and reports progress |

The scanner streams hash inputs, avoids rereading files in one scan, bounds concurrency, batches persistence, and favors cancellation and UI responsiveness over maximum parallelism. These targets exclude network volumes, antivirus interference, unusual hardware, and inaccessible filesystems.

## 12. Logging and Observability

Logs remain local in the MVP. Every scan emits structured events containing scan ID, trigger, mode, timestamps, adapter and agent IDs/versions, root identifiers, phase durations, counts, outcome, completeness, issue codes, fingerprint algorithm/version, and persistence outcome.

| Level | Use |
| --- | --- |
| `DEBUG` | Development diagnostics and bounded path/timing detail |
| `INFO` | Scan start/end, adapter summaries, inventory counts |
| `WARN` | Recoverable partial coverage and malformed or unreadable content |
| `ERROR` | Adapter isolation, persistence, and unexpected scanner failures |

Logs are redacted by default. They must never contain Skill content, credentials, tokens, or unnecessary absolute paths. Settings exports diagnostic summaries without Skill content by default.

## 13. MVP Scope

### Included

- `Detect` for registered adapters;
- user-initiated, read-only **Full Scan**;
- trusted-root discovery for supported adapters;
- valid Skill recognition and basic metadata normalization;
- versioned SHA-256 fingerprints for supported comparable formats;
- detectable duplicate, difference, coverage, and health analysis;
- local persistence of results, issues, and health reports; and
- scan progress and history data for the UI.

The first supported adapters are Claude Code and Codex.

### Deferred

- File Watch and incremental scans;
- automatic, scheduled, or network-driven scans;
- telemetry or cloud indexing;
- arbitrary user-directory crawling;
- Skill editing, automatic conflict resolution, or usage-log analytics; and
- install, update, remove, repair, Align, or any file-writing operation.

Synchronization is the responsibility of a separate Sync Engine. It may execute only a declarative, previewed `SyncPlan` after explicit user confirmation and its own write-safety specification.

## 14. MVP Acceptance Checklist

The Scanner implementation is compliant when it can demonstrate that it:

- detects Claude Code and Codex without creating their directories;
- performs a read-only full scan of trusted roots;
- persists normalized observations, fingerprints, issues, and a health report locally;
- creates deterministic fingerprints for unchanged comparable content;
- reports different content only when comparison evidence is reliable;
- treats permission failures, malformed metadata, and unsupported layouts as structured partial findings;
- never marks an installation absent after a partial, failed, or cancelled scan;
- continues unrelated adapter/root scans after isolated failure;
- reports useful progress and safe diagnostics; and
- does not modify any user-owned agent Skill file.
