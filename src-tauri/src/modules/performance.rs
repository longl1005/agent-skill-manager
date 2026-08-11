//! Local, opt-in performance diagnostics.
//!
//! Reports contain only fixed operation names, phase names, durations, outcomes, timestamps, and
//! aggregate counters. Callers may provide a subject while timing a phase, but it is deliberately
//! never persisted.

use crate::modules::db;
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const DIAGNOSTICS_DIRECTORY: &str = "diagnostics";
const MAX_REPORT_FILES: usize = 5;
const MAX_REPORT_BYTES: usize = 2 * 1024 * 1024;
const REPORT_PREFIX: &str = "performance-";
static REPORT_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticContext {
    pub operation_id: String,
    pub in_flight_same_operation: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticOperation {
    ScanAgents,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticPhase {
    AdapterScan,
    ReadSkill,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticErrorCategory {
    Io,
    Parse,
    Permission,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiagnosticOutcome {
    Success,
    Cancelled,
    Error(DiagnosticErrorCategory),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PerformanceEventType {
    AdapterScan,
    Phase,
    Operation,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventCounters {
    pub items_examined: u64,
    pub items_matched: u64,
    pub issues_found: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceEvent {
    pub event_type: PerformanceEventType,
    pub timestamp_ms: u128,
    pub operation_id: String,
    pub operation: DiagnosticOperation,
    pub phase: Option<DiagnosticPhase>,
    pub duration_ms: u128,
    pub outcome: DiagnosticOutcome,
    pub in_flight_same_operation: u32,
    pub counters: EventCounters,
}

impl PerformanceEvent {
    /// Records aggregate scan counts without retaining the adapter identifier.
    pub fn adapter_scan(
        _adapter: &str,
        duration_ms: u128,
        items_examined: u64,
        issues_found: u64,
    ) -> Self {
        Self {
            event_type: PerformanceEventType::AdapterScan,
            timestamp_ms: timestamp_ms(),
            operation_id: String::new(),
            operation: DiagnosticOperation::ScanAgents,
            phase: Some(DiagnosticPhase::AdapterScan),
            duration_ms,
            outcome: DiagnosticOutcome::Success,
            in_flight_same_operation: 0,
            counters: EventCounters {
                items_examined,
                items_matched: 0,
                issues_found,
            },
        }
    }

    fn phase(
        operation_id: String,
        operation: DiagnosticOperation,
        phase: DiagnosticPhase,
        duration_ms: u128,
        in_flight_same_operation: u32,
        counters: EventCounters,
        outcome: DiagnosticOutcome,
    ) -> Self {
        Self {
            event_type: PerformanceEventType::Phase,
            timestamp_ms: timestamp_ms(),
            operation_id,
            operation,
            phase: Some(phase),
            duration_ms,
            outcome,
            in_flight_same_operation,
            counters,
        }
    }

    fn operation(
        operation_id: String,
        operation: DiagnosticOperation,
        duration_ms: u128,
        in_flight_same_operation: u32,
        outcome: DiagnosticOutcome,
    ) -> Self {
        Self {
            event_type: PerformanceEventType::Operation,
            timestamp_ms: timestamp_ms(),
            operation_id,
            operation,
            phase: None,
            duration_ms,
            outcome,
            in_flight_same_operation,
            counters: EventCounters::default(),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceDiagnosticsSummary {
    pub report_count: usize,
    pub event_count: usize,
}

pub struct OperationRecorder {
    enabled: bool,
    operation_id: String,
    operation: DiagnosticOperation,
    started_at: Instant,
    events: Vec<PerformanceEvent>,
    report_root: PathBuf,
    in_flight_same_operation: u32,
}

impl OperationRecorder {
    /// Creates a disabled recorder whose production report root is derived from the database path.
    pub fn disabled() -> Self {
        Self::new(
            false,
            production_report_root(),
            DiagnosticOperation::ScanAgents,
            None,
        )
    }

    /// Creates an enabled recorder whose production report root is derived from the database path.
    pub fn enabled(operation: DiagnosticOperation, context: Option<DiagnosticContext>) -> Self {
        Self::new(true, production_report_root(), operation, context)
    }

    #[cfg(test)]
    fn disabled_at(report_root: &Path) -> Self {
        Self::new(
            false,
            report_root.to_path_buf(),
            DiagnosticOperation::ScanAgents,
            None,
        )
    }

    #[cfg(test)]
    fn enabled_at(
        report_root: &Path,
        operation: DiagnosticOperation,
        context: Option<DiagnosticContext>,
    ) -> Self {
        Self::new(true, report_root.to_path_buf(), operation, context)
    }

    fn new(
        enabled: bool,
        report_root: PathBuf,
        operation: DiagnosticOperation,
        context: Option<DiagnosticContext>,
    ) -> Self {
        let (operation_id, in_flight_same_operation) = context
            .map(|context| {
                let operation_id = Uuid::parse_str(&context.operation_id)
                    .map(|id| id.to_string())
                    .unwrap_or_else(|_| Uuid::new_v4().to_string());
                (operation_id, context.in_flight_same_operation)
            })
            .unwrap_or_else(|| (Uuid::new_v4().to_string(), 0));

        Self {
            enabled,
            operation_id,
            operation,
            started_at: Instant::now(),
            events: Vec::new(),
            report_root,
            in_flight_same_operation,
        }
    }

    pub fn start_phase(
        &mut self,
        phase: DiagnosticPhase,
        _subject: Option<&str>,
    ) -> PhaseGuard<'_> {
        PhaseGuard {
            recorder: self,
            phase,
            started_at: Instant::now(),
            outcome: DiagnosticOutcome::Success,
        }
    }

    pub fn record_counted_phase(
        &mut self,
        phase: DiagnosticPhase,
        _subject: Option<&str>,
        counters: EventCounters,
        started_at: Instant,
        outcome: DiagnosticOutcome,
    ) {
        if !self.enabled {
            return;
        }

        self.events.push(PerformanceEvent::phase(
            self.operation_id.clone(),
            self.operation,
            phase,
            started_at.elapsed().as_millis(),
            self.in_flight_same_operation,
            counters,
            outcome,
        ));
    }

    /// Completes an operation. Diagnostic persistence failures are intentionally non-fatal.
    pub fn finish(mut self, outcome: DiagnosticOutcome) -> Result<(), ()> {
        if !self.enabled {
            return Ok(());
        }

        self.events.push(PerformanceEvent::operation(
            self.operation_id.clone(),
            self.operation,
            self.started_at.elapsed().as_millis(),
            self.in_flight_same_operation,
            outcome,
        ));

        let diagnostics_dir = diagnostics_dir(&self.report_root);
        if fs::create_dir_all(&diagnostics_dir).is_err() {
            return Ok(());
        }

        let _write_lock = REPORT_WRITE_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        for chunk in event_chunks(&self.events) {
            rotate_reports(&diagnostics_dir, MAX_REPORT_FILES.saturating_sub(1));
            if write_report_chunk(&diagnostics_dir, &chunk).is_err() {
                return Ok(());
            }
        }

        Ok(())
    }
}

pub struct PhaseGuard<'a> {
    recorder: &'a mut OperationRecorder,
    phase: DiagnosticPhase,
    started_at: Instant,
    outcome: DiagnosticOutcome,
}

impl PhaseGuard<'_> {
    pub fn finish(mut self, outcome: DiagnosticOutcome) {
        self.outcome = outcome;
    }
}

impl Drop for PhaseGuard<'_> {
    fn drop(&mut self) {
        self.recorder.record_counted_phase(
            self.phase,
            None,
            EventCounters::default(),
            self.started_at,
            self.outcome,
        );
    }
}

/// Exports validated JSONL event lines from the database-derived diagnostics directory.
pub fn export_reports(destination: &Path) -> Result<PerformanceDiagnosticsSummary, ()> {
    export_reports_from(&production_report_root(), destination)
}

#[cfg(test)]
fn export_reports_at(
    report_root: &Path,
    destination: &Path,
) -> Result<PerformanceDiagnosticsSummary, ()> {
    export_reports_from(report_root, destination)
}

fn export_reports_from(
    report_root: &Path,
    destination: &Path,
) -> Result<PerformanceDiagnosticsSummary, ()> {
    let mut destination = File::create(destination).map_err(|_| ())?;
    let mut summary = PerformanceDiagnosticsSummary::default();

    for report_path in report_files(report_root).map_err(|_| ())? {
        summary.report_count += 1;
        let report = File::open(report_path).map_err(|_| ())?;
        for line in BufReader::new(report).lines() {
            let line = line.map_err(|_| ())?;
            if let Ok(event) = serde_json::from_str::<PerformanceEvent>(&line) {
                serde_json::to_writer(&mut destination, &event).map_err(|_| ())?;
                destination.write_all(b"\n").map_err(|_| ())?;
                summary.event_count += 1;
            }
        }
    }

    Ok(summary)
}

/// Clears only this application's `performance-*.jsonl` reports from the database-derived root.
pub fn clear_reports() -> Result<PerformanceDiagnosticsSummary, ()> {
    clear_reports_from(&production_report_root())
}

#[cfg(test)]
fn clear_reports_at(report_root: &Path) -> Result<PerformanceDiagnosticsSummary, ()> {
    clear_reports_from(report_root)
}

fn clear_reports_from(report_root: &Path) -> Result<PerformanceDiagnosticsSummary, ()> {
    let mut summary = summarize_reports_from(report_root).map_err(|_| ())?;
    for report_path in report_files(report_root).map_err(|_| ())? {
        fs::remove_file(report_path).map_err(|_| ())?;
    }
    summary.report_count = 0;
    summary.event_count = 0;
    Ok(summary)
}

pub fn summarize_reports() -> std::io::Result<PerformanceDiagnosticsSummary> {
    summarize_reports_from(&production_report_root())
}

#[cfg(test)]
fn summarize_reports_at(report_root: &Path) -> std::io::Result<PerformanceDiagnosticsSummary> {
    summarize_reports_from(report_root)
}

fn summarize_reports_from(report_root: &Path) -> std::io::Result<PerformanceDiagnosticsSummary> {
    let report_paths = report_files(report_root)?;
    let mut summary = PerformanceDiagnosticsSummary {
        report_count: report_paths.len(),
        event_count: 0,
    };

    for report_path in report_paths {
        let report = File::open(report_path)?;
        for line in BufReader::new(report).lines().map_while(Result::ok) {
            if serde_json::from_str::<PerformanceEvent>(&line).is_ok() {
                summary.event_count += 1;
            }
        }
    }

    Ok(summary)
}

fn production_report_root() -> PathBuf {
    db::get_db_path()
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()
}

fn diagnostics_dir(report_root: &Path) -> PathBuf {
    report_root.join(DIAGNOSTICS_DIRECTORY)
}

fn timestamp_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn report_filename() -> String {
    format!(
        "{REPORT_PREFIX}{:020}-{}.jsonl",
        timestamp_ms(),
        Uuid::new_v4()
    )
}

fn event_chunks(events: &[PerformanceEvent]) -> Vec<Vec<u8>> {
    let mut chunks = Vec::new();
    let mut chunk = Vec::new();

    for event in events {
        let Ok(mut line) = serde_json::to_vec(event) else {
            continue;
        };
        line.push(b'\n');
        if line.len() > MAX_REPORT_BYTES {
            continue;
        }
        if !chunk.is_empty() && chunk.len() + line.len() > MAX_REPORT_BYTES {
            chunks.push(std::mem::take(&mut chunk));
        }
        chunk.extend(line);
    }

    if !chunk.is_empty() {
        chunks.push(chunk);
    }
    chunks
}

fn write_report_chunk(diagnostics_dir: &Path, chunk: &[u8]) -> std::io::Result<()> {
    let mut report = OpenOptions::new()
        .create(true)
        .append(true)
        .open(diagnostics_dir.join(report_filename()))?;
    report.write_all(chunk)
}

fn rotate_reports(diagnostics_dir: &Path, retain: usize) {
    let Ok(mut files) = report_files_in_dir(diagnostics_dir) else {
        return;
    };
    files.sort();
    let remove_count = files.len().saturating_sub(retain);
    for report_path in files.into_iter().take(remove_count) {
        let _ = fs::remove_file(report_path);
    }
}

fn report_files(report_root: &Path) -> std::io::Result<Vec<PathBuf>> {
    report_files_in_dir(&diagnostics_dir(report_root))
}

fn report_files_in_dir(diagnostics_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    regular_files_in_dir(diagnostics_dir).map(|files| {
        files
            .into_iter()
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with(REPORT_PREFIX) && name.ends_with(".jsonl"))
            })
            .collect()
    })
}

fn regular_files_in_dir(diagnostics_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    if !diagnostics_dir.exists() {
        return Ok(Vec::new());
    }

    fs::read_dir(diagnostics_dir)?.try_fold(Vec::new(), |mut files, entry| {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            files.push(entry.path());
        }
        Ok(files)
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::{Path, PathBuf};
    use std::sync::{Arc, Barrier};
    use std::thread;
    use std::time::{SystemTime, UNIX_EPOCH};

    struct TempDir(PathBuf);

    impl TempDir {
        fn new() -> Self {
            let unique = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            let path = std::env::temp_dir().join(format!("asm-performance-test-{unique}"));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn disabled_recorder_creates_no_diagnostic_directory() {
        let temp = TempDir::new();
        OperationRecorder::disabled_at(temp.path())
            .finish(DiagnosticOutcome::Success)
            .unwrap();
        assert!(!temp.path().join(DIAGNOSTICS_DIRECTORY).exists());
    }

    #[test]
    fn serialized_event_never_contains_path_or_skill_name() {
        let event = PerformanceEvent::adapter_scan(r"C:\\Users\\A\\private-skill", 15, 2, 9);
        let serialized = serde_json::to_string(&event).unwrap();
        assert!(!serialized.contains(r"C:\\Users\\A"));
        assert!(!serialized.contains("private-skill"));
    }

    #[test]
    fn serialized_events_include_their_own_timestamp() {
        let event = PerformanceEvent::adapter_scan("adapter", 15, 2, 9);
        assert!(event.timestamp_ms > 0);
        assert!(serde_json::to_string(&event)
            .unwrap()
            .contains("timestampMs"));
    }

    #[test]
    fn persisted_phase_and_operation_events_include_timestamps() {
        let temp = TempDir::new();
        let mut recorder =
            OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None);
        {
            let _phase = recorder.start_phase(DiagnosticPhase::ReadSkill, None);
        }
        recorder.finish(DiagnosticOutcome::Success).unwrap();

        let events: Vec<PerformanceEvent> =
            std::fs::read_to_string(report_files(temp.path()).unwrap().remove(0))
                .unwrap()
                .lines()
                .map(|line| serde_json::from_str(line).unwrap())
                .collect();
        assert_eq!(events.len(), 2);
        assert!(events.iter().all(|event| event.timestamp_ms > 0));
        assert!(events
            .iter()
            .any(|event| event.event_type == PerformanceEventType::Phase));
        assert!(events
            .iter()
            .any(|event| event.event_type == PerformanceEventType::Operation));
    }

    #[test]
    fn rotation_retains_at_most_five_files() {
        let temp = TempDir::new();
        write_completed_operations(temp.path(), 6);
        assert!(report_files(temp.path()).unwrap().len() <= MAX_REPORT_FILES);
    }

    #[test]
    fn concurrent_completion_retains_at_most_five_files() {
        let temp = TempDir::new();
        let report_root = Arc::new(temp.path().to_path_buf());
        let barrier = Arc::new(Barrier::new(6));
        let workers: Vec<_> = (0..6)
            .map(|_| {
                let report_root = Arc::clone(&report_root);
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    barrier.wait();
                    OperationRecorder::enabled_at(
                        &report_root,
                        DiagnosticOperation::ScanAgents,
                        None,
                    )
                    .finish(DiagnosticOutcome::Success)
                    .unwrap();
                })
            })
            .collect();

        for worker in workers {
            worker.join().unwrap();
        }

        assert!(report_files(temp.path()).unwrap().len() <= MAX_REPORT_FILES);
    }

    #[test]
    fn persistence_error_does_not_change_operation_result() {
        let temp = TempDir::new();
        let blocked = temp.path().join("blocked");
        std::fs::write(&blocked, "not a directory").unwrap();
        let recorder =
            OperationRecorder::enabled_at(&blocked, DiagnosticOperation::ScanAgents, None);
        assert!(recorder.finish(DiagnosticOutcome::Success).is_ok());
    }

    #[test]
    fn invalid_context_operation_id_is_replaced_with_a_uuid() {
        let temp = TempDir::new();
        OperationRecorder::enabled_at(
            temp.path(),
            DiagnosticOperation::ScanAgents,
            Some(DiagnosticContext {
                operation_id: "not-a-uuid".into(),
                in_flight_same_operation: 3,
            }),
        )
        .finish(DiagnosticOutcome::Success)
        .unwrap();

        let report = std::fs::read_to_string(report_files(temp.path()).unwrap().remove(0)).unwrap();
        let event: PerformanceEvent = serde_json::from_str(report.lines().next().unwrap()).unwrap();
        assert!(Uuid::parse_str(&event.operation_id).is_ok());
    }

    #[test]
    fn phased_operation_never_persists_its_subject() {
        let temp = TempDir::new();
        let mut recorder =
            OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None);
        {
            let _phase = recorder.start_phase(
                DiagnosticPhase::ReadSkill,
                Some("private-skill/C:\\\\Users\\\\A"),
            );
        }
        recorder.finish(DiagnosticOutcome::Success).unwrap();

        let serialized =
            std::fs::read_to_string(report_files(temp.path()).unwrap().remove(0)).unwrap();
        assert!(!serialized.contains("private-skill"));
        assert!(!serialized.contains(r"C:\\Users\\A"));
    }

    #[test]
    fn large_completed_operation_never_creates_a_report_larger_than_two_mib() {
        let temp = TempDir::new();
        let mut recorder =
            OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None);
        for _ in 0..20_000 {
            recorder.record_counted_phase(
                DiagnosticPhase::ReadSkill,
                None,
                EventCounters::default(),
                Instant::now(),
                DiagnosticOutcome::Success,
            );
        }
        recorder.finish(DiagnosticOutcome::Success).unwrap();

        let reports = report_files(temp.path()).unwrap();
        assert!(reports.len() > 1);
        for report in reports {
            assert!(std::fs::metadata(report).unwrap().len() <= MAX_REPORT_BYTES as u64);
        }
    }

    #[test]
    fn export_skips_malformed_lines_and_clear_preserves_directories() {
        let temp = TempDir::new();
        OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None)
            .finish(DiagnosticOutcome::Success)
            .unwrap();
        let reports = report_files(temp.path()).unwrap();
        std::fs::write(&reports[0], "not json\n").unwrap();
        let nested_dir = temp
            .path()
            .join(DIAGNOSTICS_DIRECTORY)
            .join("keep-directory");
        std::fs::create_dir(&nested_dir).unwrap();
        let exported = temp.path().join("export.jsonl");

        let summary = export_reports_at(temp.path(), &exported).unwrap();
        assert_eq!(summary.event_count, 0);
        assert!(std::fs::read_to_string(&exported).unwrap().is_empty());

        clear_reports_at(temp.path()).unwrap();
        assert!(nested_dir.exists());
        assert!(report_files(temp.path()).unwrap().is_empty());
    }

    #[test]
    fn export_uses_only_performance_jsonl_reports() {
        let temp = TempDir::new();
        OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None)
            .finish(DiagnosticOutcome::Success)
            .unwrap();
        let non_report = temp
            .path()
            .join(DIAGNOSTICS_DIRECTORY)
            .join("unrelated.json");
        std::fs::write(
            non_report,
            format!(
                "{}\n",
                serde_json::to_string(&PerformanceEvent::adapter_scan("adapter", 1, 1, 0)).unwrap()
            ),
        )
        .unwrap();
        let exported = temp.path().join("export.jsonl");

        let summary = export_reports_at(temp.path(), &exported).unwrap();

        assert_eq!(summary.report_count, 1);
        assert_eq!(summary.event_count, 1);
    }

    #[test]
    fn export_rejects_events_with_unknown_fixed_values() {
        let temp = TempDir::new();
        OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None)
            .finish(DiagnosticOutcome::Success)
            .unwrap();
        let report = report_files(temp.path()).unwrap().remove(0);
        let contents = std::fs::read_to_string(&report).unwrap().replace(
            "\"operation\":\"scan_agents\"",
            "\"operation\":\"arbitrary_operation\"",
        );
        std::fs::write(report, contents).unwrap();
        let exported = temp.path().join("export.jsonl");

        assert_eq!(
            export_reports_at(temp.path(), &exported)
                .unwrap()
                .event_count,
            0
        );
    }

    #[test]
    fn clear_keeps_non_performance_files() {
        let temp = TempDir::new();
        let diagnostics_dir = temp.path().join(DIAGNOSTICS_DIRECTORY);
        std::fs::create_dir_all(&diagnostics_dir).unwrap();
        OperationRecorder::enabled_at(temp.path(), DiagnosticOperation::ScanAgents, None)
            .finish(DiagnosticOutcome::Success)
            .unwrap();
        let keep = diagnostics_dir.join("keep.txt");
        std::fs::write(&keep, "keep").unwrap();

        clear_reports_at(temp.path()).unwrap();

        assert!(keep.exists());
        assert!(report_files(temp.path()).unwrap().is_empty());
    }

    #[test]
    fn production_report_root_is_derived_from_the_database_parent() {
        let expected = db::get_db_path().parent().unwrap().to_path_buf();
        assert_eq!(production_report_root(), expected);
    }

    fn write_completed_operations(report_root: &Path, count: usize) {
        for _ in 0..count {
            OperationRecorder::enabled_at(report_root, DiagnosticOperation::ScanAgents, None)
                .finish(DiagnosticOutcome::Success)
                .unwrap();
        }
    }
}
