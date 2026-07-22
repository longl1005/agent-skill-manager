# Discovery Inventory UI (M0) Design

**Date:** 2026-07-22  
**Status:** Approved design; awaiting review of this written specification  
**Scope:** Complete the usable, in-memory discovery flow: scan Claude Code Skills once and present the same normalized result in Dashboard, Library, Agent Matrix, and Agents.

## Goal

Turn the existing one-page scan demo into a coherent Discovery MVP without adding persistence, write operations, or another agent adapter.

## Boundaries

Included:

- Resolve the host platform at runtime/compile target instead of assuming macOS.
- Remove all production `Box::leak` usage from scanning.
- Normalize a scan report into a read-only in-memory inventory.
- Share the latest scan report through a frontend store.
- Render real data in Dashboard, Library, Agent Matrix, and Agents.

Excluded:

- SQLite, scan history, filesystem watching, migration code, or a database dependency.
- Codex implementation, synchronization planning, installation, updating, deletion, or any write to agent-owned files.
- Changes to the Skill recognition/fingerprint algorithm already covered by the Claude Code adapter tests.

## Architecture

The Rust command remains the boundary that calls registered adapters. It owns short-lived `PlatformContext`, root, and scan-context values and passes ordinary borrows into adapter methods. `Platform::current()` maps `cfg!(target_os)` to `MacOs`, `Linux`, or `Windows`; unsupported targets use an explicit command error rather than an invented platform.

`modules::inventory` gains a pure, in-memory projection function. It consumes `ScanReport` and produces a normalized inventory with three views: skills, agents, and matrix cells. The command retains `last_report` only as the latest raw report; it does not introduce database semantics. The Tauri response continues to be `ScanReport`, keeping the IPC contract small and compatible with the existing dashboard.

On the frontend, a Zustand scan store owns `{ report, scanning, error, scan() }`. The App shell mounts all routes under that store. No route calls Tauri directly: Dashboard triggers `scan()`, while all four data pages select the same `report` and render a consistent empty/loading/error state.

## Domain Projection

The backend inventory projection derives:

| View | Identity | Contents |
| --- | --- | --- |
| Skill | exact `SkillReport.name` | name, description, installations, distinct agents, distinct fingerprints |
| Agent | `AgentReport.agent_id` | detection status, roots, skills, issues, outcome |
| Matrix cell | `(skill name, agent id)` | `Missing`, `Present`, or `Conflict` |

`Present` means exactly one fingerprint for that agent/skill pair. `Conflict` means more than one distinct non-empty fingerprint for the pair; this anticipates user- and project-scope duplicates. A missing fingerprint is displayed as `Unknown` metadata, not treated as a conflict. At this stage, identical names are the explicit grouping key; cross-name semantic matching is deferred.

The frontend can derive equivalent display data from `ScanReport`, but Rust owns the canonical projection and tests its grouping rules. The IPC response is not expanded until pages require aggregate fields unavailable from the raw report.

## Page Behaviour

### Dashboard

Keep the existing scan button, timing, agent sections, skills table, and issue list. Replace local component state with the shared store so its data remains visible after navigating away and back.

### Library

Show one row per skill name. Each row displays description, number of agents, number of installations, and status: `Consistent`, `Conflict`, or `Unknown`. Selecting a row is out of scope; no routing or detail page is added.

### Agent Matrix

Show a table with skill names as rows and detected agents as columns. Cells show `—` for missing, `✓` for present, and `!` for conflict. With no scan, show the existing scan prompt. With a scan but no skills, show an explicit “No Skills found” state.

### Agents

Show one card per registered/scanned agent: display name, detection status, outcome, root count, skill count, and issue count. Expandable detail is deferred; roots are listed inline beneath each card.

## Errors and Empty States

- Command invocation failure sets one shared error message; existing scan data stays rendered.
- A scan with unavailable agents is successful discovery and shows each adapter’s issues; it is not a frontend exception.
- Before the first scan, every data page prompts the user to scan.
- While scanning, Dashboard disables the button and all data pages retain the previous report (or show a loading prompt when none exists).

## Testing and Acceptance

Rust unit tests cover:

1. Host-platform mapping on the compiled platform.
2. Inventory grouping across two agents.
3. A same-agent duplicate with different fingerprints produces `Conflict`.
4. Empty fingerprints do not create a false conflict.

Frontend type checking and production build must pass. The release gate is:

```bash
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

Manual acceptance: after one scan, navigating among Dashboard, Library, Agent Matrix, and Agents shows the same scan timestamp and data-derived counts without initiating another scan.

## Decisions

- Use the recommended in-memory-first approach; persistence is intentionally a separate milestone.
- Do not add a generic async scanner yet. The existing adapter scan is fast and synchronous; the frontend’s `scanning` state prevents duplicate invocations.
- Do not add dependencies for this scope.
- Keep existing raw `ScanReport` IPC fields to avoid a speculative API redesign.
