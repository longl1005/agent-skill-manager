# Agent Adapter Specification

## 1. Purpose and Scope

This document defines the extension contract for an Agent Adapter in Agent Skill Manager (ASM). An adapter converts one AI agent's local conventions—installation signals, Skill roots, directory layouts, and supported formats—into ASM's shared discovery model.

The specification is language-independent. Rust traits and TypeScript command types may implement it differently, but must preserve the responsibilities, safety rules, and observable behavior described here.

The MVP begins with Claude Code and Codex adapters. Its only implemented operations are **detect** and **scan**. All operations are read-only: an adapter must never create, modify, rename, move, or delete a user-owned Skill file in the MVP.

## 2. Adapter Responsibilities and Boundaries

### 2.1 Responsibilities

An adapter is responsible for agent-specific concerns only:

- Identify whether a supported agent is present or has a usable configuration environment.
- Resolve platform-aware candidate Skill roots.
- Recognize valid Skill installations and their entry conventions.
- Read the minimum content and metadata needed to produce normalized observations.
- Report supported capabilities, limitations, warnings, and errors explicitly.
- Define comparable content for that agent format and produce a deterministic content fingerprint.
- Optionally describe future watch and synchronization support without implementing write behavior in the MVP.

### 2.2 Non-responsibilities

An adapter must not:

- Own SQLite persistence, inventory reconciliation, UI state, or matrix rendering.
- Decide global logical-Skill grouping across different agents; it provides evidence for the Inventory to group conservatively.
- Treat an observed installation as an authoritative or canonical source.
- Make policy decisions such as which copy should win a conflict.
- Run arbitrary commands supplied by the UI or inspect unrelated user directories.
- Perform automatic repair, migration, cleanup, installation, update, removal, or synchronization in the MVP.

The Adapter Registry selects adapters. The Scanner orchestrates enumeration and hashing. The Inventory persists normalized observations. The Analyzer derives duplicate, inconsistency, and coverage facts. These boundaries keep agent-specific behavior isolated and auditable.

## 3. Unified Contract

The following pseudocode expresses the required contract. Names and error mechanics may vary by implementation language.

```text
interface AgentAdapter {
  id(): AdapterId
  descriptor(): AgentDescriptor
  capabilities(): CapabilitySet

  detect(context: DetectionContext): DetectionResult
  scan(context: ScanContext): ScanResult

  // Reserved for later increments; not implemented as write operations in MVP.
  watch?(context: WatchContext): WatchHandle | WatchIssue
  planInstall?(request: InstallRequest): SyncPlan
  planUninstall?(request: UninstallRequest): SyncPlan
  planUpdate?(request: UpdateRequest): SyncPlan
  planSync?(request: SyncRequest): SyncPlan
}
```

### 3.1 Required operations

| Operation | MVP status | Contract |
| --- | --- | --- |
| `descriptor` | Required | Returns stable identity and display metadata for the supported agent. |
| `capabilities` | Required | Declares the adapter's supported platforms, formats, comparison confidence, and future operation support. |
| `detect` | Required | Produces evidence-based agent availability and candidate Skill roots without reading or changing unrelated data. |
| `scan` | Required | Reads a declared scope and returns normalized installation observations, completeness, and diagnostics. |
| `watch` | Deferred | May request read-only filesystem notifications and trigger a targeted re-scan. It never changes files. |
| `planInstall`, `planUninstall`, `planUpdate`, `planSync` | Reserved | Future methods may construct declarative plans only. Execution belongs to a separate confirmed Sync Engine. |

### 3.2 Contract invariants

1. `detect` and `scan` are deterministic for the same filesystem state and context, apart from timestamps and non-semantic diagnostic ordering.
2. A result must distinguish **not found**, **unsupported**, **partial**, and **failed**; absence is not an error.
3. A failed or partial scan must not cause previously observed installations to be marked absent.
4. All discovered paths must be scoped to roots returned by detection or explicitly supplied by a trusted, user-initiated scan context.
5. Any operation that cannot establish a safe conclusion must return a diagnostic with evidence, not silently guess.

## 4. Core Types

These conceptual types are the minimum shared vocabulary between an adapter and ASM core.

### 4.1 `AgentDescriptor`

Describes the agent family supported by an adapter, not a machine-specific detection result.

```text
AgentDescriptor {
  agentId: String                 // stable: "claude-code", "codex"
  adapterId: String               // stable implementation identity
  displayName: String
  supportedPlatforms: Set<Platform>
  supportedSkillFormats: List<SkillFormatDescriptor>
  documentationUrl?: Url
  adapterVersion: SemanticVersion
}
```

`agentId` and `adapterId` are stable compatibility keys. Display names may change without changing persisted identity.

### 4.2 `CapabilitySet`

Declares what an adapter can safely do. Capability declaration is not permission to write.

```text
CapabilitySet {
  detect: Supported | Unsupported
  scan: Supported | Unsupported
  compareContent: None | Partial | Reliable
  watch: Unsupported | Planned | Supported
  installPlanning: Unsupported | Planned | Supported
  uninstallPlanning: Unsupported | Planned | Supported
  updatePlanning: Unsupported | Planned | Supported
  syncPlanning: Unsupported | Planned | Supported
  supportedPlatforms: Set<Platform>
  notes?: List<String>
}
```

For the MVP, `detect` and `scan` are supported for implemented adapters. `watch` may be planned or supported only as a read-only trigger. Every write-related capability must remain `Unsupported` or `Planned` until a separately designed Sync Engine exists.

### 4.3 `ScanContext`

Defines the trusted scope and constraints for one scan.

```text
ScanContext {
  scanId: ScanId
  agent: DetectedAgent
  roots: List<SkillRoot>
  platform: PlatformContext
  mode: Full | Targeted
  targetPath?: Path              // only for a watcher or user-requested targeted scan
  readPolicy: ReadOnly
  previousObservations?: ScanBaseline
  startedAt: Timestamp
}
```

The caller must supply roots associated with the adapter's detection result. The adapter must reject a target path that escapes those roots after canonicalization where possible.

### 4.4 `SkillInstallation`

Represents a normalized discovery candidate. Core later reconciles it into the Domain Model's `Installation` entity.

```text
SkillInstallation {
  agentId: String
  adapterId: String
  rootId: String
  location: LocationDescriptor
  format: SkillFormatDescriptor
  identity: SkillIdentityEvidence
  entry: EntryDescriptor
  metadata: NormalizedSkillMetadata
  contentFingerprint?: ContentFingerprint
  comparisonConfidence: None | Partial | Reliable
  observedAt: Timestamp
  diagnostics: List<ScanIssue>
}
```

`location` remains an agent-qualified physical location. It is not the global Skill identity. An adapter must retain enough evidence for a user to understand why an installation was discovered.

### 4.5 `ScanIssue`

Records a non-fatal warning or an error with useful scope and remediation context.

```text
ScanIssue {
  code: String
  severity: Info | Warning | Error
  phase: Detect | RootResolution | Enumeration | Read | Parse | Fingerprint | Watch
  path?: PathDisplay
  message: String
  recoverable: Boolean
  cause?: SafeErrorDetail
}
```

Issue messages must not contain secrets or unnecessary file content. Typical codes include `ROOT_NOT_FOUND`, `ENTRY_MISSING`, `PERMISSION_DENIED`, `SYMLINK_SKIPPED`, `MALFORMED_METADATA`, `UNSUPPORTED_LAYOUT`, and `FINGERPRINT_UNAVAILABLE`.

### 4.6 `ScanResult` and `DetectionResult`

```text
DetectionResult {
  agent: DetectedAgent
  status: Detected | Unavailable | Partial | Unsupported | Failed
  roots: List<SkillRoot>
  issues: List<ScanIssue>
  observedAt: Timestamp
}

ScanResult {
  scanId: ScanId
  agentId: String
  outcome: Completed | CompletedWithIssues | Partial | Failed | Cancelled
  completeness: Complete | Partial | Unknown
  installations: List<SkillInstallation>
  issues: List<ScanIssue>
  startedAt: Timestamp
  completedAt: Timestamp
}
```

An empty, complete result is valid when a detected agent has no Skills. A `Failed` result is not evidence that any old installation disappeared.

## 5. Detection and Scanning Flow

### 5.1 Detection

1. Load the adapter descriptor and platform support.
2. Resolve platform-appropriate configuration and executable candidates.
3. Check only the minimum evidence required to establish availability, such as a known configuration directory or executable.
4. Resolve candidate Skill roots without creating them.
5. Return `Detected`, `Unavailable`, `Partial`, `Unsupported`, or `Failed` with diagnostics.

Detection should prefer configuration-directory evidence over shelling out to an executable. If a version lookup requires a command, it must be optional, bounded, non-interactive, and never required for a successful scan.

### 5.2 Scanning

1. Validate that the requested roots belong to the adapter and current platform.
2. Enumerate only configured roots, applying the adapter's documented directory rules.
3. Identify qualifying installation directories and entry files.
4. Read the allowed entry and metadata files; do not read unrelated source trees by default.
5. Normalize name, optional metadata, format, and identity evidence.
6. Calculate a deterministic content fingerprint when the format supports comparison.
7. Return each observation with its own diagnostics, then set overall outcome and completeness.

An adapter should continue scanning sibling roots and installations after a local read or parse problem. It must stop only when the requested scan can no longer make a reliable statement about its scope.

### 5.3 Error handling and reconciliation safety

- Missing candidate roots are normally an informational detection result, not a scan failure.
- Permission, I/O, or parsing failures are captured as `ScanIssue`s and make the affected scope partial.
- A successful complete scan is required before core can mark an installation missing within that scope.
- Adapters must not convert malformed content into an invented Skill. Return an issue and, when possible, a low-confidence observation marked malformed.
- Cancellation must return `Cancelled` or a partial outcome; no incomplete result may imply deletion.

## 6. Path Discovery and Cross-Platform Rules

1. Use native path APIs (`Path`/`PathBuf` or equivalent), never string concatenation or hard-coded separators.
2. Resolve home, configuration, cache, and application-data locations through platform APIs. Do not hard-code `~`, `/Users`, `C:\\Users`, or a fixed drive.
3. Keep platform-specific root candidates inside the adapter or a small platform service. Core receives normalized `SkillRoot` values only.
4. Preserve the original display path separately from the path used for filesystem access when case normalization or canonicalization is necessary.
5. Do not follow symbolic links by default. If an adapter supports a constrained link policy, it must detect cycles, retain link provenance, prevent root escape, and report inaccessible links.
6. Treat Windows junctions, macOS privacy controls, Linux distribution differences, and network-mounted volumes as possible partial-scan causes, not reasons to weaken safety rules.
7. Handle case sensitivity conservatively. Identity normalization may case-fold a logical name for comparison, but physical paths and filenames retain native semantics.
8. Root discovery must not create missing folders or mutate an agent configuration to make detection easier.

## 7. Identity, Content Fingerprints, and Conflict Principles

### 7.1 Skill identity

An adapter returns **identity evidence**, not an unquestionable global identity. Preferred evidence order is:

1. A stable, format-defined Skill ID.
2. A trusted declared name plus format and adapter context.
3. A normalized directory name plus entry convention.

The normalized value should be stable, trimmed, Unicode-normalized where supported, and case-normalized only for logical comparison. The Inventory owns final cross-agent grouping and records confidence. Similar names alone must not be treated as proof that two Skills are the same.

### 7.2 Content fingerprints

A `ContentFingerprint` must state the algorithm and the files it covers:

```text
ContentFingerprint {
  algorithm: "sha256"
  version: Integer
  scope: ComparableEntry | DeclaredFileSet | FullInstallation
  digest: String
  excludedPaths?: List<RelativePath>
}
```

The recommended baseline is SHA-256 over a deterministic manifest: sorted relative paths, a separator, and exact file bytes for all adapter-defined comparable files. The manifest must exclude volatile, generated, or agent-private files by documented rule. File timestamps, absolute paths, and directory traversal order must not affect the digest.

If an adapter cannot safely determine a comparable file set, it must return no fingerprint and `comparisonConfidence: None` or `Partial` rather than fabricate equivalence.

### 7.3 Conflict and inconsistency

ASM reports a content inconsistency only when all of the following are true:

1. Installations are grouped as the same logical Skill with sufficient identity confidence.
2. Both have compatible formats and reliable comparable fingerprints.
3. Their fingerprint algorithm, version, and scope are equivalent.
4. Their digests differ.

Different names, unknown fingerprints, incompatible formats, or partial scans are not conflicts. They may produce an explainable `uncomparable` or `needs-review` finding. An adapter does not choose a winner, merge content, or overwrite an installation.

## 8. Read-Only Safety and Permission Boundary

The MVP is read-first. Adapter code is permitted to:

- list directories under trusted Skill roots;
- inspect file metadata;
- read recognized entry and metadata files;
- calculate in-memory fingerprints; and
- register read-only watchers when supported.

Adapter code is prohibited from:

- creating, deleting, moving, renaming, chmod-ing, or changing any agent-owned file;
- invoking an agent command that writes configuration, installs plugins, or updates Skills;
- resolving paths outside trusted roots to read arbitrary user files;
- sending Skill content, paths, or diagnostics to a network service; and
- exposing arbitrary filesystem or shell access through the desktop UI.

ASM-owned logs and SQLite state are written only by core infrastructure, not directly by adapters. Future write capabilities must return a declarative `SyncPlan` with explicit preconditions; a separate Sync Engine may execute that plan only after a user sees and confirms the exact changes.

## 9. Registration, Compatibility, and Tests

### 9.1 Registration

Each built-in adapter is registered explicitly with the Adapter Registry. Registration includes:

- `adapterId`, `agentId`, display name, and adapter version;
- supported platforms and formats;
- capability set and known limitations; and
- a factory or constructor that has no side effects.

Registry loading must isolate an adapter failure: one unavailable or defective adapter must not prevent discovery for other agents. The MVP does not load third-party executable plugins or scripts.

### 9.2 Version compatibility

- An adapter must use semantic versioning for its contract-facing behavior.
- Persisted records retain `adapterId`, adapter version, format version, and fingerprint version so historical observations remain interpretable.
- A breaking change to normalized identity or fingerprint semantics requires a new algorithm/version marker and an inventory re-scan or migration path.
- Unknown future agent layouts are reported as unsupported or partial. They must not be scanned using unverified fallback heuristics that can misidentify user files.

### 9.3 Test requirements

Every adapter must provide automated tests for:

- positive and negative detection on every declared platform family;
- empty roots, missing roots, and multiple roots;
- valid Skill discovery and metadata normalization;
- malformed entries, unreadable files, permission errors, and unsupported layouts;
- deterministic fingerprints despite filesystem enumeration order;
- equivalent and different comparable content;
- path traversal, symlink/junction, case-sensitivity, and root-escape handling;
- partial-scan behavior that does not imply missing installations; and
- the read-only guarantee, including a test fixture or filesystem abstraction that fails any attempted write.

Fixture directories must be synthetic and contain no private user Skill content. Contract tests should be shared so all adapters prove the same core semantics.

## 10. Reference Adapter Shapes

The following pseudocode is illustrative. Actual paths and entry rules must be verified against each agent's supported documentation and versioned behavior before implementation.

### 10.1 Claude Code adapter

```text
class ClaudeCodeAdapter implements AgentAdapter {
  id() => "claude-code"

  descriptor() => AgentDescriptor(
    agentId: "claude-code",
    displayName: "Claude Code",
    supportedSkillFormats: ["skill-directory-v1"]
  )

  detect(context) {
    roots = platformCandidates(context.platform)
      .filter(path => existsDirectory(path))
      .map(path => SkillRoot("claude-code", path, readOnly=true))

    return roots.isEmpty
      ? unavailable("No Claude Code Skill root found")
      : detected(roots)
  }

  scan(context) {
    for each root in context.roots:
      for each child directory in directChildren(root):
        entry = child / "SKILL.md"
        if not existsRegularFile(entry):
          issue("ENTRY_MISSING", child)
          continue

        yield installation(
          location=child,
          identity=identityFromFrontmatterOrDirectory(entry, child),
          entry=entry,
          fingerprint=fingerprintComparableSkillFiles(child)
        )
  }
}
```

The implementation must keep its root candidates and entry rules versioned and documented. It must not assume that every directory below a configuration root is a valid Skill.

### 10.2 Codex adapter

```text
class CodexAdapter implements AgentAdapter {
  id() => "codex"

  descriptor() => AgentDescriptor(
    agentId: "codex",
    displayName: "Codex",
    supportedSkillFormats: ["skill-directory-v1"]
  )

  detect(context) {
    roots = resolveCodexSkillCandidates(context.platform)
      .filter(path => existsDirectory(path))
      .map(path => SkillRoot("codex", path, readOnly=true))

    return roots.isEmpty
      ? unavailable("No Codex Skill root found")
      : detected(roots)
  }

  scan(context) {
    validatedRoots = requireRootsOwnedBy("codex", context.roots)
    return scanSkillDirectories(
      validatedRoots,
      entryName="SKILL.md",
      identityRule=frontmatterThenDirectory,
      fingerprintRule=deterministicDeclaredFileSet
    )
  }
}
```

Even when Claude Code and Codex currently share a similar `SKILL.md` convention, they remain separate adapters. Their root discovery, metadata interpretation, compatibility, and future installation behavior may diverge.

## 11. MVP Compliance Checklist

An adapter is MVP-compliant only when it:

- implements `descriptor`, `capabilities`, `detect`, and `scan`;
- returns structured diagnostics and scan completeness;
- scans only trusted roots and never writes agent-owned files;
- produces stable identity evidence and versioned fingerprints when comparison is supported;
- keeps agent-specific rules out of inventory and UI code;
- has fixture and contract tests for normal, partial, and unsafe filesystem cases; and
- marks `watch` and all installation/synchronization methods as deferred unless separately implemented under their own confirmed-write specification.

This contract allows ASM to discover and compare Skills safely today while preserving a clear, explicit path to future user-confirmed synchronization.
