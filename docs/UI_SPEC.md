# ASM UI Specification (V1)

## 1. Purpose and scope

This document defines the first-version user interface for **Agent Skill Manager (ASM)**: a cross-platform desktop application that discovers, inventories, analyzes, and eventually synchronizes Skills across local AI agents.

The V1 UI is intentionally centered on **visibility before control**. Its primary outcome is that a user can understand which agents and Skills exist on the computer, where each Skill is installed, and where the inventory needs attention. The first discovery milestone is read-only: scanning must not alter an agent's files.

Synchronization controls may be represented as future-facing, disabled, or informational entry points where useful, but they must not imply that V1 silently writes to an agent directory.

### 1.1 Design goals

- Make a multi-agent Skill inventory understandable at a glance.
- Make installation state and content drift visible without requiring users to inspect folders.
- Keep common actions close to the information that motivates them.
- Make potentially destructive operations explicit, previewable, and reversible when synchronization is introduced.
- Give the product a focused desktop-tool feel: fast, calm, compact, and trustworthy.

### 1.2 Design principles

1. **Inventory first.** The product opens with the current state of the user's Skills, not an editor or a file browser.
2. **Skills are assets; installations are relationships.** A Skill can appear in several agents. The UI must distinguish the shared asset from each agent-specific installation.
3. **State is explicit.** Missing, matching, changed, conflict, unsupported, and unknown states must be visually distinct and explained in text.
4. **Read-only by default.** Discovery and analysis never modify local files. Future writes require a clear source, target, preview, and confirmation.
5. **Progressive disclosure.** Dashboard and matrix views answer global questions; details, paths, hashes, and diagnostics appear only when requested.
6. **No false precision.** Usage, version, and "last used" signals are displayed only when a supported adapter can supply reliable data.
7. **Cross-platform consistency.** The information model and primary interaction patterns are shared across macOS, Windows, and Linux; platform conventions are respected for shortcuts, dialogs, and window behavior.

## 2. Information architecture

V1 has six primary destinations:

| Destination | Purpose | Primary question answered |
| --- | --- | --- |
| Dashboard | Overall inventory health and next actions | What needs my attention? |
| Agent Matrix | Cross-agent coverage and consistency | Which Skills are installed where? |
| Skills | Searchable canonical Skill inventory | What Skills do I have? |
| Agents | Detected agents and their local inventories | What does this agent contain? |
| Scan History | Past scans and their findings | What changed, and when? |
| Settings | Scan and application preferences | How should ASM behave? |

### 2.1 Secondary views

The following views are reached from the primary destinations rather than occupying primary navigation:

- **Skill Detail** — from Skills, Matrix rows, Dashboard findings, or Agent Detail.
- **Agent Detail** — from Agents, Matrix columns, or Dashboard cards.
- **Conflict Center** — from Dashboard findings, Matrix conflict states, Skill Detail, or Agent Detail.
- **Scan Detail** — from Scan History.

## 3. Global navigation and application shell

### 3.1 Application shell

The desktop window uses a persistent left sidebar, a compact top utility bar, and a content workspace.

- **Sidebar:** product mark and name; the six primary destinations; a compact scan-status indicator at the bottom.
- **Top utility bar:** current page title, global search, a `Scan now` action, and an overflow area for contextual actions.
- **Content workspace:** page-specific content with consistent page padding and a clear primary action.
- **Status feedback:** transient toasts for completed actions, and inline status where action state must remain visible.

On macOS, application commands follow standard menu-bar and `⌘` shortcut conventions. Windows and Linux use `Ctrl` equivalents. The app should never depend on a hover-only interaction for a core action.

### 3.2 Global search

Global search is available from the top utility bar and via `⌘/Ctrl + K`.

It searches Skills and Agents first, then provides direct navigation to relevant destinations and recent scans. Results display object type, name, concise state, and relevant agent context. Search is a navigation aid in V1; it does not execute write operations.

### 3.3 Scan controls

`Scan now` starts a new read-only scan. While a scan is running, the control shows progress and opens a small progress panel listing discovered agents, completed adapters, and failures. Users can continue browsing previously scanned inventory while a scan runs.

The app must show the timestamp and result state of the most recent completed scan in a consistently discoverable location.

## 4. Dashboard

### 4.1 Purpose

Dashboard is the default landing page. It summarizes the local inventory and guides the user to the highest-value follow-up view; it is not a duplicate of the Matrix or Skills list.

### 4.2 Core metrics

Display a compact, scannable metric row:

- **Detected agents** — number of agents detected by installed adapters.
- **Installed Skills** — total installations, with an optional distinct-Skills count where it is unambiguous.
- **Needs attention** — count of installations with drift, missing paths, or unresolved conflicts.
- **Last scan** — relative time and completed/partial/failed state.

Each metric links to its corresponding filtered destination. Metrics show a short explanatory tooltip when their calculation may be non-obvious.

### 4.3 Health Score

The Health Score is a directional inventory indicator, not a measure of Skill quality. It aggregates detectable conditions such as:

- adapters that failed to scan;
- installations with missing or unreadable paths;
- name or content divergence among comparable Skill installations;
- unresolved conflicts;
- stale scan information.

Present the score as a labeled status (`Healthy`, `Needs attention`, or `Scan incomplete`) plus the contributing issue counts. Do not show a percentage when ASM lacks sufficient scan coverage; use `Unavailable` or `Scan incomplete` instead.

Selecting the card opens a filtered operational findings view, normally Conflict Center or the appropriate Matrix state.

### 4.4 Recent Scan

Show a concise card for the latest scan with:

- start and completion time;
- agents scanned, skipped, and failed;
- Skill installations discovered or changed since the previous scan;
- a link to scan detail and full Scan History.

If no scan exists, Dashboard prioritizes a clear onboarding empty state with a single `Scan this computer` action and a short explanation that scanning is read-only.

### 4.5 Quick Actions

Quick Actions are limited to safe, high-frequency tasks:

- `Scan now`
- `View Agent Matrix`
- `Browse Skills`
- `Review conflicts` (shown only when conflicts exist)
- `Open scan history`

Future synchronization actions may be listed in a non-primary `Coming soon` section only if doing so does not distract from discovery. V1 must not present an enabled `Fix all` control without a preview-and-confirm workflow.

## 5. Agent Matrix

### 5.1 Purpose

Agent Matrix is ASM's signature comparison view. Rows represent Skills and columns represent detected Agents. Each cell represents the current installation relationship between one Skill and one Agent.

It answers: which agent has this Skill, which installation is missing, and which copies need investigation?

### 5.2 Matrix layout

- The first column is pinned and contains Skill name, optional source/type badge, and an aggregate status.
- Agent columns have an icon, name, and Skill-installation count. They remain horizontally scrollable on narrower windows.
- Cells use an icon, accessible label, and short status text on focus or hover; color alone is never the only signal.
- A final summary column may show coverage (for example, `3 of 4 supported agents`) and an aggregate issue badge.

### 5.3 Cell states

| State | Meaning | V1 interaction |
| --- | --- | --- |
| Installed and matching | A detected installation matches the comparison baseline | Open installation details |
| Installed, different content | A comparable installation exists but its content differs | Open Skill Detail or Conflict Center |
| Missing | No detected installation at the expected location | Open Skill Detail; future install target |
| Conflict | Multiple changes or no safe comparison baseline | Open Conflict Center |
| Unsupported | The agent adapter does not support this Skill format or comparison | Show reason on hover/focus |
| Unknown | Adapter data is incomplete or scan did not finish | Link to relevant scan issue |

“Matching” is valid only when ASM has enough adapter data to make that comparison. If a Skill lacks a reliable identity or baseline, use `Unknown` rather than claiming it is synchronized.

### 5.4 Search, filtering, and sorting

The Matrix supports:

- text search by Skill name;
- agent filter (show selected agents only);
- state filter (`Needs attention`, `Missing`, `Different`, `Conflict`, `Unknown`);
- source filter where known (official, community, imported, custom);
- sort by name, coverage, issue count, or recently scanned;
- an optional `Only differences` mode that hides fully matching rows.

Filters are visible, removable, and reflected in the result count. The current filter state should be preserved while navigating to a detail view and back.

### 5.5 Conflict indication and future sync entry points

Conflicts receive the highest visual priority: a clear warning icon in the cell, aggregate badge on the Skill row, and an accessible textual explanation.

For V1, selecting a matrix cell opens read-only details. A reserved contextual area may describe future actions such as `Install`, `Update`, `Remove`, and `Align`, but these are disabled and labeled as unavailable until the synchronization engine, preview, and confirmation flow exist. This prevents the interface from promising unsafe or unsupported writes.

## 6. Skills and Skill Detail

### 6.1 Skills list

The Skills destination provides a searchable, sortable inventory of distinct Skill assets inferred from the latest scan. Each row or card shows:

- Skill name;
- source or origin when known;
- installed-agent coverage;
- aggregate state (`Healthy`, `Different`, `Conflict`, `Unknown`);
- last scanned time;
- optional usage signal only when supplied reliably by an adapter.

The list must make uncertainty visible. A name match is not automatically a single Skill asset if identity or contents cannot be compared with confidence.

### 6.2 Skill Detail

Skill Detail focuses on one Skill asset and its installations. It contains the following sections:

1. **Header** — name, source/type, aggregate state, and open-in-file-manager action.
2. **Overview** — description and metadata when discoverable, plus coverage and most recent scan state.
3. **Installations** — one entry per agent: location, detected identity or content fingerprint, status, and last scan time.
4. **Comparison** — concise explanation of matching, different, conflict, or unknown status. File-level comparison can be introduced when the core supports it.
5. **Diagnostics** — unreadable paths, missing entry files, adapter limitations, and related scan errors.
6. **Activity** — scan observations related to the Skill.

For external Skills, `Open in file manager` is the primary edit affordance. ASM V1 does not include a Skill authoring editor or a hidden direct-edit path.

## 7. Agents and Agent Detail

### 7.1 Agents list

Agents shows one card or row per supported adapter and locally detected installation. It distinguishes:

- detected and scanned;
- detected but unavailable or unreadable;
- not detected;
- scan failed;
- unsupported platform or configuration.

Each item shows agent name, detected path where safe to reveal, number of discovered Skill installations, adapter status, and most recent scan outcome.

### 7.2 Agent Detail

Agent Detail is the inventory view for a single agent. It includes:

1. **Header** — agent identity, availability status, detected executable/configuration path where applicable, and `Scan now` for that adapter.
2. **Summary** — discovered Skill count, scan timestamp, adapter version/capabilities, and issue count.
3. **Installed Skills** — searchable list of installations for this agent, with their comparison state and path.
4. **Adapter diagnostics** — known directory conventions, permission/read errors, unsupported Skill formats, and scan logs relevant to this agent.
5. **Future management area** — reserved, disabled controls for installation alignment only after the write-capable release is available.

## 8. Conflict Center

### 8.1 Purpose

Conflict Center is the dedicated work queue for ambiguous or potentially unsafe Skill relationships. It avoids presenting all content divergence as a problem: it only lists cases where ASM cannot safely establish a single consistent state or where user review is required.

### 8.2 Conflict list

Each conflict item shows:

- Skill identity or provisional name;
- involved agents and paths;
- reason for conflict (for example, divergent content, changed files, unclear identity, or incomplete scan);
- detection timestamp;
- severity and whether the issue blocks future synchronization.

Items can be filtered by agent, reason, and severity, and can be opened in Skill Detail for the full installation context.

### 8.3 V1 resolution behavior

V1 provides investigation, not automatic repair. It may offer read-only comparison metadata and open-location actions. It must not overwrite, merge, or delete a Skill from Conflict Center.

When synchronization is introduced, each resolution must begin with a source selection and a preview of every affected file and agent. Conflicts must never be resolved through an unlabeled bulk operation.

## 9. Scan History

Scan History records completed, partial, failed, and canceled scans. Each entry contains timestamp, duration, agents considered, per-agent result, installation changes detected, and errors.

Scan Detail provides enough information to diagnose an adapter problem without exposing unnecessary technical noise by default. Raw paths and technical diagnostics are available behind an expandable details section for users who need them.

## 10. Settings

Settings is grouped into clear sections:

### 10.1 General

- appearance preference (system, light, dark);
- language;
- launch and window behavior where supported.

### 10.2 Scanning

- manually configured agent locations;
- scan frequency or startup-scan preference;
- permission and unreadable-location guidance;
- option to clear local scan history and inventory cache, with confirmation.

### 10.3 Agents and adapters

- enabled adapters;
- adapter discovery status and supported capabilities;
- per-agent custom location override;
- reset override action.

### 10.4 Privacy and data

- explanation that V1 scans locally and does not upload Skill content;
- local data storage location;
- export diagnostic summary (excluding Skill contents by default);
- clear local application data with an explicit destructive confirmation.

Settings must distinguish app-maintained inventory data from the user's original agent Skill directories. Clearing ASM data must never delete external Skill files.

## 11. Common interaction standards

### 11.1 Loading

- Use skeletons for page-level content when layout is known.
- Use inline spinners for local actions such as a single-adapter scan.
- Preserve last successful inventory data during a background scan and label it as stale if necessary.
- Always show scan progress in terms the user understands: agent name, completed count, and any failure.

### 11.2 Empty states

Empty states explain why the view is empty and offer one focused next step.

- No scan yet: explain read-only discovery and show `Scan this computer`.
- No detected agents: explain supported-agent discovery and link to adapter settings.
- No matching Skills: show active filters and `Clear filters`.
- No conflicts: confirm that no review-required conflicts were found in the latest completed scan.

### 11.3 Error states

Errors identify the affected agent or operation, state the user-facing consequence, and offer a useful recovery path such as retrying the adapter scan, reviewing path settings, or opening technical details. Avoid vague messages such as “Something went wrong.”

### 11.4 Toasts

Use toasts only for short-lived confirmation or non-blocking failure notices. A toast includes an action when appropriate (for example, `View scan`). Important failures remain visible in the relevant page or Scan History after the toast disappears.

### 11.5 Dialogs and confirmations

Dialogs are reserved for decisions requiring confirmation, particularly cache clearing, history clearing, or future file writes. They state the scope and consequence in plain language and use explicit buttons, such as `Clear scan cache`, rather than generic `OK`.

Future synchronization dialogs must include selected source, selected target agents, affected Skill count, file-change preview, conflict count, and a cancel path. There is no silent or default overwrite action.

### 11.6 Accessibility and keyboard support

- Every status has text and icon support in addition to color.
- All controls are keyboard reachable and show a visible focus state.
- Tables and matrix cells expose descriptive accessible labels.
- Keyboard shortcuts are discoverable and avoid platform-reserved combinations.
- Text contrast, target size, and motion settings follow the operating system's accessibility preferences where feasible.

## 12. Responsive desktop layout

ASM is desktop-first, optimized for a comfortable working window from approximately 1024 px wide upward.

| Window width | Layout behavior |
| --- | --- |
| Wide desktop (>= 1440 px) | Persistent sidebar; full metric row; Matrix supports several visible agent columns and optional inspector panel. |
| Standard desktop (1024–1439 px) | Persistent compact sidebar; metric cards wrap as needed; Matrix retains pinned Skill column and horizontal agent-column scrolling. |
| Narrow desktop (< 1024 px) | Collapsible sidebar; actions move into an overflow menu; dashboard cards stack; Matrix switches to a focused-agent or horizontal-scroll mode without removing status information. |

The product does not target phone-sized layouts in V1. Window resizing must not hide primary actions or convert important table status into icon-only ambiguity.

## 13. Visual and interaction direction

ASM should feel like a modern developer operations tool designed for a native desktop environment:

- **Modern and restrained:** generous whitespace, clear hierarchy, low visual noise, and minimal decoration.
- **Professional rather than playful:** neutral base surfaces with a focused accent color; warning, error, and success colors are reserved for state communication.
- **Information-dense when needed:** Matrix and inventory tables prioritize alignment, readability, pinned context, and scanability over oversized cards.
- **Native-feeling in Tauri:** responsive interactions, compact chrome, platform-appropriate file/folder behavior, and no web-page-like excessive scrolling or marketing-style sections.
- **Trustworthy:** operational status uses precise language, timestamps, and visible uncertainty rather than optimistic assumptions.

Suggested visual foundations:

- system UI typography with a monospace treatment for paths, fingerprints, and technical diagnostics;
- a small, consistent radius and subtle elevation for cards and dialogs;
- standardized status badges for `Healthy`, `Different`, `Conflict`, `Missing`, `Unknown`, and `Scan failed`;
- familiar line icons paired with labels for high-impact actions;
- light and dark themes with equivalent contrast and status meaning.

## 14. V1 acceptance criteria

The first UI release satisfies this specification when a user can:

1. start a read-only scan and understand progress and outcome;
2. see detected agents, discovered Skill installations, and latest scan state on Dashboard;
3. find a Skill or agent through navigation or global search;
4. compare installations in Agent Matrix and distinguish matching, missing, different, conflict, unsupported, and unknown states;
5. inspect the paths, scan observations, and diagnostics behind a Skill or agent status;
6. review conflicts without ASM altering any original Skill files; and
7. configure scan locations and adapters while clearly understanding that ASM stores local inventory data separately from agent directories.

Future synchronization work must extend this specification with preview, confirmation, rollback, and write-safety requirements before any installation update, removal, or alignment control is enabled.
