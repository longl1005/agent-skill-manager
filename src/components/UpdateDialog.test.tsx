import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useI18nStore } from "../stores/i18nStore";
import { useUpdateStore } from "../stores/updateStore";
import { UpdateDialog } from "./UpdateDialog";

describe("UpdateDialog", () => {
  beforeEach(() => {
    useI18nStore.setState({ lang: "en" });
    useUpdateStore.setState({
      status: "available",
      update: { version: "1.2.0", notes: "Fixes", date: "2026-08-06", native: undefined as never },
      progress: null,
      error: null,
    });
  });

  it("dismisses an available update for the current session", () => {
    render(<UpdateDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
