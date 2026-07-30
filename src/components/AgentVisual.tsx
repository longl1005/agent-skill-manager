import type { CSSProperties, JSX } from "react";
import { useI18nStore } from "../stores/i18nStore";
import { t } from "../locales/dict";

export type AgentStatus = "Detected" | "Partial" | "Not detected";

const statusClassNames: Record<AgentStatus, string> = {
  Detected: "detected",
  Partial: "partial",
  "Not detected": "not-detected",
};

const statusColors: Record<AgentStatus, CSSProperties["color"]> = {
  Detected: "rgb(21, 128, 61)",
  Partial: "rgb(180, 83, 9)",
  "Not detected": "rgb(185, 28, 28)",
};

export function agentStatusCopy(status: string): AgentStatus {
  if (status === "Detected" || status === "Partial") {
    return status;
  }

  return "Not detected";
}

export function AgentStatus({ status }: { status: string }): JSX.Element {
  const normalizedStatus = agentStatusCopy(status);
  const lang = useI18nStore((state) => state.lang);

  let statusText = normalizedStatus as string;
  if (normalizedStatus === "Detected") {
    statusText = t("agentStatus.detected", lang);
  } else if (normalizedStatus === "Partial") {
    statusText = t("agentStatus.partial", lang);
  } else {
    statusText = t("agentStatus.notDetected", lang);
  }

  return (
    <span
      className={`agent-status agent-status--${statusClassNames[normalizedStatus]}`}
      style={{ color: statusColors[normalizedStatus] }}
    >
      {statusText}
    </span>
  );
}

function agentIdHash(agentId: string): number {
  return [...agentId].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 0);
}

import claudeCodeWebp from "../assets/icons/agents/claude-code.webp";
import clinePng from "../assets/icons/agents/cline.png";
import codeBuddyWebp from "../assets/icons/agents/codebuddy.webp";
import githubCopilotPng from "../assets/icons/agents/github-copilot.png";
import droidSvg from "../assets/icons/agents/droid.svg";
import qoderSvg from "../assets/icons/agents/qoder.svg";
import qwenCodePng from "../assets/icons/agents/qwen-code.png";
import rooCodeSvg from "../assets/icons/agents/roo-code.svg";
import hermesWebp from "../assets/icons/agents/hermes.webp";
import kimiWebp from "../assets/icons/agents/kimi.webp";
import openclawWebp from "../assets/icons/agents/openclaw.webp";
import workBuddySvg from "../assets/icons/agents/workbuddy.svg";
import windsurfWebp from "../assets/icons/agents/windsurf.webp";
import codexWebp from "../assets/icons/agents/codex.webp";
import antigravityWebp from "../assets/icons/agents/antigravity.webp";
import augmentWebp from "../assets/icons/agents/augment.webp";
import piAgentWebp from "../assets/icons/agents/pi-agent.webp";
import ohMyPiWebp from "../assets/icons/agents/oh-my-pi.webp";
import grokWebp from "../assets/icons/agents/grok.webp";
import kiroWebp from "../assets/icons/agents/kiro.webp";
import openCodeWebp from "../assets/icons/agents/opencode.webp";
import cursorWebp from "../assets/icons/agents/cursor.webp";

/** The ASM product mark, used for Master Skill Library content (not an Agent). */
export function AppIdentityMark({ size = 32 }: { size?: number }): JSX.Element {
  const radius = Math.round(size * 0.25);
  const strokeWidth = Math.max(1.5, size * 0.078);
  return (
    <svg
      aria-label="Agent Skill Manager identity mark"
      height={size}
      role="img"
      viewBox="0 0 32 32"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="var(--accent)" height="32" rx={radius * (32 / size)} width="32" />
      <path d="M16 9v9m0 0-6 5m6-5 6 5" fill="none" stroke="var(--surface)" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth * (32 / size)} />
      <circle cx="16" cy="8" fill="var(--surface)" r="3" />
      <circle cx="9" cy="24" fill="var(--surface)" r="3" />
      <circle cx="23" cy="24" fill="var(--surface)" r="3" />
    </svg>
  );
}

export function ClaudeCodeMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={claudeCodeWebp} alt="claude-code identity mark" aria-label="claude-code identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function ClineMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={clinePng} alt="cline identity mark" aria-label="cline identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function CodeBuddyMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={codeBuddyWebp} alt="codebuddy identity mark" aria-label="codebuddy identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function GitHubCopilotMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={githubCopilotPng} alt="github-copilot identity mark" aria-label="github-copilot identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function DroidMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={droidSvg} alt="droid identity mark" aria-label="droid identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function QoderMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={qoderSvg} alt="qoder identity mark" aria-label="qoder identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function QwenCodeMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={qwenCodePng} alt="qwen-code identity mark" aria-label="qwen-code identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function RooCodeMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={rooCodeSvg} alt="roo-code identity mark" aria-label="roo-code identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function HermesMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={hermesWebp} alt="hermes identity mark" aria-label="hermes identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function KimiCodeMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={kimiWebp} alt="kimi-code identity mark" aria-label="kimi-code identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function OpenClawMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={openclawWebp} alt="openclaw identity mark" aria-label="openclaw identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function WorkBuddyMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={workBuddySvg} alt="workbuddy identity mark" aria-label="workbuddy identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function WindsurfMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={windsurfWebp} alt="windsurf identity mark" aria-label="windsurf identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function CodexMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  const innerSize = Math.round(size * 0.72);
  return (
    <span
      className="agent-icon-tile agent-icon-tile--codex"
      style={{
        width: size,
        height: size,
        borderRadius,
        background: "#FFFFFF",
        border: "1px solid rgba(228, 228, 231, 0.8)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.12)",
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    >
      <img src={codexWebp} alt="codex identity mark" aria-label="codex identity mark" width={innerSize} height={innerSize} style={{ display: "block" }} />
    </span>
  );
}

export function AntigravityMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={antigravityWebp} alt="antigravity identity mark" aria-label="antigravity identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function AugmentMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={augmentWebp} alt="augment identity mark" aria-label="augment identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function PiAgentMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={piAgentWebp} alt="pi-agent identity mark" aria-label="pi-agent identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function OhMyPiMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={ohMyPiWebp} alt="oh-my-pi identity mark" aria-label="oh-my-pi identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function GrokMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={grokWebp} alt="grok identity mark" aria-label="grok identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function KiroMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={kiroWebp} alt="kiro identity mark" aria-label="kiro identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function TraeMark({ size = 32 }: { size?: number }): JSX.Element {
  return <TraeWordmark size={size} label="trae identity mark" />;
}

export function TraeCnMark({ size = 32 }: { size?: number }): JSX.Element {
  const badgeSize = Math.max(9, Math.round(size * 0.42));
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <TraeWordmark size={size} label="trae-cn identity mark" />
      <span aria-label="TRAE CN badge" style={{ position: "absolute", right: -2, bottom: -2, minWidth: badgeSize, height: badgeSize, padding: "0 2px", borderRadius: Math.ceil(badgeSize / 2), background: "#dc2626", color: "#fff", border: "1px solid #111", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: Math.max(6, Math.round(size * 0.22)), fontWeight: 800, lineHeight: 1, letterSpacing: "-0.04em", boxSizing: "border-box" }}>CN</span>
    </span>
  );
}

function TraeWordmark({ size, label }: { size: number; label: string }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <span aria-label={label} role="img" style={{ width: size, height: size, borderRadius, display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", background: "#111114", border: "1px solid #3f3f46", color: "#fafafa", fontFamily: "Arial Narrow, Impact, sans-serif", fontWeight: 800, fontSize: Math.max(7, Math.round(size * 0.34)), letterSpacing: "-0.09em", lineHeight: 1 }}>TRAE</span>;
}

export function OpenCodeMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={openCodeWebp} alt="opencode identity mark" aria-label="opencode identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function CursorMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={cursorWebp} alt="cursor identity mark" aria-label="cursor identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
}

export function AgentSidebarIcon({ agentId }: { agentId: string }): JSX.Element {
  return (
    <span
      className="sidebar-agent-icon"
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 18,
        height: 18,
        flexShrink: 0,
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <AgentIdentityMark agentId={agentId} size={18} />
    </span>
  );
}

export function AgentIdentityMark({ agentId, size = 32 }: { agentId: string; size?: number }): JSX.Element {
  if (agentId.toLowerCase().includes("claude")) {
    return <ClaudeCodeMark size={size} />;
  }
  if (agentId.toLowerCase() === "cline") {
    return <ClineMark size={size} />;
  }
  if (agentId.toLowerCase() === "codebuddy") {
    return <CodeBuddyMark size={size} />;
  }
  if (agentId.toLowerCase().includes("github-copilot")) {
    return <GitHubCopilotMark size={size} />;
  }
  if (agentId.toLowerCase() === "droid") {
    return <DroidMark size={size} />;
  }
  if (agentId.toLowerCase() === "qoder") {
    return <QoderMark size={size} />;
  }
  if (agentId.toLowerCase() === "qwen-code") {
    return <QwenCodeMark size={size} />;
  }
  if (agentId.toLowerCase() === "roo-code") {
    return <RooCodeMark size={size} />;
  }
  if (agentId.toLowerCase() === "hermes") {
    return <HermesMark size={size} />;
  }
  if (agentId.toLowerCase() === "kimi-code") {
    return <KimiCodeMark size={size} />;
  }
  if (agentId.toLowerCase() === "openclaw") {
    return <OpenClawMark size={size} />;
  }
  if (agentId.toLowerCase() === "workbuddy") {
    return <WorkBuddyMark size={size} />;
  }
  if (agentId.toLowerCase() === "windsurf") {
    return <WindsurfMark size={size} />;
  }
  if (agentId.toLowerCase().includes("codex")) {
    return <CodexMark size={size} />;
  }
  if (agentId.toLowerCase().includes("antigravity")) {
    return <AntigravityMark size={size} />;
  }
  if (agentId.toLowerCase() === "augment") {
    return <AugmentMark size={size} />;
  }
  if (agentId.toLowerCase().includes("oh-my-pi")) {
    return <OhMyPiMark size={size} />;
  }
  if (agentId.toLowerCase().includes("grok")) {
    return <GrokMark size={size} />;
  }
  if (agentId.toLowerCase().includes("kiro")) {
    return <KiroMark size={size} />;
  }
  if (agentId.toLowerCase().includes("trae-cn")) {
    return <TraeCnMark size={size} />;
  }
  if (agentId.toLowerCase().includes("trae")) {
    return <TraeMark size={size} />;
  }
  if (agentId.toLowerCase().includes("pi")) {
    return <PiAgentMark size={size} />;
  }
  if (agentId.toLowerCase().includes("opencode") || agentId.toLowerCase().includes("open-code")) {
    return <OpenCodeMark size={size} />;
  }
  if (agentId.toLowerCase().includes("cursor")) {
    return <CursorMark size={size} />;
  }

  const hash = agentIdHash(agentId);
  const hue = hash % 360;
  const accentHue = (hue + 48 + (hash % 36)) % 360;
  const markId = `agent-mark-${hash.toString(36)}`;
  const eyeOffset = 9 + (hash % 5);
  const antennaHeight = 4 + ((hash >>> 4) % 5);

  return (
    <svg
      aria-label={`${agentId} identity mark`}
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={markId} x1="4" x2="28" y1="4" y2="28">
          <stop offset="0" stopColor={`hsl(${hue} 70% 56%)`} />
          <stop offset="1" stopColor={`hsl(${accentHue} 75% 62%)`} />
        </linearGradient>
      </defs>
      <path d={`M16 ${antennaHeight + 4}V4`} stroke={`hsl(${accentHue} 75% 62%)`} strokeWidth="2" />
      <circle cx="16" cy="3" fill={`hsl(${accentHue} 75% 62%)`} r="2" />
      <rect fill={`url(#${markId})`} height="20" rx="7" width="24" x="4" y="8" />
      <circle cx={eyeOffset} cy="17" fill="white" r="2" />
      <circle cx={32 - eyeOffset} cy="17" fill="white" r="2" />
      <path d="M11 22C13.8 24 18.2 24 21 22" stroke="white" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
