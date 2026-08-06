# Skill Library Icon Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show accessible, localized hover and focus tooltips for every icon-only action on master-skill cards.

**Architecture:** Add a focused `Tooltip` component that owns visible state and accessibility wiring while preserving its child button unchanged. Use it from `SkillLibrary` with localized action text, and keep visual styling in the existing global stylesheet.

**Tech Stack:** React 18, TypeScript, Vitest, React Testing Library, CSS.

## Global Constraints

- Do not change any existing action's click behavior, loading state, disabled condition, or event propagation.
- Tooltips must display on pointer hover and keyboard focus, and hide on pointer leave and blur.
- Tooltip content must be available in Simplified Chinese and English via `src/locales/dict.ts`.
- Tooltip controls must use `aria-describedby`; existing button `aria-label`s remain intact.
- Use existing CSS variables from `src/styles/global.css`; add no dependencies.

---

### Task 1: Build an accessible reusable Tooltip

**Files:**
- Create: `src/components/Tooltip.tsx`
- Create: `src/components/Tooltip.test.tsx`
- Modify: `src/styles/global.css`

**Interfaces:**
- Produces: `Tooltip({ content, children }: { content: string; children: ReactElement })`.
- Consumes: one focusable child that accepts pointer and focus event handlers plus `aria-describedby`.

- [ ] **Step 1: Write the failing tooltip behavior tests**

```tsx
it("shows content when its action is hovered and hides it after leaving", () => {
  render(<Tooltip content="Open folder"><button type="button">Folder</button></Tooltip>);

  const action = screen.getByRole("button", { name: "Folder" });
  fireEvent.pointerEnter(action);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Open folder");

  fireEvent.pointerLeave(action);
  expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
});

it("links the focused action to its tooltip", () => {
  render(<Tooltip content="Delete skill"><button type="button">Delete</button></Tooltip>);

  const action = screen.getByRole("button", { name: "Delete" });
  fireEvent.focus(action);

  const tooltip = screen.getByRole("tooltip");
  expect(action).toHaveAttribute("aria-describedby", tooltip.id);
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm test -- src/components/Tooltip.test.tsx`

Expected: FAIL because `src/components/Tooltip` does not exist.

- [ ] **Step 3: Implement the minimum tooltip component**

```tsx
import { cloneElement, useId, useState, type ReactElement } from "react";

export function Tooltip({ content, children }: { content: string; children: ReactElement }) {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span className="tooltip" onPointerEnter={() => setVisible(true)} onPointerLeave={() => setVisible(false)} onFocusCapture={() => setVisible(true)} onBlurCapture={() => setVisible(false)}>
      {cloneElement(children, { "aria-describedby": visible ? tooltipId : undefined })}
      {visible && <span id={tooltipId} className="tooltip__content" role="tooltip">{content}</span>}
    </span>
  );
}
```

Add `.tooltip` positioning and `.tooltip__content` above-button styling with the existing `--surface`, `--line`, `--text`, and `--canvas` variables. Set `pointer-events: none` on the tooltip bubble so entering it cannot keep the tooltip open.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm test -- src/components/Tooltip.test.tsx`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit the reusable component**

```bash
git add src/components/Tooltip.tsx src/components/Tooltip.test.tsx src/styles/global.css
git commit -m "feat: add accessible tooltip component"
```

### Task 2: Apply localized tips to master-skill action buttons

**Files:**
- Modify: `src/locales/dict.ts`
- Modify: `src/routes/SkillLibrary.tsx:1-280`
- Modify: `src/routes/SkillLibrary.test.tsx:1-280`

**Interfaces:**
- Consumes: `Tooltip` from `src/components/Tooltip.tsx` and `t(key, lang)` from `src/locales/dict.ts`.
- Produces: localized tooltip text and tooltip associations for link-all, folder, export, and delete buttons on every master-skill card.

- [ ] **Step 1: Write the failing SkillLibrary tooltip integration test**

```tsx
it("shows localized tips for every master-skill icon action", () => {
  render(<MemoryRouter><SkillLibrary /></MemoryRouter>);

  const card = screen.getByTestId("skill-card-web-search-pro");
  const actions = within(card).getAllByRole("button");
  const [linkAll, openFolder, exportSkill, deleteSkill] = actions.slice(0, 4);

  fireEvent.focus(linkAll);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Link all Agents");
  fireEvent.blur(linkAll);
  fireEvent.focus(openFolder);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Open Folder");
  fireEvent.blur(openFolder);
  fireEvent.focus(exportSkill);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Export skill");
  fireEvent.blur(exportSkill);
  fireEvent.focus(deleteSkill);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Delete skill");
});
```

Import `within` from `@testing-library/react` in the test file. Keep the existing click-behavior tests unchanged.

- [ ] **Step 2: Run the route test to verify it fails**

Run: `npm test -- src/routes/SkillLibrary.test.tsx`

Expected: FAIL because the card action buttons are not wrapped in a tooltip and the localization keys do not exist.

- [ ] **Step 3: Add locale entries and wrap the four actions**

```ts
// zh
"skillLibrary.linkAllAgents": "关联全部 Agent",
"skillLibrary.unlinkAllAgents": "取消关联全部 Agent",
"skillLibrary.exportSkill": "导出技能",
"skillLibrary.deleteSkill": "删除技能",

// en
"skillLibrary.linkAllAgents": "Link all Agents",
"skillLibrary.unlinkAllAgents": "Unlink all Agents",
"skillLibrary.exportSkill": "Export skill",
"skillLibrary.deleteSkill": "Delete skill",
```

Import `Tooltip` in `SkillLibrary.tsx`. Wrap each of the existing link-all, open-directory, share, and delete buttons. Use the existing `openDirectory` translation for the folder action, `exportSkill` for sharing, and select `linkAllAgents` or `unlinkAllAgents` from the current `allLinked` state.

- [ ] **Step 4: Run the route test to verify it passes**

Run: `npm test -- src/routes/SkillLibrary.test.tsx`

Expected: PASS, including the new tooltip interaction test and existing click tests.

- [ ] **Step 5: Run the full frontend verification suite**

Run: `npm test && npm run build`

Expected: PASS with all tests green and TypeScript/Vite build completing successfully.

- [ ] **Step 6: Commit the SkillLibrary integration**

```bash
git add src/locales/dict.ts src/routes/SkillLibrary.tsx src/routes/SkillLibrary.test.tsx
git commit -m "feat: add tooltips to skill actions"
```
