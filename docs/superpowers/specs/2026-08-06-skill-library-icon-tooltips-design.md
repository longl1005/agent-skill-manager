# Skill library icon tooltips

## Goal

Make the four icon-only actions in each master-skill card understandable without
requiring users to infer their meaning from the icons.

## Scope

Add a reusable tooltip presentation for these actions in the master skill
library:

1. Link or unlink all detected Agents.
2. Open the skill directory.
3. Export the skill as a ZIP archive.
4. Delete the skill.

The tooltip copy changes with the active Chinese or English interface language.
For the first action, the copy reflects whether it will link all Agents or
unlink all Agents.

## Interaction and accessibility

- A tooltip appears above an action button on pointer hover and keyboard focus.
- It disappears when the pointer leaves or the button loses focus.
- The tooltip does not handle click events or alter button propagation, loading,
  disabled, export, directory, linking, or deletion behavior.
- The visible tooltip is associated with its control through `aria-describedby`.
- Existing descriptive button labels remain available to assistive technology.

## Implementation

Create a small reusable React tooltip component, styled in `global.css` with the
existing dark-surface, border, and accent variables. The component wraps its
single child action and renders only while hovered or focused. `SkillLibrary`
will supply localized text from the i18n dictionary for each of the four
actions.

## Testing

Extend the Skill Library route tests to verify that the four icon action
buttons expose their localized tooltip text through the tooltip association.
The interaction test will cover keyboard focus so the accessible path is tested
without relying on visual-only assertions.
