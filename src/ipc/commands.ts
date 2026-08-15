import { invoke } from "@tauri-apps/api/core";
import type { DiagnosticContext, ImportMode, ImportResult, MasterSkillReport, PerformanceDiagnosticsSummary, PingResponse, ScanReport } from "./types";

/**
 * 与 Rust 端 `commands::ping` 对应。
 * 类型化封装，避免在组件里直接调用字符串 invoke。
 */
export async function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}

/** Open documentation in the operating system's default browser. */
export async function openExternalUrl(url: string): Promise<void> {
  return invoke<void>("open_external_url", { url });
}

/** Open a local skill directory in Finder, Explorer, or the platform file manager. */
export async function openSkillDirectory(location: string): Promise<void> {
  return invoke<void>("open_skill_directory", { location });
}

/**
 * 与 Rust 端 `commands::scan_agents` 对应。
 * 同步阻塞: 76 个 Skill ~50ms。
 */
export async function scanAgents(
  customPaths?: Record<string, string>,
  diagnosticContext?: DiagnosticContext,
): Promise<ScanReport> {
  return invoke<ScanReport>("scan_agents", {
    customPaths: customPaths ?? null,
    diagnosticContext: diagnosticContext ?? null,
  });
}

/**
 * 与 Rust 端 `commands::read_skill_content` 对应。
 * 读取指定 Skill 目录下的 SKILL.md 文件文本。
 */
export async function readSkillContent(location: string): Promise<string> {
  return invoke<string>("read_skill_content", { location });
}

/** Synchronize the native tray menu with the selected application language. */
export async function setTrayLanguage(language: "zh" | "en"): Promise<void> {
  return invoke<void>("set_tray_language", { language });
}

/** Synchronize native tray summary counts with the current application data. */
export async function setTrayStatistics(language: "zh" | "en", masterSkills: number, connectedAgents: number): Promise<void> {
  return invoke<void>("set_tray_statistics", { language, masterSkills, connectedAgents });
}

/** Set system tray icon visibility. */
export async function setTrayVisible(visible: boolean): Promise<void> {
  return invoke<void>("set_tray_visible", { visible });
}

/** Hide the main window to background or tray. */
export async function hideMainWindow(): Promise<void> {
  return invoke<void>("hide_main_window");
}

/** Exit the application. */
export async function exitApp(): Promise<void> {
  return invoke<void>("exit_app");
}

/**
 * 与 Rust 端 `commands::get_master_skills` 对应。
 * 获取主仓库 (`~/.asm/skills`) 中所有的 Master Skill 及与各 Agent 的关联 link 状态。
 */
export async function getMasterSkills(
  customPaths?: Record<string, string>,
  diagnosticContext?: DiagnosticContext,
): Promise<MasterSkillReport[]> {
  return invoke<MasterSkillReport[]>("get_master_skills", {
    customPaths: customPaths ?? null,
    diagnosticContext: diagnosticContext ?? null,
  });
}

export async function getPerformanceDiagnosticsEnabled(): Promise<boolean> {
  return invoke<boolean>("get_performance_diagnostics_enabled");
}

export async function setPerformanceDiagnosticsEnabled(enabled: boolean): Promise<void> {
  return invoke<void>("set_performance_diagnostics_enabled", { enabled });
}

export async function getPerformanceDiagnosticsSummary(): Promise<PerformanceDiagnosticsSummary> {
  return invoke<PerformanceDiagnosticsSummary>("get_performance_diagnostics_summary");
}

export async function exportPerformanceDiagnostics(destination: string): Promise<void> {
  return invoke<void>("export_performance_diagnostics", { destination });
}

export async function clearPerformanceDiagnostics(): Promise<void> {
  return invoke<void>("clear_performance_diagnostics");
}

/**
 * 与 Rust 端 `commands::toggle_agent_skill` 对应。
 * 开启或关闭 Master Skill 到指定 Agent 技能根目录的 symlink 关联。
 */
export async function toggleAgentSkill(
  agentId: string,
  skillName: string,
  enable: boolean,
  customPaths?: Record<string, string>
): Promise<boolean> {
  return invoke<boolean>("toggle_agent_skill", { agentId, skillName, enable, customPaths: customPaths ?? null });
}

/**
 * Atomically handles the same skill across multiple Agents. This avoids one
 * frontend-to-Rust round trip (and one UI refresh) per Agent.
 */
export async function toggleAgentSkillsBatch(
  agentIds: string[],
  skillName: string,
  enable: boolean,
  customPaths?: Record<string, string>,
): Promise<number> {
  return invoke<number>("toggle_agent_skills_batch", {
    agentIds,
    skillName,
    enable,
    customPaths: customPaths ?? null,
  });
}

export async function replaceAgentLocalSkillWithSymlink(
  agentId: string,
  skillName: string,
  customPaths?: Record<string, string>,
): Promise<boolean> {
  return invoke<boolean>("replace_agent_local_skill_with_symlink", { agentId, skillName, customPaths: customPaths ?? null });
}

/** Delete one skill entry from the current Agent only. Symlink targets are never deleted. */
export async function deleteAgentSkill(
  agentId: string,
  skillName: string,
  customPaths?: Record<string, string>,
): Promise<boolean> {
  return invoke<boolean>("delete_agent_skill", { agentId, skillName, customPaths: customPaths ?? null });
}

export async function unlinkAllAgentSkills(agentId: string, customPaths?: Record<string, string>): Promise<number> {
  return invoke<number>("unlink_all_agent_skills", { agentId, customPaths: customPaths ?? null });
}
export async function migrateAgentSkillsDir(agentId: string, oldCustomPath: string | null, newPath: string, customPaths?: Record<string, string>): Promise<number> { return invoke<number>("migrate_agent_skills_dir", { agentId, oldCustomPath, newPath, customPaths: customPaths ?? null }); }
export async function resetAgentSkillsDir(agentId: string, oldCustomPath: string | null, customPaths?: Record<string, string>): Promise<number> { return invoke<number>("reset_agent_skills_dir", { agentId, oldCustomPath, customPaths: customPaths ?? null }); }
export interface AgentConfigRecord { agent_id: string; custom_path: string | null; disabled: boolean; sort_order: number | null }
export async function getAgentConfigs(): Promise<AgentConfigRecord[]> { return invoke<AgentConfigRecord[]>("get_agent_configs"); }
export async function setAgentConfig(agentId: string, customPath: string | null, disabled: boolean): Promise<void> { return invoke<void>("set_agent_config", { agentId, customPath, disabled }); }
export async function setAgentSortOrder(agentIds: string[]): Promise<void> { return invoke<void>("set_agent_sort_order", { agentIds }); }

/**
 * 与 Rust 端 `commands::import_to_master` 对应。
 * 将指定 Agent 的技能导入并提升为 Master Skill，建立 symlink 替换原目录。
 */
export async function importToMaster(
  agentId: string,
  skillName: string,
  mode?: ImportMode,
  customPaths?: Record<string, string>,
  sourceLocation?: string,
): Promise<ImportResult> {
  return invoke<ImportResult>("import_to_master", {
    agentId,
    skillName,
    mode: mode ?? null,
    customPaths: customPaths ?? null,
    sourceLocation: sourceLocation ?? null,
  });
}

export async function installSkillToMaster(
  skillName: string,
  source?: string,
  sourceSubdir?: string,
  customPaths?: Record<string, string>
): Promise<string> {
  return invoke<string>("install_skill_to_master", {
    skillName,
    source: source ?? null,
    sourceSubdir: sourceSubdir ?? null,
    customPaths: customPaths ?? null,
  });
}

export type GitSkillCandidate = {
  name: string;
  description: string;
  relative_path: string;
};

export async function inspectGitSkills(source: string): Promise<GitSkillCandidate[]> {
  return invoke<GitSkillCandidate[]>("inspect_git_skills", { source });
}

export async function exportMasterSkillZip(skillName: string, destination: string, customPaths?: Record<string, string>): Promise<string> {
  return invoke<string>("export_master_skill_zip", { skillName, destination, customPaths: customPaths ?? null });
}

/**
 * 与 Rust 端 `commands::delete_master_skill` 对应。
 * 删除主仓库中指定技能目录，并自动移除所有 Agent 的 symlink 引用。
 * 返回被移除 symlink 的 Agent ID 列表。
 */
export async function deleteMasterSkill(
  skillName: string,
  customPaths?: Record<string, string>
): Promise<string[]> {
  return invoke<string[]>("delete_master_skill", {
    skillName,
    customPaths: customPaths ?? null,
  });
}

/**
 * 与 Rust 端 `commands::get_db_summary` 对应。
 * 获取 SQLite 数据库总体统计与最近落库记录。
 */
export async function getDbSummary(): Promise<import("./types").DbSummaryReport> {
  return invoke<import("./types").DbSummaryReport>("get_db_summary");
}

/**
 * 与 Rust 端 `commands::get_activity_logs` 对应。
 * 获取 SQLite 数据库中的历史操作日志。
 */
export async function getActivityLogs(limit?: number): Promise<import("./types").DbActivityLog[]> {
  return invoke<import("./types").DbActivityLog[]>("get_activity_logs", { limit: limit ?? 20 });
}

/**
 * 与 Rust 端 `commands::get_network_proxy` 对应。
 * 获取当前保存的网络代理配置（如 "http://127.0.0.1:7890"），未配置时返回 null。
 */
export async function getNetworkProxy(): Promise<string | null> {
  return invoke<string | null>("get_network_proxy");
}

/**
 * 与 Rust 端 `commands::set_network_proxy` 对应。
 * 设置或清除网络代理配置。传入 null 或空字符串将清除代理。
 */
export async function setNetworkProxy(proxy: string | null): Promise<void> {
  return invoke<void>("set_network_proxy", { proxy: proxy && proxy.trim() ? proxy.trim() : null });
}

