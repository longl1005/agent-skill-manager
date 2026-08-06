import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows content when its action is hovered and hides it after leaving", () => {
    render(
      <Tooltip content="Open folder">
        <button type="button">Folder</button>
      </Tooltip>,
    );

    const action = screen.getByRole("button", { name: "Folder" });
    fireEvent.pointerEnter(action);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Open folder");

    fireEvent.pointerLeave(action);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("links the focused action to its tooltip", () => {
    render(
      <Tooltip content="Delete skill">
        <button type="button">Delete</button>
      </Tooltip>,
    );

    const action = screen.getByRole("button", { name: "Delete" });
    fireEvent.focus(action);

    const tooltip = screen.getByRole("tooltip");
    expect(action).toHaveAttribute("aria-describedby", tooltip.id);
  });
});
