# Remove Tray Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused system-tray refresh action and its unreachable frontend event bridge.

**Architecture:** The Tauri tray will expose only window reveal, master-library navigation, and quit actions. The React bridge will retain only navigation and language synchronization, eliminating the refresh event subscription and its scan/store side effects.

**Tech Stack:** Rust, Tauri 2, React, TypeScript, Vitest.

## Global Constraints

- Do not change the existing skill-library page refresh control.
- Preserve current show-window, open-library, quit, and tray-language behavior.
- Do not overwrite unrelated uncommitted workspace changes.

---

### Task 1: Remove the tray refresh action end-to-end

**Files:**
- Modify: `src-tauri/src/tray.rs`
- Modify: `src/hooks/useTrayEvents.ts`
- Modify: `src/hooks/useTrayEvents.test.tsx`

**Interfaces:**
- Consumes: `TrayAction`, `action_for_menu_id`, and Tauri's event listener API.
- Produces: a tray menu without a refresh action and a bridge that listens only for `tray:open-library`.

- [ ] **Step 1: Write the failing regression tests**

Remove refresh expectations from the Rust menu tests and frontend bridge tests. Keep the remaining action and navigation tests so a stale `TrayAction::Refresh`, `tray-refresh` route, or `tray:refresh` listener causes compilation or test failures.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm vitest run src/hooks/useTrayEvents.test.tsx` and `cargo test tray` from `src-tauri`.

Expected: at least one failure because production code still exposes the refresh action or listener.

- [ ] **Step 3: Write the minimal implementation**

Delete the refresh label, menu item, action enum variant, menu-ID mapping, event emission, managed menu reference, React store dependencies, and refresh listener. Keep all remaining menu item ordering and separator behavior unchanged.

- [ ] **Step 4: Run focused verification**

Run: `pnpm vitest run src/hooks/useTrayEvents.test.tsx` and `cargo test tray` from `src-tauri`.

Expected: both commands exit successfully.
