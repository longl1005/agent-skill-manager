export interface PingResponse {
  message: string;
}

export interface DiagnosticContext {
  operationId: string;
  inFlightSameOperation: number;
}

export interface PerformanceDiagnosticsSummary {
  enabled: boolean;
  report_count: number;
  newest_event_at_ms: number | null;
  report_directory_label: string;
}

// ===== scan_agents 响应 =====

export interface ScanReport {
  scan_id: string;
  started_at: number;
  completed_at: number;
  agents: AgentReport[];
  total_skills: number;
  total_issues: number;
}

export interface AgentReport {
  agent_id: string;
  display_name: string;
  detection_status: string;
  roots: RootReport[];
  skills: SkillReport[];
  issues: IssueReport[];
  outcome: string;
}

export interface RootReport {
  root_id: string;
  scope: string;
  display_path: string;
}

export interface SkillReport {
  name: string;
  description: string;
  license: string | null;
  location: string;
  modified_at?: number;
  fingerprint_short: string;
  file_count: number;
  is_symlink?: boolean;
  symlink_target?: string | null;
  issues: IssueReport[];
}

export interface IssueReport {
  code: string;
  severity: string; // "Info" | "Warning" | "Error"
  phase: string;
  path: string | null;
  message: string;
}

// ===== master_repo 响应 =====

export interface MasterSkillReport {
  name: string;
  description: string;
  path: string;
  modified_at?: number;
  linked_agents: Record<string, boolean>;
}

export type ImportMode =
  | { mode: "auto" }
  | { mode: "use_master" }
  | { mode: "overwrite_master" }
  | { mode: "rename_new"; new_name: string };

export type ImportResult =
  | { type: "success" }
  | {
      type: "conflict";
      skill_name: string;
      existing_fingerprint: string;
      incoming_fingerprint: string;
    };

// ===== sqlite db 响应 =====

export interface DbMasterSkill {
  id: number;
  name: string;
  description: string;
  author: string;
  repo_url: string;
  file_count: number;
  installed_at: string;
}

export interface DbActivityLog {
  id: number;
  action: string;
  target_skill: string;
  target_agent: string;
  created_at: string;
}

export interface DbSummaryReport {
  db_path: string;
  total_skills: number;
  total_symlinks: number;
  recent_activities: DbActivityLog[];
}
