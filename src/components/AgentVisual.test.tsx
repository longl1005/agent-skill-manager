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

  it("renders the Cline identity mark", () => {
    render(<AgentIdentityMark agentId="cline" />);

    expect(screen.getByLabelText("cline identity mark")).toHaveAttribute("src", expect.stringContaining("cline.png"));
  });

  it("renders the GitHub Copilot identity mark", () => {
    render(<AgentIdentityMark agentId="github-copilot" />);

    expect(screen.getByLabelText("github-copilot identity mark")).toHaveAttribute("src", expect.stringContaining("github-copilot.png"));
  });

  it("renders the Droid identity mark", () => {
    render(<AgentIdentityMark agentId="droid" />);

    expect(screen.getByLabelText("droid identity mark")).toHaveAttribute("src", expect.stringContaining("droid.svg"));
  });

  it("renders the Qoder identity mark", () => {
    render(<AgentIdentityMark agentId="qoder" />);

    expect(screen.getByLabelText("qoder identity mark")).toHaveAttribute("src", expect.stringContaining("qoder.svg"));
  });

  it("renders the Qwen Code identity mark", () => {
    render(<AgentIdentityMark agentId="qwen-code" />);

    expect(screen.getByLabelText("qwen-code identity mark")).toHaveAttribute("src", expect.stringContaining("qwen-code.png"));
  });

  it("renders the Hermes identity mark", () => {
    render(<AgentIdentityMark agentId="hermes" />);

    expect(screen.getByLabelText("hermes identity mark")).toHaveAttribute("src", expect.stringContaining("hermes.webp"));
  });

  it("renders the OpenClaw identity mark", () => {
    render(<AgentIdentityMark agentId="openclaw" />);

    expect(screen.getByLabelText("openclaw identity mark")).toHaveAttribute("src", expect.stringContaining("openclaw.webp"));
  });

  it("renders the supplied WorkBuddy identity mark", () => {
    render(<AgentIdentityMark agentId="workbuddy" />);

    expect(screen.getByLabelText("workbuddy identity mark")).toHaveAttribute("src", expect.stringContaining("workbuddy.svg"));
  });

  it("renders the CodeBuddy identity mark", () => {
    render(<AgentIdentityMark agentId="codebuddy" />);

    expect(screen.getByLabelText("codebuddy identity mark")).toHaveAttribute("src", expect.stringContaining("codebuddy.webp"));
  });

  it("renders the Kimi Code CLI identity mark", () => {
    render(<AgentIdentityMark agentId="kimi-code" />);

    expect(screen.getByLabelText("kimi-code identity mark")).toHaveAttribute("src", expect.stringContaining("kimi.webp"));
  });

  it("renders the MiniMax Code identity mark", () => {
    render(<AgentIdentityMark agentId="minimax-code" />);

    expect(screen.getByLabelText("minimax-code identity mark")).toHaveAttribute("src", expect.stringContaining("minimax-code.webp"));
  });

  it("renders the Augment identity mark", () => {
    render(<AgentIdentityMark agentId="augment" />);

    expect(screen.getByLabelText("augment identity mark")).toHaveAttribute("src", expect.stringContaining("augment.webp"));
  });

  it("renders the Roo Code identity mark", () => {
    render(<AgentIdentityMark agentId="roo-code" />);

    expect(screen.getByLabelText("roo-code identity mark")).toHaveAttribute("src", expect.stringContaining("roo-code.svg"));
  });

  it("renders the Windsurf identity mark", () => {
    render(<AgentIdentityMark agentId="windsurf" />);

    expect(screen.getByLabelText("windsurf identity mark")).toHaveAttribute("src", expect.stringContaining("windsurf.webp"));
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

  it("renders the Grok identity mark when agentId is grok", () => {
    render(<AgentIdentityMark agentId="grok" />);

    expect(screen.getByLabelText("grok identity mark")).toHaveAttribute("src", expect.stringContaining("grok.webp"));
  });

  it("renders the Kiro CLI identity image when agentId is kiro", () => {
    render(<AgentIdentityMark agentId="kiro" />);

    expect(screen.getByLabelText("kiro identity mark")).toHaveAttribute("src", expect.stringContaining("kiro.webp"));
  });

  it("renders distinct TRAE and TRAE CN identity images", () => {
    const { rerender } = render(<AgentIdentityMark agentId="trae" />);
    expect(screen.getByLabelText("trae identity mark")).toHaveTextContent("TRAE");

    rerender(<AgentIdentityMark agentId="trae-cn" />);
    expect(screen.getByLabelText("trae-cn identity mark")).toHaveTextContent("TRAE");
    expect(screen.getByText("CN")).toBeInTheDocument();
  });
});
