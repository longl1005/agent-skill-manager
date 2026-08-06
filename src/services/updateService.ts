import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type AvailableUpdate = {
  version: string;
  notes: string;
  date: string;
  native: Update;
};

export type UpdateProgress = {
  phase: "downloading" | "installing";
  downloaded: number;
  total: number | null;
};

export async function findAvailableUpdate(): Promise<AvailableUpdate | null> {
  const update = await check();
  if (!update) return null;

  return {
    version: update.version,
    notes: update.body ?? "",
    date: update.date ?? "",
    native: update,
  };
}

export async function installAvailableUpdate(
  update: AvailableUpdate,
  onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
  let downloaded = 0;
  let total: number | null = null;

  await update.native.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
      onProgress({ phase: "downloading", downloaded, total });
      return;
    }
    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress({ phase: "downloading", downloaded, total });
      return;
    }
    onProgress({ phase: "installing", downloaded, total });
  });

  await relaunch();
}
