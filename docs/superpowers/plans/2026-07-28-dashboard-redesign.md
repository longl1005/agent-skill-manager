# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Dashboard into an automated, high-density Agent & Skill management overview, removing the manual "Scan Now" button and enabling automatic launch scanning.

**Architecture:** Update `App.tsx` to automatically trigger `scan()` and `fetchMasterSkills()` on mount. Redesign `Dashboard.tsx` to display Metric Cards, Agent Health Cards, Auto-Sync Status, and Recent Activity Log.

**Tech Stack:** React, Zustand (`useScanStore`, `useMasterRepoStore`, `useI18nStore`), CSS Variables.

## Global Constraints
- Remove the manual "Scan now" button.
- Retain all internationalization (`t(key, lang)`) support.
- Maintain 100% test coverage with Vitest.

---

### Task 1: Enable Automatic Launch Scan in App.tsx

**Files:**
- Modify: `src/App.tsx:14-25`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write test for automatic scan on mount in App.test.tsx**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";
import { useScanStore } from "./stores/scanStore";
import { useMasterRepoStore } from "./stores/masterRepoStore";

vi.mock("./stores/scanStore", () => ({
  useScanStore: vi.fn(),
}));

vi.mock("./stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

describe("App Launch Auto-Scan", () => {
  it("triggers scan and fetchMasterSkills on mount", () => {
    const scanMock = vi.fn();
    const fetchMasterSkillsMock = vi.fn();

    vi.mocked(useScanStore).mockReturnValue({ scan: scanMock } as any);
    vi.mocked(useMasterRepoStore).mockReturnValue({ fetchMasterSkills: fetchMasterSkillsMock } as any);

    render(<App />);

    expect(scanMock).toHaveBeenCalled();
    expect(fetchMasterSkillsMock).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/App.test.tsx`
Expected: FAIL ("scan is not a function" or missing calls).

- [ ] **Step 3: Implement auto-scan on mount in App.tsx**

```tsx
import { useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import AppSidebar from "./components/AppSidebar";
import Dashboard from "./routes/Dashboard";
import SkillLibrary from "./routes/SkillLibrary";
import AgentMatrix from "./routes/AgentMatrix";
import Agents from "./routes/Agents";
import AgentDetail from "./routes/AgentDetail";
import SkillDetail from "./routes/SkillDetail";
import ScanHistory from "./routes/ScanHistory";
import Settings from "./routes/Settings";
import { useThemeStore } from "./stores/themeStore";
import { useScanStore } from "./stores/scanStore";
import { useMasterRepoStore } from "./stores/masterRepoStore";

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme);
  const scan = useScanStore((s) => s.scan);
  const fetchMasterSkills = useMasterRepoStore((s) => s.fetchMasterSkills);

  useEffect(() => {
    initTheme();
    scan();
    fetchMasterSkills();
  }, [initTheme, scan, fetchMasterSkills]);

  return (
    <HashRouter>
      <div className="app-shell">
        <AppSidebar />
        <main className="content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<SkillLibrary />} />
            <Route path="/install" element={<SkillLibrary />} />
            <Route path="/matrix" element={<AgentMatrix />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:agentId" element={<AgentDetail />} />
            <Route path="/agents/:agentId/skills/:skillName" element={<SkillDetail />} />
            <Route path="/history" element={<ScanHistory />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test src/App.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat: trigger automatic scan and fetchMasterSkills on app launch"
```

---

### Task 2: Redesign Dashboard.tsx & Global CSS

**Files:**
- Modify: `src/routes/Dashboard.tsx`
- Modify: `src/styles/global.css`
- Modify: `src/routes/Dashboard.test.tsx`

- [ ] **Step 1: Write test for new Dashboard layout without Scan Now button in Dashboard.test.tsx**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard";
import { useScanStore } from "../stores/scanStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useI18nStore } from "../stores/i18nStore";

vi.mock("../stores/scanStore", () => ({
  useScanStore: vi.fn(),
}));

vi.mock("../stores/masterRepoStore", () => ({
  useMasterRepoStore: vi.fn(),
}));

const mockReport = {
  scan_id: "test-scan",
  started_at: Date.now() - 1000,
  completed_at: Date.now(),
  total_skills: 12,
  total_issues: 0,
  agents: [
    {
      agent_id: "claude-code",
      display_name: "Claude Code",
      detection_status: "Detected",
      outcome: "Completed",
      roots: [],
      skills: [{ name: "free-search", location: "/path", file_count: 5, fingerprint_short: "abc" }],
      issues: [],
    },
  ],
};

describe("Dashboard Route Redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useI18nStore.setState({ lang: "en" });

    vi.mocked(useScanStore).mockReturnValue({
      report: mockReport,
      scanning: false,
      error: null,
      scan: vi.fn(),
    } as any);

    vi.mocked(useMasterRepoStore).mockReturnValue({
      skills: [{ name: "free-search", description: "Search", path: "/asm", linked_agents: { "claude-code": true } }],
      loading: false,
      fetchMasterSkills: vi.fn(),
    } as any);
  });

  it("renders metric cards and auto-sync status without manual Scan now button", () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scan now/i })).not.toBeInTheDocument();
    expect(screen.getByText("Auto-Sync Active")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test src/routes/Dashboard.test.tsx`
Expected: FAIL (because "Scan now" button is currently rendered).

- [ ] **Step 3: Implement Redesigned Dashboard.tsx and update global.css**

Update `src/routes/Dashboard.tsx` to render:
1. Metric Cards (Master Skills, Detected Agents, Symlink Coverage, Auto-Sync Status)
2. Agent Health Grid (cards for each agent with skill count and status badge)
3. Action Shortcuts (Skill Library link, Agent management link)
4. Remove "Scan now" button.

Add corresponding CSS rules in `src/styles/global.css` for `.dashboard-metrics-grid`, `.dashboard-metric-card`, `.dashboard-agent-grid`, `.sync-live-dot`.

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm test src/routes/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add src/routes/Dashboard.tsx src/routes/Dashboard.test.tsx src/styles/global.css
git commit -m "feat: redesign Dashboard with metric cards, agent health grid, and auto-sync status"
```
