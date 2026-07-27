export interface PingResponse {
  message: string;
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
  fingerprint_short: string;
  file_count: number;
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
  linked_agents: Record<string, boolean>;
}