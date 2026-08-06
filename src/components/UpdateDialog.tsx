import { useI18nStore } from "../stores/i18nStore";
import { useUpdateStore } from "../stores/updateStore";
import { t } from "../locales/dict";

export function UpdateDialog() {
  const lang = useI18nStore((state) => state.lang);
  const { status, update, progress, error, dismissUpdate, installUpdate } = useUpdateStore();
  if (!update || !["available", "downloading", "installing", "error"].includes(status)) return null;

  const busy = status === "downloading" || status === "installing";
  const percentage = progress?.total ? Math.round((progress.downloaded / progress.total) * 100) : null;
  return (
    <div className="modal-overlay" role="presentation">
      <section className="delete-confirm-card update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-dialog-title">
        <div className="delete-confirm-header"><div><h3 id="update-dialog-title">{t("update.title", lang)}</h3><p>{t("update.available", lang).replace("{version}", update.version)}</p></div></div>
        <div className="delete-confirm-body">
          {update.notes && <p className="update-dialog__notes">{update.notes}</p>}
          {busy && <p>{percentage === null ? t("update.preparing", lang) : `${t("update.downloading", lang)} ${percentage}%`}</p>}
          {error && <p className="settings-agent-toggle-error">{t("update.failed", lang)}</p>}
        </div>
        <div className="delete-confirm-footer">
          {!busy && <button type="button" className="btn secondary" onClick={dismissUpdate}>{t("update.later", lang)}</button>}
          <button type="button" className="btn" onClick={() => void installUpdate()} disabled={busy}>{busy ? t("update.preparing", lang) : t("update.now", lang)}</button>
        </div>
      </section>
    </div>
  );
}
