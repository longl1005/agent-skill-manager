import { beforeEach, describe, expect, it, vi } from "vitest";
import { installAvailableUpdate, findAvailableUpdate } from "../services/updateService";
import { useUpdateStore } from "./updateStore";

vi.mock("../services/updateService", () => ({
  findAvailableUpdate: vi.fn(),
  installAvailableUpdate: vi.fn(),
}));

describe("updateStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdateStore.setState({ status: "idle", update: null, progress: null, error: null });
  });

  it("prevents duplicate update checks while one is running", async () => {
    let resolveCheck!: (value: { version: string; notes: string; date: string; native: never }) => void;
    vi.mocked(findAvailableUpdate).mockReturnValue(new Promise((resolve) => { resolveCheck = resolve; }));

    const firstCheck = useUpdateStore.getState().checkForUpdates(false);
    const secondCheck = useUpdateStore.getState().checkForUpdates(false);
    expect(findAvailableUpdate).toHaveBeenCalledTimes(1);

    resolveCheck({ version: "1.2.0", notes: "Fixes", date: "2026-08-06", native: undefined as never });
    await Promise.all([firstCheck, secondCheck]);

    expect(useUpdateStore.getState().status).toBe("available");
  });

  it("does not restart after an installation failure", async () => {
    useUpdateStore.setState({
      status: "available",
      update: { version: "1.2.0", notes: "Fixes", date: "2026-08-06", native: undefined as never },
    });
    vi.mocked(installAvailableUpdate).mockRejectedValue(new Error("offline"));

    await useUpdateStore.getState().installUpdate();

    expect(installAvailableUpdate).toHaveBeenCalledOnce();
    expect(useUpdateStore.getState().status).toBe("error");
    expect(useUpdateStore.getState().error).toBe("offline");
  });
});
