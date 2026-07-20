//! Tauri 命令薄壳。命令体内只做参数转发和结果映射，业务逻辑全部下沉到 `modules/`。

use serde::Serialize;

#[derive(Serialize)]
pub struct PingResponse {
    pub message: &'static str,
}

/// 健康检查命令，验证 IPC 通畅。
#[tauri::command]
pub fn ping() -> PingResponse {
    PingResponse { message: "pong" }
}
