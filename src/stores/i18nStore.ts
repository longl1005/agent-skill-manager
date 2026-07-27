import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type Language } from "../locales/dict";

export interface I18nStore {
  lang: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      lang: "zh",
      setLanguage: (lang: Language) => set({ lang }),
    }),
    {
      name: "asm_app_language",
    }
  )
);
