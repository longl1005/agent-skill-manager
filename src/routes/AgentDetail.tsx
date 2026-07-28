import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AgentIdentityMark, AgentStatus } from "../components/AgentVisual";
import { t } from "../locales/dict";
import type { ImportMode } from "../ipc/types";
import { useI18nStore } from "../stores/i18nStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";

import { translateSkill } from "../utils/skillTranslator";

function BreadcrumbSeparator() {
  return (
    <svg aria-hidden="true" className="agent-detail__breadcrumb-separator" fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
      <path d="m6 3 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  );
}

function StatusWithDot({ status }: { status: string }) {
  return (
    <span className="agent-detail__status">
      <svg aria-hidden="true" className="agent-detail__status-dot" fill="currentColor" height="8" viewBox="0 0 8 8" width="8" xmlns="http://www.w3.org/2000/svg">
        <circle cx="4" cy="4" r="3" />
      </svg>
      <AgentStatus status={status} />
    </span>
  );
}

export default function AgentDetail() {
  const { agentId } = useParams();
  const { report, error, scanning, scan } = useScanStore();
  const lang = useI18nStore((state) => state.lang);
  const masterSkills = useMasterRepoStore((state) => state.skills);
  const fetchMasterSkills = useMasterRepoStore((state) => state.fetchMasterSkills);
  const importToMaster = useMasterRepoStore((state) => state.importToMaster);

  const [importingSkill, setImportingSkill] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<{
    skillName: string;
    existingFp: string;
    incomingFp: string;
  } | null>(null);
  const [renameInput, setRenameInput] = useState<string>("");

  useEffect(() => {
    void fetchMasterSkills();
  }, [fetchMasterSkills]);

  const agent = report?.agents.find((item) => item.agent_id === agentId);

  const handleImport = async (e: React.MouseEvent, skillName: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!agent) return;
    setImportingSkill(skillName);
    try {
      const res = await importToMaster(agent.agent_id, skillName);
      if (res.type === "conflict") {
        setConflictData({
          skillName: res.skill_name,
          existingFp: res.existing_fingerprint,
          incomingFp: res.incoming_fingerprint,
        });
        setRenameInput(`${res.skill_name}-${agent.agent_id}`);
      }
    } finally {
      setImportingSkill(null);
    }
  };

  const handleResolveConflict = async (mode: ImportMode) => {
    if (!agent || !conflictData) return;
    const skillName = conflictData.skillName;
    setConflictData(null);
    setImportingSkill(skillName);
    try {
      await importToMaster(agent.agent_id, skillName, mode);
    } finally {
      setImportingSkill(null);
    }
  };

  if (!agent) {
    return (
      <section className="page agent-detail agent-detail--missing">
        {error ? (
          <>
            <div className="agent-scan-error" role="alert">
              <strong>Latest scan failed.</strong> The agent directory may be incomplete.
              <p className="agent-scan-error__detail">{error}</p>
            </div>
            <h1>Agent unavailable</h1>
            <p>Try scanning again to restore the agent directory.</p>
          </>
        ) : (
          <>
            <h1>Agent not found</h1>
            <p>The requested agent is not available in this scan.</p>
          </>
        )}
        <div className="agent-detail__recovery-actions">
          <Link className="agent-detail-recovery agent-detail__recovery-link" to="/agents">All Agents</Link>
          {error && (
            <button className="agent-scan-recovery-button" disabled={scanning} onClick={() => void scan()} type="button">
              Rescan agents
            </button>
          )}
        </div>
      </section>
    );
  }

  const primaryRoot = agent.roots[0]?.display_path ?? "No skill root detected";

  return (
    <section className="page agent-detail">
      <nav aria-label="Breadcrumb" className="agent-breadcrumb agent-detail__breadcrumb">
        <Link to="/agents">{t("nav.discoveredAgents", lang)}</Link>
        <BreadcrumbSeparator />
        <span aria-current="page">{agent.display_name}</span>
      </nav>

      {error && (
        <div className="agent-scan-error" role="alert">
          <strong>Latest scan failed.</strong> You can continue viewing this previously loaded agent workspace.
          <p className="agent-scan-error__detail">{error}</p>
        </div>
      )}

      <header className="agent-detail__header">
        <AgentIdentityMark agentId={agent.agent_id} />
        <div className="agent-detail__identity">
          <h1>{agent.display_name}</h1>
          <code className="agent-detail__root agent-detail__root--truncate" title={primaryRoot}>{primaryRoot}</code>
          <StatusWithDot status={agent.detection_status} />
        </div>
      </header>

      {agent.issues.length > 0 && (
        <div className="agent-scan-error" role="alert">
          <strong>Diagnostics ({agent.issues.length}):</strong>
          <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
            {agent.issues.map((issue, idx) => (
              <li key={idx} style={{ marginTop: 4 }}>
                [{issue.severity}] {issue.code}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="installed-skills-heading" className="agent-detail__skills">
        <h2 id="installed-skills-heading">{t("agentDetail.installedSkills", lang)} ({agent.skills.length})</h2>
        {agent.skills.length > 0 ? (
          <ul className="agent-detail__skill-grid">
            {agent.skills.map((skill) => {
              const masterSkill = masterSkills.find((m) => m.name.toLowerCase() === skill.name.toLowerCase());
              const isManaged = Boolean(masterSkill);
              const isImporting = importingSkill === skill.name;

              const tr = translateSkill(skill.name, skill.description || "", "");
              const titleZh = masterSkill?.name_zh || tr.titleZh;
              const displayTitle = lang === "zh" ? (titleZh || skill.name) : skill.name;
              const displayDesc = lang === "zh"
                ? (masterSkill?.description_zh || tr.descriptionZh || skill.description || t("agentDetail.noDescription", lang))
                : (skill.description || t("agentDetail.noDescription", lang));

              return (
                <li key={skill.location + skill.name}>
                  <Link className="agent-detail__skill-card" to={`/agents/${agent.agent_id}/skills/${encodeURIComponent(skill.name)}`}>
                    <div className="agent-detail__skill-card-header">
                      <div className="agent-detail__skill-badge-icon">
                        <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      </div>
                      <h3 className="agent-detail__skill-name" title={skill.name}>
                        {displayTitle}
                        {lang === "zh" && titleZh && titleZh !== skill.name && (
                          <span style={{ marginLeft: 6, opacity: 0.65, fontSize: "0.8em", fontWeight: "normal" }}>
                            ({skill.name})
                          </span>
                        )}
                      </h3>
                    </div>
                    <p className="agent-detail__skill-description" title={displayDesc}>
                      {displayDesc}
                    </p>
                    <div className="agent-detail__skill-card-footer">
                      <span className="agent-detail__file-count">
                        <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        {t("agentDetail.fileCount", lang).replace("{count}", String(skill.file_count))}
                      </span>

                      {isManaged ? (
                        <span className="agent-detail__skill-managed-badge">
                          {t("skillCard.managed", lang)}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="agent-detail__skill-upload-btn"
                          disabled={isImporting}
                          onClick={(e) => handleImport(e, skill.name)}
                          title="Import this skill to ~/.asm/skills"
                        >
                          <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          {isImporting ? t("skillCard.uploading", lang) : t("skillCard.upload", lang)}
                        </button>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="agent-detail__empty-skills">{t("agentDetail.emptySkills", lang)}</p>
        )}
      </section>

      {conflictData && (
        <div className="modal-overlay" onClick={() => setConflictData(null)}>
          <div className="conflict-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="conflict-modal-header">
              <span className="conflict-modal-icon">⚠️</span>
              <div>
                <h3>技能同名但内容冲突 / Conflict Detected</h3>
                <p>主技能库中已存在名为 <code>{conflictData.skillName}</code> 的技能，但内容与当前 Agent 中的版本不同。</p>
              </div>
            </div>

            <div className="conflict-hash-comparison">
              <div>
                <span className="hash-label">主库现有版本 Hash:</span>
                <code>{conflictData.existingFp.slice(0, 16) || "N/A"}</code>
              </div>
              <div>
                <span className="hash-label">当前 Agent 版本 Hash:</span>
                <code>{conflictData.incomingFp.slice(0, 16) || "N/A"}</code>
              </div>
            </div>

            <div className="conflict-resolution-options">
              <button
                type="button"
                className="conflict-option-btn conflict-option-btn--use-master"
                onClick={() => handleResolveConflict({ mode: "use_master" })}
              >
                <strong>关联至主库现有版本</strong>
                <span>丢弃当前 Agent 独立目录，替换为指向主库已有版本的软链接</span>
              </button>

              <button
                type="button"
                className="conflict-option-btn conflict-option-btn--overwrite"
                onClick={() => handleResolveConflict({ mode: "overwrite_master" })}
              >
                <strong>覆盖主库已有版本</strong>
                <span>使用当前 Agent 的技能内容覆盖主库中的版本</span>
              </button>

              <div className="conflict-option-rename-box">
                <strong>重命名另存为新技能</strong>
                <div className="rename-input-row">
                  <input
                    type="text"
                    className="conflict-rename-input"
                    value={renameInput}
                    onChange={(e) => setRenameInput(e.target.value)}
                    placeholder="输入新技能名称"
                  />
                  <button
                    type="button"
                    className="conflict-option-btn--rename"
                    disabled={!renameInput.trim()}
                    onClick={() =>
                      handleResolveConflict({
                        mode: "rename_new",
                        new_name: renameInput.trim(),
                      })
                    }
                  >
                    保存为新技能
                  </button>
                </div>
              </div>
            </div>

            <div className="conflict-modal-footer">
              <button type="button" className="conflict-cancel-btn" onClick={() => setConflictData(null)}>
                取消 / Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
