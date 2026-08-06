# Git URL Input Focus Specificity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicate global focus outline from the Git URL input while retaining its focused border.

**Architecture:** CSS only. The local `:focus-visible` rule will match the global selector's specificity and appear later in the stylesheet, so it wins in the cascade without affecting other inputs.

**Tech Stack:** React, TypeScript, Vitest, CSS.

## Global Constraints

- Change only the Git URL input focus selector and its regression assertion.
- Keep the focused blue 1px border and remove the external outline.
- Do not change layout, dimensions, copy, or other input controls.

---

### Task 1: Make the local focus rule win the CSS cascade

**Files:**
- Modify: `src/styles/global.test.ts:25-29`
- Modify: `src/styles/global.css:4074-4077`

**Interfaces:**
- Consumes: global `input:not(.skill-search *):focus-visible` rule in `src/styles/global.css:954-959`.
- Produces: a more specific `input.install-url-input:focus-visible` rule that cancels the global outline for this field only.

- [ ] **Step 1: Write the failing test**

Replace the current expected selector in the existing focus-style test:

```ts
expect(styles).toContain("input.install-url-input:focus-visible {\n  outline: none;\n  outline-offset: 0;\n}");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/styles/global.test.ts`

Expected: FAIL because the stylesheet still contains `.install-url-input:focus-visible`.

- [ ] **Step 3: Write minimal implementation**

Replace the selector only:

```css
input.install-url-input:focus-visible {
  outline: none;
  outline-offset: 0;
}
```

- [ ] **Step 4: Run focused verification**

Run: `npm test -- src/styles/global.test.ts && npm run build`

Expected: the style test passes and the TypeScript production build exits successfully.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/styles/global.test.ts
git commit -m "fix: override global URL input focus outline"
```
