# URL 安装输入框焦点样式修复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Git / GitHub URL input show one visible focus indicator instead of a doubled blue border.

**Architecture:** The page-specific input rule will override the shared `input:focus-visible` outline only for `.install-url-input`. Its existing focused border remains the visual indication, so no JSX, layout, or interaction behavior changes.

**Tech Stack:** CSS, Vitest.

## Global Constraints

- Preserve `.install-url-input:focus` as the single theme-colored focus indicator.
- Do not alter the URL form's width, spacing, submit behavior, or accessibility label.
- Keep the global focus-visible rule unchanged for every other input.

---

### Task 1: Scope the URL input focus override

**Files:**
- Modify: `src/styles/global.test.ts`
- Modify: `src/styles/global.css:4052-4065`

**Interfaces:**
- Consumes: the existing global `input:not(.skill-search *):focus-visible` accessibility rule.
- Produces: a URL-input-specific `:focus-visible` rule that suppresses only its duplicated outline.

- [ ] **Step 1: Write the failing style contract test**

Add this test to `src/styles/global.test.ts`:

```ts
describe("Git URL input focus styling", () => {
  it("uses its focused border without the global focus-visible outline", () => {
    expect(styles).toContain(".install-url-input:focus-visible {\n  outline: none;\n  outline-offset: 0;\n}");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/styles/global.test.ts`

Expected: FAIL because `.install-url-input:focus-visible` does not yet override the global outline.

- [ ] **Step 3: Add the minimal page-specific focus rule**

Append this directly after the existing `.install-url-input:focus` rule in `src/styles/global.css`:

```css
.install-url-input:focus-visible {
  outline: none;
  outline-offset: 0;
}
```

- [ ] **Step 4: Verify the focused URL input style**

Run: `npm test -- src/styles/global.test.ts && npm run build`

Expected: PASS. The development app shows a single blue border around the focused URL input.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css src/styles/global.test.ts
git commit -m "fix: remove duplicate URL input focus ring"
```
