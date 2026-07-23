import type { CSSProperties, JSX } from "react";

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

  return (
    <span
      className={`agent-status agent-status--${statusClassNames[normalizedStatus]}`}
      style={{ color: statusColors[normalizedStatus] }}
    >
      {normalizedStatus}
    </span>
  );
}

function agentIdHash(agentId: string): number {
  return [...agentId].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 0);
}

export function AgentIdentityMark({ agentId }: { agentId: string }): JSX.Element {
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
