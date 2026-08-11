//! Local, opt-in performance diagnostics.
//!
//! Reports contain only fixed operation names, phase names, durations, outcomes, and counters.
//! Callers may provide a subject while timing a phase, but it is deliberately never persisted.

use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const DIAGNOSTICS_DIRECTORY: &str = "diagnostics";
const MAX_REPORT_FILES: usize = 5;
static REPORT_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticContext {
    pub operation_id: String,
    pub in_flight_same_operation: u32,
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
    pub event_type: String,
    pub operation_id: String,
    pub operation: String,
    pub phase: Option<String>,
    pub duration_ms: u128,
    pub outcome: String,
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
            event_type: "adapter_scan".into(),
            operation_id: String::new(),
            operation: "adapter_scan".into(),
            phase: Some("adapter_scan".into()),
            duration_ms,
            outcome: "success".into(),
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
        operation: &'static str,
        phase: &'static str,
        duration_ms: u128,
        in_flight_same_operation: u32,
        counters: EventCounters,
        outcome: &'static str,
    ) -> Self {
        Self {
            event_type: "phase".into(),
            operation_id,
            operation: operation.into(),
            phase: Some(phase.into()),
            duration_ms,
            outcome: outcome.into(),
            in_flight_same_operation,
            counters,
        }
    }

    fn operation(
        operation_id: String,
        operation: &'static str,
        duration_ms: u128,
        in_flight_same_operation: u32,
        outcome: &'static str,
    ) -> Self {
        Self {
            event_type: "operation".into(),
            operation_id,
            operation: operation.into(),
            phase: None,
            duration_ms,
            outcome: outcome.into(),
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
    operation: &'static str,
    started_at: Instant,
    events: Vec<PerformanceEvent>,
    report_dir: PathBuf,
    in_flight_same_operation: u32,
}

impl OperationRecorder {
    pub fn disabled(report_dir: &Path) -> Self {
        Self {
            enabled: false,
            operation_id: Uuid::new_v4().to_string(),
            operation: "disabled",
            started_at: Instant::now(),
            events: Vec::new(),
            report_dir: report_dir.to_path_buf(),
            in_flight_same_operation: 0,
        }
    }

    pub fn enabled(
        report_dir: &Path,
        operation: &'static str,
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
            enabled: true,
            operation_id,
            operation,
            started_at: Instant::now(),
            events: Vec::new(),
            report_dir: report_dir.to_path_buf(),
            in_flight_same_operation,
        }
    }

    pub fn start_phase(&mut self, phase: &'static str, _subject: Option<&str>) -> PhaseGuard<'_> {
        PhaseGuard {
            recorder: self,
            phase,
            started_at: Instant::now(),
            outcome: "success",
        }
    }

    pub fn record_counted_phase(
        &mut self,
        phase: &'static str,
        _subject: Option<&str>,
        counters: EventCounters,
        started_at: Instant,
        outcome: &'static str,
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
    pub fn finish(mut self, outcome: &'static str) -> Result<(), ()> {
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

        let diagnostics_dir = diagnostics_dir(&self.report_dir);
        if fs::create_dir_all(&diagnostics_dir).is_err() {
            return Ok(());
        }

        let _write_lock = REPORT_WRITE_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());

        rotate_reports(&diagnostics_dir, MAX_REPORT_FILES.saturating_sub(1));

        let report_path = diagnostics_dir.join(report_filename());
        let mut report = match OpenOptions::new()
            .create(true)
            .append(true)
            .open(report_path)
        {
            Ok(report) => report,
            Err(_) => return Ok(()),
        };

        let mut batch = Vec::new();
        for event in &self.events {
            if serde_json::to_writer(&mut batch, event).is_err() || batch.write_all(b"\n").is_err()
            {
                return Ok(());
            }
        }

        let _ = report.write_all(&batch);
        Ok(())
    }
}

pub struct PhaseGuard<'a> {
    recorder: &'a mut OperationRecorder,
    phase: &'static str,
    started_at: Instant,
    outcome: &'static str,
}

impl PhaseGuard<'_> {
    pub fn finish(mut self, outcome: &'static str) {
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

/// Exports validated JSONL event lines and returns their aggregate counts.
pub fn export_reports(
    report_dir: &Path,
    destination: &Path,
) -> Result<PerformanceDiagnosticsSummary, ()> {
    let mut destination = File::create(destination).map_err(|_| ())?;
    let mut summary = PerformanceDiagnosticsSummary::default();

    for report_path in report_files(report_dir).map_err(|_| ())? {
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

/// Removes only regular files from this application's diagnostics directory.
/// Callers must pass the directory derived from `db::get_db_path().parent()`.
pub fn clear_reports(report_dir: &Path) -> Result<PerformanceDiagnosticsSummary, ()> {
    let db_path = crate::modules::db::get_db_path();
    let expected_report_dir = db_path.parent().ok_or(())?;
    if report_dir != expected_report_dir {
        return Err(());
    }

    clear_reports_in_dir(report_dir)
}

fn clear_reports_in_dir(report_dir: &Path) -> Result<PerformanceDiagnosticsSummary, ()> {
    let mut summary = summarize_reports(report_dir).map_err(|_| ())?;
    for report_path in regular_files(report_dir).map_err(|_| ())? {
        fs::remove_file(report_path).map_err(|_| ())?;
    }
    summary.report_count = 0;
    summary.event_count = 0;
    Ok(summary)
}

pub fn summarize_reports(report_dir: &Path) -> std::io::Result<PerformanceDiagnosticsSummary> {
    let report_paths = report_files(report_dir)?;
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

fn diagnostics_dir(report_dir: &Path) -> PathBuf {
    report_dir.join(DIAGNOSTICS_DIRECTORY)
}

fn report_filename() -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("report-{timestamp:020}-{}.jsonl", Uuid::new_v4())
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

fn report_files(report_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    report_files_in_dir(&diagnostics_dir(report_dir))
}

fn report_files_in_dir(diagnostics_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    regular_files_in_dir(diagnostics_dir).map(|files| {
        files
            .into_iter()
            .filter(|path| {
                path.extension()
                    .is_some_and(|extension| extension == "jsonl")
            })
            .collect()
    })
}

fn regular_files(report_dir: &Path) -> std::io::Result<Vec<PathBuf>> {
    regular_files_in_dir(&diagnostics_dir(report_dir))
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
        let recorder = OperationRecorder::disabled(temp.path());
        recorder.finish("success").unwrap();
        assert!(!temp.path().join("diagnostics").exists());
    }

    #[test]
    fn serialized_event_never_contains_path_or_skill_name() {
        let event = PerformanceEvent::adapter_scan(r"C:\\Users\\A\\private-skill", 15, 2, 9);
        let serialized = serde_json::to_string(&event).unwrap();
        assert!(!serialized.contains(r"C:\\Users\\A"));
        assert!(!serialized.contains("private-skill"));
    }

    #[test]
    fn rotation_retains_at_most_five_files() {
        let temp = TempDir::new();
        write_completed_operations(temp.path(), 6);
        assert!(report_files(temp.path()).unwrap().len() <= 5);
    }

    #[test]
    fn concurrent_completion_retains_at_most_five_files() {
        let temp = TempDir::new();
        let report_dir = Arc::new(temp.path().to_path_buf());
        let barrier = Arc::new(Barrier::new(6));
        let workers: Vec<_> = (0..6)
            .map(|_| {
                let report_dir = Arc::clone(&report_dir);
                let barrier = Arc::clone(&barrier);
                thread::spawn(move || {
                    barrier.wait();
                    OperationRecorder::enabled(&report_dir, "scan_agents", None)
                        .finish("success")
                        .unwrap();
                })
            })
            .collect();

        for worker in workers {
            worker.join().unwrap();
        }

        assert!(report_files(temp.path()).unwrap().len() <= 5);
    }

    #[test]
    fn persistence_error_does_not_change_operation_result() {
        let temp = TempDir::new();
        let blocked = temp.path().join("blocked");
        std::fs::write(&blocked, "not a directory").unwrap();
        let recorder = OperationRecorder::enabled(&blocked, "scan_agents", None);
        assert!(recorder.finish("success").is_ok());
    }

    #[test]
    fn invalid_context_operation_id_is_replaced_with_a_uuid() {
        let temp = TempDir::new();
        let recorder = OperationRecorder::enabled(
            temp.path(),
            "scan_agents",
            Some(DiagnosticContext {
                operation_id: "not-a-uuid".into(),
                in_flight_same_operation: 3,
            }),
        );
        recorder.finish("success").unwrap();

        let report = std::fs::read_to_string(report_files(temp.path()).unwrap().remove(0)).unwrap();
        let event: PerformanceEvent = serde_json::from_str(report.lines().next().unwrap()).unwrap();
        assert!(Uuid::parse_str(&event.operation_id).is_ok());
    }

    #[test]
    fn phased_operation_never_persists_its_subject() {
        let temp = TempDir::new();
        let mut recorder = OperationRecorder::enabled(temp.path(), "scan_agents", None);
        {
            let _phase = recorder.start_phase("read_skill", Some("private-skill/C:\\\\Users\\\\A"));
        }
        recorder.finish("success").unwrap();

        let serialized =
            std::fs::read_to_string(report_files(temp.path()).unwrap().remove(0)).unwrap();
        assert!(!serialized.contains("private-skill"));
        assert!(!serialized.contains(r"C:\\Users\\A"));
    }

    #[test]
    fn export_skips_malformed_lines_and_clear_preserves_directories() {
        let temp = TempDir::new();
        OperationRecorder::enabled(temp.path(), "scan_agents", None)
            .finish("success")
            .unwrap();
        let reports = report_files(temp.path()).unwrap();
        std::fs::write(&reports[0], "not json\n").unwrap();
        let nested_dir = temp.path().join("diagnostics").join("keep-directory");
        std::fs::create_dir(&nested_dir).unwrap();
        let exported = temp.path().join("export.jsonl");

        let summary = export_reports(temp.path(), &exported).unwrap();
        assert_eq!(summary.event_count, 0);
        assert!(std::fs::read_to_string(&exported).unwrap().is_empty());

        clear_reports_in_dir(temp.path()).unwrap();
        assert!(nested_dir.exists());
        assert!(report_files(temp.path()).unwrap().is_empty());
    }

    #[test]
    fn export_uses_only_jsonl_reports() {
        let temp = TempDir::new();
        OperationRecorder::enabled(temp.path(), "scan_agents", None)
            .finish("success")
            .unwrap();
        let non_report = temp.path().join("diagnostics").join("unrelated.json");
        std::fs::write(
            non_report,
            format!(
                "{}\n",
                serde_json::to_string(&PerformanceEvent::adapter_scan("adapter", 1, 1, 0)).unwrap()
            ),
        )
        .unwrap();
        let exported = temp.path().join("export.jsonl");

        let summary = export_reports(temp.path(), &exported).unwrap();

        assert_eq!(summary.report_count, 1);
        assert_eq!(summary.event_count, 1);
    }

    #[test]
    fn clear_reports_rejects_a_directory_other_than_the_db_parent() {
        let temp = TempDir::new();
        assert!(clear_reports(temp.path()).is_err());
    }

    fn write_completed_operations(report_dir: &Path, count: usize) {
        for _ in 0..count {
            OperationRecorder::enabled(report_dir, "scan_agents", None)
                .finish("success")
                .unwrap();
        }
    }
}
