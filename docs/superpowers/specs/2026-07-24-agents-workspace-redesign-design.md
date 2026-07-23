# Agents Workspace Redesign Design

**Date:** 2026-07-24
**Status:** Approved for specification review

## Goal

Redesign the Agents experience into a compact, dark Skill Manager workspace. The new experience uses a single, non-duplicated agent navigation hierarchy and makes the Agent list easy to scan while reserving management detail for the Agent detail view.

## Scope

- Update the persistent application navigation and its responsive behavior.
- Redesign the all-agents route (`/agents`) as a three-column Agent directory on desktop.
- Redesign the Agent detail route (`/agents/:agentId`) while retaining the persistent sidebar.
- Preserve existing scan data, routes, and local IPC behavior.

Out of scope:

- Adding or removing Agent adapters.
- Changing scan result schemas or database behavior.
- Adding Presets or scan-history controls to the Agents experience.

## Information Architecture

The sidebar has three primary destinations:

1. Dashboard
2. Skill Library
3. Install Skills

Below the primary navigation is an expandable **Discovered Agents** group:

- **All Agents** is the default group item and routes to `/agents`.
- Each discovered Agent is a child item and routes to `/agents/:agentId`.
- On an Agent detail route, the matching Agent child is selected.
- On `/agents`, only All Agents is selected.

This removes the duplicate top-level "Agents" item. The group represents the collection; its children represent the individual workspaces.

## Visual System

- Use an ink-black canvas with near-black sidebar and dark-gray surfaces.
- Separate surfaces with subtle `1px` borders and compact `8px–12px` radii.
- Use green only for healthy/discovered state, blue for selected and keyboard-focus state, and amber for partial state.
- Keep Agent identity icons visually distinct, but use SVG iconography for structural controls and navigation.
- Use a compact, data-oriented type scale: 10–11px labels, 12–14px metadata, 14px card titles, and 22–25px page titles.

## All Agents Page

The page contains:

- Title: **All Agents**, with detected-Agent count.
- One-line explanatory copy.
- Responsive Agent directory grid: three columns on large desktop, two columns on medium widths, one column on narrow widths.

Each Agent card includes:

- Agent identity icon and name.
- Skill count and root count.
- A text label plus a colored status indicator: Detected, Partial, or Not detected.
- A chevron affordance to open the Agent detail route.

The directory intentionally excludes duplicated summary panels, Preset controls, and scan-control affordances.

## Agent Detail Page

The detail route retains the same sidebar and marks the current Agent child as selected. The main content contains:

- Breadcrumb from Discovered Agents to the selected Agent.
- Agent icon, display name, root path, and textual availability state.
- Summary stats for Skills, roots, and issues.
- Installed Skills section with name, description, enabled state, and a link/control to view the full set.

The page does not render a second All Agents list. Switching Agents through the sidebar updates the selected child and the main content only.

## States and Feedback

- Scanning or loading longer than 300ms shows skeleton placeholders or a progress indicator.
- No discovered Agents displays an empty state explaining how to install or scan for an Agent.
- Partial detection uses an amber dot plus the word "Partial" and a short recovery hint.
- Errors remain adjacent to the relevant Agent or Skills section with a recovery action.
- Hover, focus, and selected states transition through color, opacity, or border changes in 150–300ms. Motion respects `prefers-reduced-motion`.

## Accessibility and Responsive Behavior

- Navigation, cards, and secondary controls expose visible keyboard focus indicators.
- Status never relies on color alone; text labels accompany all status indicators.
- Body text on dark surfaces meets a 4.5:1 contrast ratio.
- Side navigation is persistent on desktop and becomes an appropriate compact navigation pattern at narrow widths.
- Agent cards and navigation controls maintain at least 44px interactive targets.

## Verification

1. Run `pnpm build`.
2. Verify `/agents` selects All Agents and renders detected, partial, and empty states.
3. Verify `/agents/:agentId` selects only the matching Agent child and does not duplicate the All Agents directory.
4. Verify keyboard navigation and visible focus for sidebar and Agent cards.
5. Verify the directory layout at desktop, medium, and narrow widths without horizontal scrolling.
