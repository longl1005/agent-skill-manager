# Performance Diagnostics Design

## Goal

Make Windows performance regressions measurable in an installed build without
collecting or transmitting user content. An opt-in diagnostic mode must show
whether elapsed time comes from full Agent scans, content fingerprinting,
master-library link reconciliation, SQLite writes, or duplicated frontend
requests.

## Scope

- Add a Settings-controlled, persisted performance-diagnostics switch.
- Record compact, local timing events only while the switch is enabled.
- Record backend work for `scan_agents` and `get_master_skills`, plus the
  frontend request lifecycle that invokes them.
- Provide Settings actions to export the current report and clear reports.
- Use the report to make later performance fixes evidence-based.

## Non-goals

- No remote telemetry, analytics service, account identifier, or automatic
  upload.
- No skill content, skill names, descriptions, file paths, machine user name,
  environment variables, or command output in diagnostics.
- No live profiler view or continuous process-level CPU and memory monitor.
- No caching, incremental scanning, or database redesign in this change.

## User Experience

The Settings page gains a `Performance diagnostics` section.

- Diagnostics are off by default.
- When enabled, explanatory copy states that only timings and counts are kept
  locally, never uploaded, and may be exported for troubleshooting.
- `Export diagnostic report` opens the normal save dialog and writes a JSONL
  copy of the retained entries.
- `Clear diagnostic reports` removes retained diagnostic data after a
  confirmation dialog.
- The section displays the local report directory and the time of the newest
  event. It must not show individual paths or skill names.

The switch is intended for a user reproducing a lag on an installed Windows
build. It remains enabled across restarts until the user turns it off, so a
slow startup can be captured.

## Architecture

```text
Settings toggle
  -> persisted diagnostic configuration
  -> frontend PerformanceTrace request events
  -> Tauri commands
       -> backend PerformanceRecorder spans
       -> in-memory bounded event queue
       -> rotated local JSONL session file
  -> Settings export / clear actions
```

### Configuration

Store a single Boolean `performance_diagnostics_enabled` with the existing
local application configuration. Reading this setting must occur once when the
app initializes. When disabled, the recorder uses a no-op path that performs
only the Boolean check; it does not allocate event data, open report files, or
inspect the filesystem.

### Event model

Every operation receives a UUID `operation_id`. A backend event has this
shape:

```json
{
  "schema_version": 1,
  "timestamp_ms": 0,
  "operation_id": "uuid",
  "operation": "scan_agents",
  "phase": "adapter_scan",
  "subject": "claude-code",
  "duration_ms": 0,
  "counters": {
    "roots": 1,
    "skills": 12,
    "fingerprinted_files": 44,
    "master_skills": 0,
    "agent_link_checks": 0,
    "database_writes": 0
  },
  "outcome": "success"
}
```

`subject` is restricted to fixed operation and Agent identifiers already
shipped by the application. It is never a filesystem-derived value. Counters
are omitted when irrelevant. Failure events contain a fixed error category
(for example `io_error` or `database_error`), not the error message, because
messages may contain paths.

The frontend records matching lifecycle events for each IPC request:

```json
{
  "schema_version": 1,
  "timestamp_ms": 0,
  "operation_id": "uuid",
  "operation": "get_master_skills",
  "phase": "ipc_request",
  "duration_ms": 0,
  "counters": { "in_flight_same_operation": 2 },
  "outcome": "success"
}
```

This identifies duplicated or overlapping requests without recording UI input
or application state beyond a count.

### Backend instrumentation

Use `std::time::Instant` for durations; wall-clock time is used only to order
events.

`scan_agents` records:

1. one overall `scan_agents` event;
2. one `adapter_detect` event per registered adapter;
3. one `adapter_scan` event for each adapter with roots;
4. one `skill_fingerprint` aggregate per adapter, including the number of
   skills and comparable files fingerprinted;
5. one `report_serialization` event for the final DTO conversion.

`scan_master_repo` records:

1. one overall `get_master_skills` event;
2. one `master_enumeration` event;
3. one aggregate `link_reconciliation` event with master-skill count and
   Agent link-check count;
4. one `sqlite_sync` event with master-skill upserts and Agent-symlink upserts.

Instrumentation must be aggregate-first: it must not write one event per
individual Skill or file. The exception is a per-Adapter scan event, because
that is necessary to identify an expensive adapter and is bounded by the
supported Adapter list.

### Storage and retention

Store diagnostics under the application data directory, in a dedicated
`diagnostics` child directory. Do not use a temporary directory or browser
storage, because Windows startup diagnostics must survive an application
restart.

The recorder appends newline-delimited JSON records to a session file. Before
an append, it rotates files so that each file is at most 2 MiB and at most five
files are retained. Rotation and retention failures are swallowed and counted
in an in-memory `diagnostic_write_failure` metric; diagnostics must never make
a normal Agent operation fail.

All writes occur after the measured operation completes. The implementation
must not flush a file after every span. A bounded queue of at most 256 events
is drained as one append operation at the end of the parent operation, keeping
diagnostics from materially changing the observed latency.

### Request correlation and concurrency

Frontend calls create and pass an optional `operation_id` to the matching
Tauri command. Existing callers that do not pass one get a backend-generated
UUID. The frontend maintains an in-memory count by command name while
diagnostics are enabled, records the count at request start, and decrements it
in `finally`.

The diagnostic mode observes overlapping scans; it does not prevent them.
Request coalescing is a later optimization that needs data from this mode.

## Error Handling

- If configuration cannot be read, diagnostics default to disabled.
- A malformed historical JSONL line is skipped during export, not surfaced in
  the UI.
- An unavailable report directory disables only report persistence for the
  current session; the associated business operation still completes.
- Export writes a new filtered copy. It never moves or deletes retained logs.
- Clear removes only files inside the resolved diagnostics directory, after
  verifying that it is the application-owned path.

## Testing

### Rust unit tests

- Disabled recorder emits no events and never creates a directory.
- A recorded `scan_agents` operation has one parent event and only allowed
  fields; serialized text contains no supplied file path or skill name.
- Rotation keeps no more than five files and no file above 2 MiB after a
  completed append.
- A report-write error does not change the result of a simulated scan.
- Master-library counters match a fixture with known master skills and known
  supported Agents.

### Frontend tests

- Settings renders diagnostics disabled by default.
- Enabling diagnostics persists the configuration and enables request timing.
- A traced IPC call records its duration and concurrent-request count, and the
  count returns to zero if the call rejects.
- Export is disabled when no report exists; clear requires confirmation.

### Manual Windows verification

1. Install a release build with at least ten detected Agents and a populated
   master library.
2. Enable diagnostics, restart the app, and wait for startup to finish.
3. Run one link/unlink operation and one explicit refresh.
4. Export the report and verify it contains timings and counts only.
5. Confirm each operation has an overall duration, per-Adapter scan durations,
   master-library reconciliation duration, SQLite duration, and frontend
   in-flight counts.
6. Confirm disabling diagnostics stops new report files and does not change
   normal operation results.

## Success Criteria

The exported report lets us answer all of the following from one Windows
reproduction:

1. Which top-level command has the highest elapsed time?
2. Which Agent, if any, dominates `scan_agents`?
3. How much time is spent fingerprinting compared with discovery?
4. How much time is spent reconciling master Skill links and synchronizing
   SQLite?
5. Did startup or a user action issue duplicate or overlapping scans?

Once these are answered, the next change can target the dominant cost with a
measurable before/after comparison.
