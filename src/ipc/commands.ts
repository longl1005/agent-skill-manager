import { invoke } from "@tauri-apps/api/core";
import type { MasterSkillReport, PingResponse, ScanReport } from "./types";

/**
 * 与 Rust 端 `commands::ping` 对应。
 * 类型化封装，避免在组件里直接调用字符串 invoke。
 */
export async function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}

/**
 * 与 Rust 端 `commands::scan_agents` 对应。
 * 同步阻塞: 76 个 Skill ~50ms。
 */
export async function scanAgents(customPaths?: Record<string, string>): Promise<ScanReport> {
  return invoke<ScanReport>("scan_agents", { customPaths: customPaths ?? null });
}

/**
 * 与 Rust 端 `commands::read_skill_content` 对应。
 * 读取指定 Skill 目录下的 SKILL.md 文件文本。
 */
export async function readSkillContent(location: string): Promise<string> {
  return invoke<string>("read_skill_content", { location });
}

/**
 * 与 Rust 端 `commands::get_master_skills` 对应。
 * 获取主仓库 (`~/.asm/skills`) 中所有的 Master Skill 及与各 Agent 的关联 link 状态。
 */
export async function getMasterSkills(customPaths?: Record<string, string>): Promise<MasterSkillReport[]> {
  return invoke<MasterSkillReport[]>("get_master_skills", { customPaths: customPaths ?? null });
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
 * 与 Rust 端 `commands::import_to_master` 对应。
 * 将指定 Agent 的技能导入并提升为 Master Skill，建立 symlink 替换原目录。
 */
export async function importToMaster(
  agentId: string,
  skillName: string,
  customPaths?: Record<string, string>
): Promise<boolean> {
  return invoke<boolean>("import_to_master", { agentId, skillName, customPaths: customPaths ?? null });
}