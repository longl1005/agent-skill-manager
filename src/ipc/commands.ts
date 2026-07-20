import { invoke } from "@tauri-apps/api/core";
import type { PingResponse } from "./types";

/**
 * 与 Rust 端 `commands::ping` 对应。
 * 类型化封装，避免在组件里直接调用字符串 invoke。
 */
export async function ping(): Promise<PingResponse> {
  return invoke<PingResponse>("ping");
}
