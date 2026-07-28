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
import codexWebp from "../assets/icons/agents/codex.webp";
import antigravityWebp from "../assets/icons/agents/antigravity.webp";
import piAgentWebp from "../assets/icons/agents/pi-agent.webp";
import openCodeWebp from "../assets/icons/agents/opencode.webp";
import cursorWebp from "../assets/icons/agents/cursor.webp";

export function ClaudeCodeMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={claudeCodeWebp} alt="claude-code identity mark" aria-label="claude-code identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
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

export function PiAgentMark({ size = 32 }: { size?: number }): JSX.Element {
  const borderRadius = Math.round(size * 0.25);
  return <img className="agent-icon-img" src={piAgentWebp} alt="pi-agent identity mark" aria-label="pi-agent identity mark" width={size} height={size} style={{ borderRadius, display: "block" }} />;
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
  if (agentId.toLowerCase().includes("codex")) {
    return <CodexMark size={size} />;
  }
  if (agentId.toLowerCase().includes("antigravity")) {
    return <AntigravityMark size={size} />;
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
