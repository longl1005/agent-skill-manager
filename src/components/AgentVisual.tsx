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

export function ClaudeCodeMark(): JSX.Element {
  return (
    <svg
      aria-label="claude-code identity mark"
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#D97757" height="32" rx="8" width="32" x="0" y="0" />
      <g transform="translate(4, 4)">
        <svg height="24" viewBox="0 0 24 24" width="24">
          <path
            d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z"
            fill="#FFFFFF"
            fillRule="nonzero"
          />
        </svg>
      </g>
    </svg>
  );
}

export function CodexMark(): JSX.Element {
  return (
    <svg
      aria-label="codex identity mark"
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#10A37F" height="32" rx="8" width="32" x="0" y="0" />
      <g transform="translate(6, 6)">
        <svg height="20" viewBox="0 0 24 24" width="20" fill="#FFFFFF">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7917.7917 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.535-3.0137l.142.0852 4.783 2.7582a.7917.7917 0 0 0 .7854 0l5.833-3.368v2.3325a.0804.0804 0 0 1-.0332.0615l-4.8351 2.7913a4.4944 4.4944 0 0 1-6.1401-1.647zm-1.3582-10.4633a4.4755 4.4755 0 0 1 2.3414-2.2043l-.0047.1656v5.5163a.787.787 0 0 0 .3927.6813l5.833 3.368-2.02 1.1685a.0757.0757 0 0 1-.071 0l-4.8304-2.7914a4.504 4.504 0 0 1-1.641-5.904zm16.5963 3.8552l-5.833-3.368 2.02-1.1686a.0757.0757 0 0 1 .071 0l4.8304 2.7914a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.7917.7917 0 0 0-.4119-.6818zm2.0107-3.0231a4.4708 4.4708 0 0 1 .535 3.0137l-.142-.0852-4.783-2.7582a.7917.7917 0 0 0-.7854 0l-5.833 3.368v-2.3325a.0804.0804 0 0 1 .0332-.0615l4.8351-2.7913a4.4944 4.4944 0 0 1 6.1401 1.647zm-9.5376-7.857a4.4755 4.4755 0 0 1 2.8764 1.0408l-.1419.0804-4.7783 2.7582a.7917.7917 0 0 0-.3927.6813v6.7369l-2.02-1.1686a.071.071 0 0 1-.038-.052v-5.5826a4.504 4.504 0 0 1 4.4945-4.4944zm-2.006 8.5204l2.9145-1.682 2.9145 1.682v3.364l-2.9145 1.682-2.9145-1.682z" />
        </svg>
      </g>
    </svg>
  );
}

export function AntigravityMark(): JSX.Element {
  return (
    <svg
      aria-label="antigravity identity mark"
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="antigravity-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1A73E8" />
          <stop offset="100%" stopColor="#4285F4" />
        </linearGradient>
      </defs>
      <rect fill="url(#antigravity-bg)" height="32" rx="8" width="32" x="0" y="0" />
      <g transform="translate(6, 6)">
        {/* Google Gemini / Antigravity 4-point Sparkle Star */}
        <path
          d="M10 0C10 5.52285 5.52285 10 0 10C5.52285 10 10 14.4771 10 20C10 14.4771 14.4771 10 20 10C14.4771 10 10 5.52285 10 0Z"
          fill="#FFFFFF"
        />
        <path
          d="M16 1C16 2.65685 14.6569 4 13 4C14.6569 4 16 5.34315 16 7C16 5.34315 17.3431 4 19 4C17.3431 4 16 2.65685 16 1Z"
          fill="#AECBFA"
        />
      </g>
    </svg>
  );
}

export function PiAgentMark(): JSX.Element {
  return (
    <svg
      aria-label="pi-agent identity mark"
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#7C3AED" height="32" rx="8" width="32" x="0" y="0" />
      <g transform="translate(6, 6)">
        {/* Inflection Pi Agent Official Geometric Pi Emblem */}
        <svg height="20" viewBox="0 0 24 24" width="20" fill="none">
          <path
            d="M4 6.5C4 5.67157 4.67157 5 5.5 5H18.5C19.3284 5 20 5.67157 20 6.5C20 7.32843 19.3284 8 18.5 8H17V17.5C17 18.3284 17.6716 19 18.5 19H19V21H16.5C14.567 21 13 19.433 13 17.5V8H11V16.5C11 18.9853 8.98528 21 6.5 21H5V19H6.5C7.88071 19 9 17.8807 9 16.5V8H5.5C4.67157 8 4 7.32843 4 6.5Z"
            fill="#FFFFFF"
          />
        </svg>
      </g>
    </svg>
  );
}

export function OpenCodeMark(): JSX.Element {
  return (
    <svg
      aria-label="opencode identity mark"
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#18181B" height="32" rx="8" width="32" x="0" y="0" />
      <g transform="translate(6, 6)">
        <svg height="20" viewBox="0 0 24 24" width="20" fill="none">
          {/* Official OpenCode.ai Terminal Agent Emblem */}
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#27272A" stroke="#3F3F46" strokeWidth="1.5" />
          <rect x="6" y="6" width="12" height="12" rx="1.5" fill="#FAFAFA" />
          <rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="#18181B" />
        </svg>
      </g>
    </svg>
  );
}

export function CursorMark(): JSX.Element {
  return (
    <svg
      aria-label="cursor identity mark"
      fill="none"
      height="32"
      role="img"
      viewBox="0 0 32 32"
      width="32"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#09090B" height="32" rx="8" width="32" x="0" y="0" />
      <g transform="translate(5, 5)">
        <svg height="22" viewBox="0 0 24 24" width="22" fill="none">
          {/* Official Cursor 3D Isometric Triangular Prism Emblem (cursor.com) */}
          <path d="M12 2L2 7.8L12 13.6L22 7.8L12 2Z" fill="#F4F4F5" />
          <path d="M2 7.8V16.2L12 22V13.6L2 7.8Z" fill="#A1A1AA" />
          <path d="M22 7.8V16.2L12 22V13.6L22 7.8Z" fill="#71717A" />
          {/* Inner Light Bevel Lines */}
          <path d="M12 2L12 13.6" stroke="#FFFFFF" strokeOpacity="0.4" strokeWidth="0.8" />
          <path d="M2 7.8L12 13.6" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="0.8" />
          <path d="M22 7.8L12 13.6" stroke="#FFFFFF" strokeOpacity="0.3" strokeWidth="0.8" />
        </svg>
      </g>
    </svg>
  );
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
      <span style={{ transform: "scale(0.5625)", transformOrigin: "center center", display: "inline-flex" }}>
        <AgentIdentityMark agentId={agentId} />
      </span>
    </span>
  );
}

export function AgentIdentityMark({ agentId }: { agentId: string }): JSX.Element {
  if (agentId.toLowerCase().includes("claude")) {
    return <ClaudeCodeMark />;
  }
  if (agentId.toLowerCase().includes("codex")) {
    return <CodexMark />;
  }
  if (agentId.toLowerCase().includes("antigravity")) {
    return <AntigravityMark />;
  }
  if (agentId.toLowerCase().includes("pi")) {
    return <PiAgentMark />;
  }
  if (agentId.toLowerCase().includes("opencode") || agentId.toLowerCase().includes("open-code")) {
    return <OpenCodeMark />;
  }
  if (agentId.toLowerCase().includes("cursor")) {
    return <CursorMark />;
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
