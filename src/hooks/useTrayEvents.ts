import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useNavigate } from "react-router-dom";
import { exitApp, hideMainWindow, setTrayLanguage, setTrayStatistics } from "../ipc/commands";
import { isDiscoveredAgent } from "../agentDiscovery";
import { useAgentConfigStore } from "../stores/agentConfigStore";
import { useGeneralSettingsStore } from "../stores/generalSettingsStore";
import { useI18nStore } from "../stores/i18nStore";
import { useMasterRepoStore } from "../stores/masterRepoStore";
import { useScanStore } from "../stores/scanStore";

export function TrayEventBridge(): null {
  const navigate = useNavigate();
  const lang = useI18nStore((state) => state.lang);
  const masterSkills = useMasterRepoStore((state) => state.skills);
  const report = useScanStore((state) => state.report);
  const disabledAgentIds = useAgentConfigStore((state) => state.disabledAgentIds);
  const connectedAgentCount = report?.agents.filter(
    (agent) => isDiscoveredAgent(agent) && !disabledAgentIds.includes(agent.agent_id)
  ).length ?? 0;

  useEffect(() => {
    const registerListener = (eventName: string, handler: () => void) => {
      let disposed = false;
      let unlisten: (() => void) | undefined;

      void listen(eventName, () => {
        if (!disposed) handler();
      })
        .then((stop) => {
          if (disposed) {
            stop();
          } else {
            unlisten = stop;
          }
        })
        .catch((error: unknown) => {
          console.error(`[tray] Failed to register ${eventName} listener`, error);
        });

      return () => {
        disposed = true;
        unlisten?.();
        unlisten = undefined;
      };
    };

    const stopOpenLibrary = registerListener("tray:open-library", () => navigate("/library"));
    const stopCloseRequested = registerListener("window:close-requested", () => {
      const closeAction = useGeneralSettingsStore.getState().closeAction;
      if (closeAction === "minimize") {
        void hideMainWindow();
      } else if (closeAction === "quit") {
        void exitApp();
      } else {
        useGeneralSettingsStore.getState().openCloseConfirm();
      }
    });

    return () => {
      stopOpenLibrary();
      stopCloseRequested();
    };
  }, [navigate]);

  useEffect(() => {
    void setTrayLanguage(lang).catch((error: unknown) => {
      console.error("[tray] Failed to synchronize tray language", error);
    });
  }, [lang]);

  useEffect(() => {
    void setTrayStatistics(lang, masterSkills.length, connectedAgentCount).catch((error: unknown) => {
      console.error("[tray] Failed to synchronize tray statistics", error);
    });
  }, [connectedAgentCount, lang, masterSkills.length]);

  return null;
}
