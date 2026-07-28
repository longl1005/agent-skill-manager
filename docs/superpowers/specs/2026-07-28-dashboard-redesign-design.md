# Dashboard Redesign Design Specification

## Overview
Redesign the Agent Skill Manager (ASM) Dashboard to remove manual "Scan Now" buttons and provide an automated, high-density analytics & management overview screen.

## Key Changes & Architecture

### 1. Automatic App Launch Scan
- Automatically invoke `scan()` and `fetchMasterSkills()` on application mount in `src/App.tsx`.
- Keep background auto-refresh seamless without blocking UI rendering.

### 2. Four Dashboard Modules

#### Module 1: Metric Overview Cards
- **Master Skills**: Count of skills stored in `~/.asm/skills`.
- **Detected Agents**: Count of active detected Agents (Claude Code, Codex, Antigravity, Pi Agent, Open Code, Cursor).
- **Symlink Coverage**: Percentage of total agent skill installations linked via `~/.asm/skills`.
- **Live Sync Status**: Green pulsing indicator with real-time "Auto-sync active · Last refreshed at HH:MM:SS".

#### Module 2: Agent Health & Skill Matrix
- Grid of Agent Cards showing:
  - Agent Icon & Display Name
  - Total Installed Skills Count
  - Master Symlink Ratio
  - Health Tag ("Healthy", "Issues Found")

#### Module 3: Quick Navigation Shortcuts
- Direct action buttons to "Open Skill Library", "Manage Agents", and "View Settings".

#### Module 4: Recent Activity & Audit Log
- Chronological timeline of recent skill imports, symlink toggles, and auto-healing events.

## Verification & Testing Plan
- Vitest unit tests for Dashboard rendering with populated and empty scan reports.
- Verify automatic background scanning on app launch.
