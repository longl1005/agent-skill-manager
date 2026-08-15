import { useState } from "react";
import { exitApp, hideMainWindow } from "../ipc/commands";
import { t } from "../locales/dict";
import { useGeneralSettingsStore } from "../stores/generalSettingsStore";
import { useI18nStore } from "../stores/i18nStore";

export function CloseActionModal() {
  const lang = useI18nStore((state) => state.lang);
  const isCloseConfirmOpen = useGeneralSettingsStore((state) => state.isCloseConfirmOpen);
  const closeCloseConfirm = useGeneralSettingsStore((state) => state.closeCloseConfirm);
  const setCloseAction = useGeneralSettingsStore((state) => state.setCloseAction);

  const [selectedAction, setSelectedAction] = useState<"minimize" | "quit">("minimize");
  const [rememberChoice, setRememberChoice] = useState(false);

  if (!isCloseConfirmOpen) return null;

  const handleConfirm = async () => {
    if (rememberChoice) {
      setCloseAction(selectedAction);
    }
    closeCloseConfirm();

    if (selectedAction === "minimize") {
      await hideMainWindow();
    } else {
      await exitApp();
    }
  };

  return (
    <div className="modal-overlay" role="presentation">
      <section
        className="delete-confirm-card close-action-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-action-dialog-title"
      >
        <div className="delete-confirm-header">
          <div>
            <h3 id="close-action-dialog-title">{t("settings.closeModal.title", lang)}</h3>
            <p>{t("settings.closeModal.desc", lang)}</p>
          </div>
        </div>

        <div className="delete-confirm-body close-action-modal__body">
          <label className={`close-action-option ${selectedAction === "minimize" ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="close-action"
              value="minimize"
              checked={selectedAction === "minimize"}
              onChange={() => setSelectedAction("minimize")}
            />
            <div className="close-action-option__text">
              <strong>{t("settings.closeModal.minimizeTitle", lang)}</strong>
              <small>{t("settings.closeModal.minimizeDesc", lang)}</small>
            </div>
          </label>

          <label className={`close-action-option ${selectedAction === "quit" ? "is-selected" : ""}`}>
            <input
              type="radio"
              name="close-action"
              value="quit"
              checked={selectedAction === "quit"}
              onChange={() => setSelectedAction("quit")}
            />
            <div className="close-action-option__text">
              <strong>{t("settings.closeModal.quitTitle", lang)}</strong>
              <small>{t("settings.closeModal.quitDesc", lang)}</small>
            </div>
          </label>

          <label className="close-action-remember">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(event) => setRememberChoice(event.target.checked)}
            />
            <span>{t("settings.closeModal.remember", lang)}</span>
          </label>
        </div>

        <div className="delete-confirm-footer">
          <button type="button" className="btn secondary" onClick={closeCloseConfirm}>
            {t("settings.closeModal.cancel", lang)}
          </button>
          <button type="button" className="btn primary" onClick={() => void handleConfirm()}>
            {t("settings.closeModal.confirm", lang)}
          </button>
        </div>
      </section>
    </div>
  );
}
