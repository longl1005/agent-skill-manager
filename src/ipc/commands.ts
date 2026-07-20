import { invoke } from "@tauri-apps/api/core";
import type { PingResponse, ScanReport } from "./types";

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
export async function scanAgents(): Promise<ScanReport> {
  return invoke<ScanReport>("scan_agents");
}