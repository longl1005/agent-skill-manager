# Agent Skill Manager

Agent Skill Manager (ASM) is a Tauri desktop application for discovering AI-agent Skills on your machine, collecting them in a local master library, and linking the same Skill to the Agents you choose.

> **中文简介：** Agent Skill Manager（ASM）是一款桌面应用，用于扫描本机 AI Agent 的 Skills，将它们统一管理在本地主技能库中，并通过软链接分发给选定的 Agent。

## Features

- Scan configured Skill directories for supported Agents and inspect discovered Skills, metadata, file counts, fingerprints, and symlink targets.
- Compare discovered Skills in an Agent Matrix, including missing, present, conflict, and unknown states.
- Maintain a local master Skill library, normally at `~/.asm/skills`, with search, sorting, per-Agent link status, and custom paths.
- Import a local Agent Skill into the master library, resolve import conflicts, and redirect that Agent to the master copy.
- Install a Skill into the master library from a local directory, ZIP archive, or Git repository source; distribute it to selected Agents with symlinks.
- Export a master Skill as a ZIP archive, open its local directory, and remove the master Skill together with only ASM-managed links that point to it.
- Review scan history and configure language, appearance, Agent visibility/order, and custom Skill paths.

## Quick start

### Prerequisites

- Rust 1.77 or newer
- Node.js 20 or newer
- pnpm 9 or newer
- A supported desktop environment for Tauri 2. Linux users also need the [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/).

Install dependencies and start the desktop app:

```bash
pnpm install
pnpm tauri:dev
```

The development command starts the Vite frontend and the Tauri desktop window.

## Workflow

1. Start ASM. It scans the supported Agent Skill locations, plus any custom paths you configure.
2. Review discovered Skills by Agent or in the Agent Matrix.
3. Import an existing Agent Skill into the master library, or install a new one from a local folder, ZIP archive, or Git source.
4. In the master library, link a Skill to one or more detected Agents. ASM creates symlinks in their Skill directories.
5. Use the library to inspect, export, unlink, or remove Skills, then rescan when local Skill directories change.

## Supported Agents

ASM currently registers adapters for these Agents: Claude Code, Cline, CodeBuddy, GitHub Copilot, Droid, Qoder, Qwen Code, Hermes Agent, OpenClaw, WorkBuddy, Kimi Code CLI, Augment, Roo Code, Windsurf, Codex, Antigravity, Pi Agent, Oh My Pi (OPM), Grok, Kiro CLI, TRAE, TRAE CN, Open Code, and Cursor.

Detection is based on each Agent's local Skill directory. An Agent without an available configured directory remains unavailable until its path exists or you set a custom path.

## Safety and privacy

ASM manages Skills on the local filesystem. The default master library is `~/.asm/skills`; you can configure a different master or Agent Skill path in Settings.

- Importing an external Skill symlink copies its target into `~/.asm/skills` and redirects only the current Agent symlink. The external target remains unchanged.
- Deleting a master Skill removes the master copy and only ASM-managed links that target that master copy. It does not remove unrelated Agent Skills or external symlink targets.
- Removing an Agent Skill symlink removes the link itself; its target is never followed or deleted.
- Installing from a Git source clones the repository locally to prepare the master-library copy. The app does not provide cloud synchronization or analytics.

Review the selected source and destination paths before importing, installing, linking, or deleting a Skill.

## Development commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Vite frontend development server. |
| `pnpm tauri:dev` | Start the full Tauri desktop app in development mode. |
| `pnpm test` | Run the frontend test suite with Vitest. |
| `pnpm build` | Type-check the frontend and create a production frontend bundle. |
| `pnpm tauri:build` | Build a production Tauri bundle for the current platform. |
| `cargo test --lib --manifest-path src-tauri/Cargo.toml` | Run the Rust library tests. |

## Architecture

- `src/` contains the React and TypeScript interface, application state, routes, and Tauri IPC client.
- `src-tauri/src/` contains the Rust Tauri commands, Agent adapters, filesystem scanner, master-library operations, inventory projection, and SQLite-backed local activity data.
- `src-tauri/tauri.conf.json` configures the Tauri 2 application, desktop window, development server, and bundles.

## Contributing

Contributions are welcome. Please open an issue or pull request with a focused change, keep the documentation aligned with implemented behavior, and run the relevant checks before submitting:

```bash
pnpm test
pnpm build
cargo test --lib --manifest-path src-tauri/Cargo.toml
```

## License

This project is licensed under the [MIT License](LICENSE).
