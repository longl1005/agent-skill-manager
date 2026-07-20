# Agent Skill Manager (ASM)

> Cross-platform desktop app to inventory AI Agent Skills.

## Status

Planning & architecture phase. This repository currently contains:
- Design specifications under `docs/`
- A runnable scaffold (Tauri 2 + React + Rust) with a smoke-checked IPC pipeline

No adapter, scanner, or inventory logic is implemented yet. See the MVP roadmap in [`docs/PRD.md`](docs/PRD.md).

## Prerequisites

| Tool | Version |
| --- | --- |
| Rust | ≥ 1.77 |
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| OS | macOS 13+, Windows 10+, or a current Linux desktop |

On Linux you also need the Tauri system dependencies listed at https://v2.tauri.app/start/prerequisites/.

## Quick start

```bash
pnpm install
pnpm tauri:dev
```

The first run downloads Rust dependencies and may take several minutes. When the window opens you should see the ASM shell with six navigation items; opening DevTools shows a `pong` log confirming the IPC pipeline.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server only (browser preview at http://localhost:1421) |
| `pnpm tauri:dev` | Full desktop app in dev mode |
| `pnpm tauri:build` | Production bundle for the current platform |
| `pnpm build` | Type-check + production frontend bundle |
| `cargo fmt --check` | Verify Rust formatting |
| `cargo clippy -- -D warnings` | Lint Rust sources |

## Layout

```
src/              React + TypeScript frontend
src-tauri/        Rust core (Tauri 2)
docs/             PRD, architecture, domain, adapter, scanner, UI specs
docs/superpowers/ Design specs and plans produced through brainstorming
```

## Documentation

- [PRD](docs/PRD.md)
- [Project overview](docs/PROJECT_OVERVIEW.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Domain Model](docs/DOMAIN_MODEL.md)
- [Adapter Spec](docs/ADAPTER_SPEC.md)
- [Scanner Spec](docs/SCANNER_SPEC.md)
- [UI Spec](docs/UI_SPEC.md)

## Contributing

Issues and PRs welcome. See `docs/PRD.md` §5 for the user problems the MVP targets.
