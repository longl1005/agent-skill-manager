import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentIdentityMark, AgentStatus, agentStatusCopy } from "./AgentVisual";

import { useI18nStore } from "../stores/i18nStore";

describe("agentStatusCopy", () => {
  it("normalizes recognized and unrecognized agent statuses", () => {
    expect(agentStatusCopy("Detected")).toBe("Detected");
    expect(agentStatusCopy("Partial")).toBe("Partial");
    expect(agentStatusCopy("Missing")).toBe("Not detected");
  });

  it("renders normalized status text with its modifier class and color", () => {
    useI18nStore.setState({ lang: "en" });
    render(<AgentStatus status="Missing" />);

    expect(screen.getByText("Not detected")).toHaveClass("agent-status--not-detected");
    expect(screen.getByText("Not detected")).toHaveStyle({ color: "rgb(185, 28, 28)" });
  });
});

describe("AgentIdentityMark", () => {
  it("renders official Claude identity mark when agentId contains claude", () => {
    render(<AgentIdentityMark agentId="claude-code" />);

    expect(screen.getByLabelText("claude-code identity mark")).toBeInTheDocument();
  });

  it("renders official Codex identity mark when agentId contains codex", () => {
    render(<AgentIdentityMark agentId="codex" />);

    expect(screen.getByLabelText("codex identity mark")).toBeInTheDocument();
  });

  it("renders official Antigravity identity mark when agentId contains antigravity", () => {
    render(<AgentIdentityMark agentId="antigravity" />);

    expect(screen.getByLabelText("antigravity identity mark")).toBeInTheDocument();
  });

  it("renders official Pi Agent identity mark when agentId contains pi", () => {
    render(<AgentIdentityMark agentId="pi-agent" />);

    expect(screen.getByLabelText("pi-agent identity mark")).toBeInTheDocument();
  });

  it("renders the Oh My Pi identity mark before the generic Pi Agent match", () => {
    render(<AgentIdentityMark agentId="oh-my-pi" />);

    expect(screen.getByLabelText("oh-my-pi identity mark")).toBeInTheDocument();
  });
});
