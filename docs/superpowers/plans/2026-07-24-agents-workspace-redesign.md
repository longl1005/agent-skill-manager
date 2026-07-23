# Agents Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Agents console with a screenshot-inspired dark Agent directory and a non-duplicated persistent navigation hierarchy.

**Architecture:** Add a shared `AppSidebar` that reads scan state and renders the three static product destinations plus the discovered-Agent group. Keep `/agents` as the all-Agents directory and `/agents/:agentId` as a detail-only route; both use the same sidebar, whose selected state derives from the current route. Split presentational Agent cards and status helpers out of routes so the list and detail views use the same status, icon, and count conventions.

**Tech Stack:** React 18, TypeScript, React Router 6, Zustand, Vite 5, Vitest, React Testing Library, plain CSS.

## Global Constraints

- Keep the existing Tauri IPC command and `ScanReport` schema unchanged.
- Primary navigation contains only Dashboard, Skill Library, and Install Skills.
- The discovered-Agent group contains All Agents plus detected-Agent child routes; no duplicate top-level Agents navigation item.
- Use SVG for structural icons; status must include text as well as color.
- Use dark semantic CSS tokens, visible focus states, 44px minimum interactive targets, and reduced-motion support.
- Do not add Preset UI, scan-history controls, or additional Agent-management actions.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `package.json` | Add test scripts and UI-test development dependencies. |
| `vite.config.ts` | Enable the Vitest `jsdom` test environment. |
| `src/test/setup.ts` | Register Testing Library DOM matchers and cleanup. |
| `src/components/AppSidebar.tsx` | Persistent primary navigation and discovered-Agent subnavigation. |
| `src/components/AgentVisual.tsx` | Shared SVG identity mark, status indicator, and status-copy helpers. |
| `src/components/AgentCard.tsx` | Compact directory card used by All Agents. |
| `src/components/AppSidebar.test.tsx` | Route-derived sidebar selection tests. |
| `src/components/AgentCard.test.tsx` | Card status, counts, and accessible-link tests. |
| `src/routes/Agents.tsx` | All-Agents directory, loading skeleton, and empty state. |
| `src/routes/Agents.test.tsx` | Directory filtering, empty, and loading-state tests. |
| `src/routes/AgentDetail.tsx` | Detail-only Agent workspace view. |
| `src/routes/AgentDetail.test.tsx` | Detail metadata and missing-Agent route tests. |
| `src/App.tsx` | Install `AppSidebar`; remove old navigation entries and obsolete routes. |
| `src/styles/global.css` | Tokenized dark workspace layout, sidebar, cards, detail, responsive, focus, and motion rules. |

## Task 1: Add UI test support and shared Agent display primitives

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/components/AgentVisual.tsx`
- Create: `src/components/AgentVisual.test.tsx`

**Interfaces:**
- Consumes: `AgentReport` from `src/ipc/types.ts`.
- Produces: `agentStatusCopy(status: string): "Detected" | "Partial" | "Not detected"`; `AgentIdentityMark`; `AgentStatus`.

- [ ] **Step 1: Add the test dependencies and commands**

Update `package.json` with these development dependencies and scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "jsdom": "^25.0.1",
    "vitest": "^2.1.8"
  }
}
```

Add test configuration to `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
  },
});
```

- [ ] **Step 2: Create the shared test setup**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

- [ ] **Step 3: Write failing status-copy tests**

Create `src/components/AgentVisual.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { agentStatusCopy } from "./AgentVisual";

describe("agentStatusCopy", () => {
  it("maps scanner states to readable labels", () => {
    expect(agentStatusCopy("Detected")).toBe("Detected");
    expect(agentStatusCopy("Partial")).toBe("Partial");
    expect(agentStatusCopy("Missing")).toBe("Not detected");
  });
});
```

- [ ] **Step 4: Run the test and confirm it fails**

Run: `pnpm test -- src/components/AgentVisual.test.tsx`

Expected: FAIL because `AgentVisual` does not exist yet.

- [ ] **Step 5: Implement shared Agent display primitives**

Create `src/components/AgentVisual.tsx`:

```tsx
type AgentStatus = "Detected" | "Partial" | "Not detected";

export function agentStatusCopy(status: string): AgentStatus {
  if (status === "Detected") return "Detected";
  if (status === "Partial") return "Partial";
  return "Not detected";
}

export function AgentStatus({ status }: { status: string }) {
  const copy = agentStatusCopy(status);
  return <span className={`agent-status agent-status--${copy.toLowerCase().replace(" ", "-")}`}><i aria-hidden="true" />{copy}</span>;
}

export function AgentIdentityMark({ agentId }: { agentId: string }) {
  return <span className={`agent-identity agent-identity--${agentId}`} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 5h14v14H5z" /><path d="M8 12h8M12 8v8" /></svg></span>;
}
```

- [ ] **Step 6: Run the focused test and verify it passes**

Run: `pnpm test -- src/components/AgentVisual.test.tsx`

Expected: PASS with one passing test.

- [ ] **Step 7: Commit the test foundation**

```bash
git add package.json pnpm-lock.yaml vite.config.ts src/test/setup.ts src/components/AgentVisual.tsx src/components/AgentVisual.test.tsx
git commit -m "test: add agents UI test foundation"
```

## Task 2: Build the shared sidebar and route-derived selection state

**Files:**
- Create: `src/components/AppSidebar.tsx`
- Create: `src/components/AppSidebar.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useScanStore().report`, `AgentReport`, React Router `NavLink` and `useParams`.
- Produces: an `AppSidebar` rendered once next to `Routes`; All Agents route `/agents`; Agent detail route `/agents/:agentId`.

- [ ] **Step 1: Write a failing sidebar test for the non-duplicated hierarchy**

Create `src/components/AppSidebar.test.tsx`:

```tsx
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import AppSidebar from "./AppSidebar";
import { useScanStore } from "../stores/scanStore";

const reportFixture = {
  scan_id: "scan-1", started_at: 0, completed_at: 1, total_skills: 14, total_issues: 0,
  agents: [{ agent_id: "codex", display_name: "Codex", detection_status: "Detected", roots: [], skills: [], issues: [], outcome: "Success" }],
};

describe("AppSidebar", () => {
  beforeEach(() => useScanStore.setState({ report: reportFixture, scanning: false, error: null }));

  it("selects the current Agent child without rendering a top-level Agents item", () => {
    render(<MemoryRouter initialEntries={["/agents/codex"]}><AppSidebar /></MemoryRouter>);
    expect(screen.queryByRole("link", { name: /^Agents$/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Codex/i })).toHaveClass("is-selected");
    expect(screen.getByRole("link", { name: /All Agents/i })).not.toHaveClass("is-selected");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm test -- src/components/AppSidebar.test.tsx`

Expected: FAIL because `AppSidebar` does not exist.

- [ ] **Step 3: Implement the sidebar**

Create `src/components/AppSidebar.tsx` with static destinations and scan-derived child links:

```tsx
const PRIMARY_NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/library", label: "Skill Library" },
  { to: "/install", label: "Install Skills" },
];

export default function AppSidebar() {
  const report = useScanStore((state) => state.report);
  const detected = report?.agents.filter((agent) => agent.detection_status !== "Missing") ?? [];
  return <aside className="app-sidebar">{/* primary links, then All Agents and detected child links */}</aside>;
}
```

Use `NavLink` with `end` on `/agents`, and use a `className` callback so `/agents/:agentId` selects only its matching child. Retain Settings as a visually separated footer control if it remains a supported route.

- [ ] **Step 4: Install the sidebar in `App.tsx`**

Replace the `NAV` array and inline `<aside>` with `<AppSidebar />`. Keep `Dashboard`, `Library`, `Agents`, and `AgentDetail` routes. Remove Matrix and Scan History from the sidebar; retain their route definitions only if existing deep links need compatibility.

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `pnpm test -- src/components/AppSidebar.test.tsx`

Expected: PASS with the selected child and absent duplicate navigation assertion satisfied.

- [ ] **Step 6: Commit the navigation hierarchy**

```bash
git add src/App.tsx src/components/AppSidebar.tsx src/components/AppSidebar.test.tsx
git commit -m "feat: add discovered agents sidebar"
```

## Task 3: Replace the All Agents console with the compact directory

**Files:**
- Create: `src/components/AgentCard.tsx`
- Create: `src/components/AgentCard.test.tsx`
- Modify: `src/routes/Agents.tsx`
- Create: `src/routes/Agents.test.tsx`

**Interfaces:**
- Consumes: `AgentReport`, `AgentIdentityMark`, `AgentStatus`, `useScanStore`.
- Produces: a link to `/agents/:agentId` with name, Skills count, root count, and text-plus-dot status.

- [ ] **Step 1: Write a failing Agent card test**

Create `src/components/AgentCard.test.tsx`:

```tsx
it("exposes Agent counts and readable status through its detail link", () => {
  render(<MemoryRouter><AgentCard agent={agentFixture} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: /Codex/i })).toHaveAttribute("href", "/agents/codex");
  expect(screen.getByText("14 Skills")).toBeVisible();
  expect(screen.getByText("2 Roots")).toBeVisible();
  expect(screen.getByText("Detected")).toBeVisible();
});
```

- [ ] **Step 2: Run the card test and confirm it fails**

Run: `pnpm test -- src/components/AgentCard.test.tsx`

Expected: FAIL because `AgentCard` does not exist.

- [ ] **Step 3: Implement the compact card**

Create `src/components/AgentCard.tsx`:

```tsx
export default function AgentCard({ agent }: { agent: AgentReport }) {
  return <Link className="agent-directory-card" to={`/agents/${agent.agent_id}`}>
    <AgentIdentityMark agentId={agent.agent_id} />
    <span className="agent-directory-card__copy"><strong>{agent.display_name}</strong><span>{agent.skills.length} Skills · {agent.roots.length} Roots</span><AgentStatus status={agent.detection_status} /></span>
    <span className="agent-directory-card__chevron" aria-hidden="true">›</span>
  </Link>;
}
```

- [ ] **Step 4: Write failing route-state tests**

Create `src/routes/Agents.test.tsx` with tests that set the Zustand store to: detected plus partial Agents, an empty report, and `scanning: true` with `report: null`. Assert the directory title/count, empty-state copy, and `aria-busy="true"` loading skeleton respectively.

- [ ] **Step 5: Run the route tests and confirm they fail**

Run: `pnpm test -- src/routes/Agents.test.tsx`

Expected: FAIL because the old console markup has no directory, skeleton, or empty-state semantics.

- [ ] **Step 6: Implement the directory route**

Update `src/routes/Agents.tsx` to:

```tsx
if (scanning && report === null) {
  return <section className="agents-page" aria-busy="true"><div className="agent-directory-skeleton" /><div className="agent-directory-skeleton" /><div className="agent-directory-skeleton" /></section>;
}
```

When a report exists, render the page title `All Agents`, its detected count, and `<div className="agent-directory-grid">` containing `<AgentCard>` values. When no Agents are detected, render a clear empty state with the instruction to install an Agent and rescan. Keep the rescan behavior only inside the empty/loading recovery path; do not place a console control in the default directory header.

- [ ] **Step 7: Run all directory tests and verify they pass**

Run: `pnpm test -- src/components/AgentCard.test.tsx src/routes/Agents.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit the directory route**

```bash
git add src/components/AgentCard.tsx src/components/AgentCard.test.tsx src/routes/Agents.tsx src/routes/Agents.test.tsx
git commit -m "feat: redesign all agents directory"
```

## Task 4: Simplify Agent detail to a detail-only workspace

**Files:**
- Modify: `src/routes/AgentDetail.tsx`
- Create: `src/routes/AgentDetail.test.tsx`

**Interfaces:**
- Consumes: `useParams().agentId`, `useScanStore().report`, `AgentIdentityMark`, `AgentStatus`.
- Produces: a detail view with breadcrumb, root path, summary stats, and Skills inventory; no duplicated Agent directory.

- [ ] **Step 1: Write failing detail tests**

Create `src/routes/AgentDetail.test.tsx`:

```tsx
it("shows only the selected Agent workspace and its root path", () => {
  renderDetailRoute("/agents/claude-code", reportFixture);
  expect(screen.getByRole("heading", { name: "Claude Code" })).toBeVisible();
  expect(screen.getByText("~/.claude/skills")).toBeVisible();
  expect(screen.queryByRole("heading", { name: "All Agents" })).not.toBeInTheDocument();
});

it("offers a recovery link for an unknown Agent", () => {
  renderDetailRoute("/agents/unknown", reportFixture);
  expect(screen.getByRole("link", { name: /All Agents/i })).toHaveAttribute("href", "/agents");
});
```

- [ ] **Step 2: Run the detail tests and confirm they fail**

Run: `pnpm test -- src/routes/AgentDetail.test.tsx`

Expected: FAIL because the route currently renders an oversized workspace header and unrelated management controls.

- [ ] **Step 3: Implement the detail-only layout**

Remove the inline back-link card, refresh action, view switcher, disabled Import/Delete controls, and Add Skill button. Keep client-side skill search only if its label and input remain in a secondary Skills toolbar; otherwise remove the unused state. Render:

```tsx
<section className="agent-detail-page">
  <nav className="agent-breadcrumb" aria-label="Breadcrumb">Discovered Agents <span aria-hidden="true">›</span> {agent.display_name}</nav>
  <header className="agent-detail-header">{/* identity mark, name, root, AgentStatus */}</header>
  <dl className="agent-detail-stats">{/* Skills, roots, issues */}</dl>
  <section aria-labelledby="installed-skills-heading">{/* Skills list and empty state */}</section>
</section>
```

Use a `title` attribute on root paths and preserve one-line truncation in CSS. The persistent sidebar from Task 2 supplies all navigation back to All Agents and sibling Agents.

- [ ] **Step 4: Run the detail tests and verify they pass**

Run: `pnpm test -- src/routes/AgentDetail.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the detail route**

```bash
git add src/routes/AgentDetail.tsx src/routes/AgentDetail.test.tsx
git commit -m "feat: simplify agent workspace detail"
```

## Task 5: Apply tokenized dark workspace styling and responsive behavior

**Files:**
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: class names from Tasks 1–4.
- Produces: dark desktop sidebar, compact directory cards, responsive detail layout, loading skeletons, focus treatment, and reduced-motion fallback.

- [ ] **Step 1: Add semantic theme tokens**

Replace the light-first root tokens with the following tokens:

```css
:root {
  --canvas: #0c0c0f;
  --surface: #121217;
  --surface-hover: #181820;
  --sidebar: #0e0e12;
  --line: #212128;
  --text: #e1e1e9;
  --muted: #8b8b97;
  --accent: #73a7ff;
  --success: #18d697;
  --warning: #e8c05d;
  --sidebar-w: 240px;
}
```

- [ ] **Step 2: Add sidebar and directory styles**

Implement `.app-sidebar`, `.primary-nav`, `.discovered-agents-nav`, `.agent-directory-grid`, and `.agent-directory-card` with the screenshot-inspired near-black surfaces, 1px borders, 8–12px radii, and three-column grid. Set card links to `min-height: 76px`; give `:hover` and `:focus-visible` a 180ms border/background transition.

- [ ] **Step 3: Add detail, status, and loading styles**

Implement `.agent-detail-page`, `.agent-detail-stats`, `.agent-status`, `.agent-status--detected`, `.agent-status--partial`, `.agent-directory-skeleton`, and `.empty-state`. Use a 3-column stat grid, small uppercase labels, one-line root truncation, and a skeleton animation only while loading.

- [ ] **Step 4: Add keyboard, motion, and responsive rules**

Add:

```css
a:focus-visible, button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
@media (max-width: 1024px) { .agent-directory-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 680px) { .app-shell { grid-template-columns: 1fr; } .app-sidebar { display: none; } .agent-directory-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Run the full automated suite and production build**

Run: `pnpm test && pnpm build`

Expected: all tests PASS and Vite build exits with code 0.

- [ ] **Step 6: Perform manual route verification in the running Tauri app**

Check these exact behaviors:

1. `/agents` highlights All Agents in the discovered-Agent group.
2. `/agents/codex` highlights Codex only and does not display a second All Agents list.
3. A Partial Agent shows both its amber dot and the word Partial.
4. At 1024px the directory has two columns; at 680px it has one and no horizontal scroll.
5. Tab navigation shows a visible focus ring on sidebar links and Agent cards.

- [ ] **Step 7: Commit visual styling and verification changes**

```bash
git add src/styles/global.css
git commit -m "style: apply dark agents workspace design"
```

## Plan Self-Review

- Spec coverage: navigation hierarchy is Task 2; All Agents directory, empty, partial, and loading states are Task 3; detail-only Agent workspace is Task 4; dark visual system, responsive layout, accessibility, and motion are Task 5.
- Placeholder scan: no unresolved implementation placeholders are present.
- Type consistency: shared primitives consume `AgentReport` and raw `detection_status` strings; all routes use `/agents` and `/agents/:agentId` consistently.
