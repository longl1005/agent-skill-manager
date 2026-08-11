import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { AgentIdentityMark, AgentStatus } from "../components/AgentVisual";
import { t } from "../locales/dict";
import type { ImportMode } from "../ipc/types";
import { useI18nStore } from "../stores/i18nStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";
import { openSkillDirectory } from "../ipc/commands";

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

type SkillSort = "recent" | "name";

function rootLabel(rootId: string, lang: "zh" | "en") {
  const labels = {
    "config-skills": ["配置技能目录", "Configuration skills"],
    "builtin-skills": ["内置技能目录", "Builtin skills"],
    "global-skills": ["全局技能目录", "Global skills"],
    "custom-skills": ["自定义技能目录", "Custom skills"],
    "marketplace-skills": ["市场技能目录", "Marketplace skills"],
  } as const;
  return labels[rootId as keyof typeof labels]?.[lang === "zh" ? 0 : 1] ?? (lang === "zh" ? "主技能目录" : "Primary skills");
}

export default function AgentDetail() {
  const { agentId } = useParams();
  const { report, error, scanning, scan } = useScanStore();
  const lang = useI18nStore((state) => state.lang);
  const masterSkills = useMasterRepoStore((state) => state.skills);
  const fetchMasterSkills = useMasterRepoStore((state) => state.fetchMasterSkills);
  const importToMaster = useMasterRepoStore((state) => state.importToMaster);
  const replaceAgentLocalSkillWithSymlink = useMasterRepoStore((state) => state.replaceAgentLocalSkillWithSymlink);
  const deleteAgentSkill = useMasterRepoStore((state) => state.deleteAgentSkill);

  const [importingSkill, setImportingSkill] = useState<string | null>(null);
  const [conflictData, setConflictData] = useState<{
    skillName: string;
    existingFp: string;
    incomingFp: string;
  } | null>(null);
  const [renameInput, setRenameInput] = useState<string>("");
  const [externalImportConfirm, setExternalImportConfirm] = useState<string | null>(null);
  const [unlinkConfirm, setUnlinkConfirm] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [skillSort, setSkillSort] = useState<SkillSort>("recent");

  useEffect(() => {
    void fetchMasterSkills();
  }, [fetchMasterSkills]);

  const agent = report?.agents.find((item) => item.agent_id === agentId);
  const unreadableSkillIssues = agent?.issues.filter((issue) => issue.code === "NOT_UTF8") ?? [];
  const otherIssues = agent?.issues.filter((issue) => issue.code !== "NOT_UTF8") ?? [];
  const sortedSkills = useMemo(() => {
    const skills = agent?.skills ?? [];
    return [...skills].sort((a, b) => {
      if (skillSort === "name") return a.name.localeCompare(b.name);
      return (b.modified_at ?? 0) - (a.modified_at ?? 0) || a.name.localeCompare(b.name);
    });
  }, [agent?.skills, skillSort]);

  const importSkill = async (skillName: string) => {
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
  const handleRefresh = async () => {
    if (scanning) return;
    await scan();
    await fetchMasterSkills();
  };
  const handleUnlink = async () => { if (!agent || !unlinkConfirm) return; setUnlinking(true); try { await deleteAgentSkill(agent.agent_id, unlinkConfirm); } finally { setUnlinking(false); setUnlinkConfirm(null); } };
  const handleReplace = async () => { if (!agent || !replaceConfirm) return; setReplacing(true); try { await replaceAgentLocalSkillWithSymlink(agent.agent_id, replaceConfirm); } finally { setReplacing(false); setReplaceConfirm(null); } };

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
          {agent.roots.length <= 1 ? (
            <code className="agent-detail__root agent-detail__root--truncate" title={primaryRoot}>{primaryRoot}</code>
          ) : (
            <div className="agent-detail__roots" aria-label={lang === "zh" ? "已扫描目录" : "Scanned directories"}>
              <span className="agent-detail__roots-label">{lang === "zh" ? `已扫描 ${agent.roots.length} 个目录` : `${agent.roots.length} scanned directories`}</span>
              {agent.roots.map((root) => <button key={root.root_id} type="button" className="agent-detail__root-button" title={root.display_path} onClick={() => void openSkillDirectory(root.display_path)}>{rootLabel(root.root_id, lang)} · <code>{root.display_path}</code></button>)}
            </div>
          )}
          <StatusWithDot status={agent.detection_status} />
        </div>
        <button
          className="btn console-scan-button agent-detail__refresh-button"
          disabled={scanning}
          onClick={() => void handleRefresh()}
          type="button"
        >
          {scanning ? t("agentDetail.refreshing", lang) : t("agentDetail.refresh", lang)}
        </button>
      </header>

      {agent.issues.length > 0 && (
        <div className="agent-scan-error" role="alert">
          {unreadableSkillIssues.length > 0 && (
            <>
              <strong>{lang === "zh" ? `有 ${unreadableSkillIssues.length} 个技能文件无法读取，已跳过，不影响其他技能。` : `${unreadableSkillIssues.length} skill file${unreadableSkillIssues.length === 1 ? "" : "s"} could not be read and ${unreadableSkillIssues.length === 1 ? "was" : "were"} skipped. Other skills are unaffected.`}</strong>
              <p style={{ margin: "8px 0 0" }}>{lang === "zh" ? "原因：SKILL.md 不是 UTF-8 编码。" : "Reason: SKILL.md is not UTF-8 encoded."}</p>
              <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                {unreadableSkillIssues.map((issue, idx) => <li key={`${issue.path}-${idx}`} style={{ marginTop: 4 }}>{lang === "zh" ? "路径：" : "Path: "}<code>{issue.path ?? "SKILL.md"}</code></li>)}
              </ul>
              <details style={{ marginTop: 8 }}>
                <summary>{lang === "zh" ? "查看技术详情" : "View technical details"}</summary>
                <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                  {unreadableSkillIssues.map((issue, idx) => <li key={`${issue.code}-${idx}`}>[{issue.severity}] {issue.code}: {issue.message}</li>)}
                </ul>
              </details>
            </>
          )}
          {otherIssues.length > 0 && (
            <>
              {unreadableSkillIssues.length > 0 && <hr />}
              <strong>Diagnostics ({otherIssues.length}):</strong>
              <ul style={{ margin: "8px 0 0 16px", padding: 0 }}>
                {otherIssues.map((issue, idx) => (
              <li key={idx} style={{ marginTop: 4 }}>
                [{issue.severity}] {issue.code}: {issue.message}
              </li>
            ))}
              </ul>
            </>
          )}
        </div>
      )}

      <section aria-labelledby="installed-skills-heading" className="agent-detail__skills">
        <div className="agent-detail__skills-header">
          <h2 id="installed-skills-heading">{t("agentDetail.installedSkills", lang)} ({agent.skills.length})</h2>
          <div className="status-filter-group skill-sort-group" role="group" aria-label={lang === "zh" ? "技能排序" : "Skill sort"}>
            <button
              className={`filter-btn ${skillSort === "recent" ? "is-active" : ""}`}
              onClick={() => setSkillSort("recent")}
              type="button"
            >
              {t("skillLibrary.sortRecent", lang)}
            </button>
            <button
              className={`filter-btn ${skillSort === "name" ? "is-active" : ""}`}
              onClick={() => setSkillSort("name")}
              type="button"
            >
              {t("skillLibrary.sortName", lang)}
            </button>
          </div>
        </div>
        {agent.skills.length > 0 ? (
          <ul className="agent-detail__skill-grid">
            {sortedSkills.map((skill) => {
              const masterSkill = masterSkills.find((m) => m.name.toLowerCase() === skill.name.toLowerCase());
              const isSymlink = skill.is_symlink === true;
              const isMasterSymlink = Boolean(masterSkill && isSymlink && skill.symlink_target === masterSkill.path);
              const isLocalCopy = Boolean(masterSkill && !isSymlink);
              const isExternalSymlink = isSymlink && !isMasterSymlink;
              const isImporting = importingSkill === skill.name;

              return (
                <li key={skill.location + skill.name}>
                  <Link className="agent-detail__skill-card" to={`/agents/${agent.agent_id}/skills/${encodeURIComponent(skill.name)}`}>
                    <div className="agent-detail__skill-card-header">
                      <div className="agent-detail__skill-badge-icon">
                        <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 24 24" width="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                        </svg>
                      </div>
                      <h3 className="agent-detail__skill-name" title={skill.name}>{skill.name}</h3>
                      <button type="button" className="agent-detail__skill-unlink-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setUnlinkConfirm(skill.name); }} aria-label={`Remove ${skill.name} from ${agent.display_name}`} title="Remove from this Agent"><svg aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg></button>
                    </div>
                    <p className="agent-detail__skill-description" title={skill.description || t("agentDetail.noDescription", lang)}>
                      {skill.description || t("agentDetail.noDescription", lang)}
                    </p>
                    <div className="agent-detail__skill-card-footer">
                      <span className="agent-detail__file-count">
                        <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 24 24" width="12" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                          <polyline points="13 2 13 9 20 9" />
                        </svg>
                        {t("agentDetail.fileCount", lang).replace("{count}", String(skill.file_count))}
                      </span>

                      {isMasterSymlink ? (
                        <span className="agent-detail__skill-managed-badge">{t("skillCard.masterSymlink", lang)}</span>
                      ) : isLocalCopy ? (
                        <span className="agent-detail__skill-source-actions">
                          <span className="agent-detail__skill-local-copy-badge">{t("skillCard.localCopy", lang)}</span>
                          <button type="button" className="agent-detail__skill-upload-btn" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReplaceConfirm(skill.name); }}>
                            {t("skillCard.replaceSymlink", lang)}
                          </button>
                        </span>
                      ) : isExternalSymlink ? (
                        <span className="agent-detail__skill-source-actions">
                          <span className="agent-detail__skill-external-link-badge">{t("skillCard.externalSymlink", lang)}</span>
                          <button
                            type="button"
                            className="agent-detail__skill-external-import-btn--compact"
                            disabled={isImporting}
                            aria-label={t("skillCard.upload", lang)}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExternalImportConfirm(skill.name); }}
                          >
                            {isImporting ? t("skillCard.uploading", lang) : lang === "zh" ? "导入" : "Import"}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="agent-detail__skill-upload-btn"
                          disabled={isImporting}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); void importSkill(skill.name); }}
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
      {externalImportConfirm && (
        <div className="modal-overlay" onClick={() => setExternalImportConfirm(null)}>
          <div className="delete-confirm-card" onClick={(event) => event.stopPropagation()}>
            <div className="delete-confirm-header">
              <div>
                <h3>{lang === "zh" ? "导入外部软链接 Skill" : "Import external symlink"}</h3>
                <p><code>{externalImportConfirm}</code></p>
              </div>
            </div>
            <div className="delete-confirm-body">
              <p>{lang === "zh" ? "将把外部目标的 Skill 复制到主技能库，并把当前 Agent 的软链接改为指向主技能库。外部目标不会被删除或修改。" : "The external target will not be deleted or modified. Its Skill will be copied into the master library, then this Agent's symlink will point to the master copy."}</p>
            </div>
            <div className="delete-confirm-footer">
              <button type="button" className="btn secondary" onClick={() => setExternalImportConfirm(null)}>{lang === "zh" ? "取消" : "Cancel"}</button>
              <button type="button" className="btn" onClick={() => { const skillName = externalImportConfirm; setExternalImportConfirm(null); void importSkill(skillName); }}>{lang === "zh" ? "确认导入" : "Import to Master"}</button>
            </div>
          </div>
        </div>
      )}
      {unlinkConfirm && <div className="modal-overlay" onClick={() => !unlinking && setUnlinkConfirm(null)}><div className="delete-confirm-card" onClick={(event) => event.stopPropagation()}><div className="delete-confirm-header"><div><h3>从当前 Agent 删除 Skill</h3><p><code>{unlinkConfirm}</code></p></div></div><div className="delete-confirm-body"><p>这会删除当前 Agent 中的该技能目录或软链接。若为外部软链接，只会删除链接本身，不会删除外部目标；主技能仓库和其他 Agent 不受影响。</p></div><div className="delete-confirm-footer"><button type="button" className="btn secondary" onClick={() => setUnlinkConfirm(null)}>取消</button><button type="button" className="btn danger" disabled={unlinking} onClick={() => void handleUnlink()}>{unlinking ? "删除中" : "确认删除"}</button></div></div></div>}
      {replaceConfirm && <div className="modal-overlay" onClick={() => !replacing && setReplaceConfirm(null)}><div className="delete-confirm-card" onClick={(event) => event.stopPropagation()}><div className="delete-confirm-header"><div><h3>替换为软链接</h3><p><code>{replaceConfirm}</code></p></div></div><div className="delete-confirm-body"><p>这会永久删除当前 Agent 目录中的本地副本，并替换为指向主技能库的软链接。主技能库和其他 Agent 不受影响。</p></div><div className="delete-confirm-footer"><button type="button" className="btn secondary" disabled={replacing} onClick={() => setReplaceConfirm(null)}>取消</button><button type="button" className="btn danger" disabled={replacing} onClick={() => void handleReplace()}>{replacing ? t("skillCard.replacingSymlink", lang) : t("skillCard.replaceSymlink", lang)}</button></div></div></div>}
    </section>
  );
}
