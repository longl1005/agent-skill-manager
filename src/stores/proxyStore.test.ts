import { beforeEach, describe, expect, it, vi } from "vitest";

const { getNetworkProxyMock, setNetworkProxyMock } = vi.hoisted(() => ({
  getNetworkProxyMock: vi.fn(),
  setNetworkProxyMock: vi.fn(),
}));

vi.mock("../ipc/commands", () => ({
  getNetworkProxy: getNetworkProxyMock,
  setNetworkProxy: setNetworkProxyMock,
}));

import { useProxyStore } from "./proxyStore";

describe("proxyStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProxyStore.setState({
      proxy: "",
      loading: false,
      saving: false,
      error: null,
    });
  });

  it("fetches network proxy configuration from backend", async () => {
    getNetworkProxyMock.mockResolvedValueOnce("http://127.0.0.1:7890");

    await useProxyStore.getState().fetchProxy();

    expect(getNetworkProxyMock).toHaveBeenCalled();
    expect(useProxyStore.getState().proxy).toBe("http://127.0.0.1:7890");
    expect(useProxyStore.getState().loading).toBe(false);
  });

  it("handles null when no proxy is configured", async () => {
    getNetworkProxyMock.mockResolvedValueOnce(null);

    await useProxyStore.getState().fetchProxy();

    expect(useProxyStore.getState().proxy).toBe("");
  });

  it("saves trimmed proxy to backend", async () => {
    setNetworkProxyMock.mockResolvedValueOnce(undefined);

    await useProxyStore.getState().saveProxy("  http://127.0.0.1:7890  ");

    expect(setNetworkProxyMock).toHaveBeenCalledWith("http://127.0.0.1:7890");
    expect(useProxyStore.getState().proxy).toBe("http://127.0.0.1:7890");
    expect(useProxyStore.getState().saving).toBe(false);
  });

  it("passes null when saving an empty proxy string", async () => {
    setNetworkProxyMock.mockResolvedValueOnce(undefined);

    await useProxyStore.getState().saveProxy("   ");

    expect(setNetworkProxyMock).toHaveBeenCalledWith(null);
    expect(useProxyStore.getState().proxy).toBe("");
  });
});
