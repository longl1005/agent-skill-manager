import { describe, expect, it, beforeEach } from "vitest";
import { useI18nStore } from "./i18nStore";
import { t } from "../locales/dict";

describe("i18nStore & dict", () => {
  beforeEach(() => {
    useI18nStore.getState().setLanguage("zh");
  });

  it("defaults to zh language", () => {
    expect(useI18nStore.getState().lang).toBe("zh");
    expect(t("settings.title", "zh")).toBe("设置");
  });

  it("switches language to en and translates correctly", () => {
    useI18nStore.getState().setLanguage("en");
    expect(useI18nStore.getState().lang).toBe("en");
    expect(t("settings.title", "en")).toBe("Settings");
  });
});
