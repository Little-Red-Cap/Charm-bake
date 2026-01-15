import { create } from "zustand";
import type { Language } from "../domain/i18n";

export type ThemeMode = "light" | "dark";

interface UiState {
    theme: ThemeMode;
    language: Language;
    setTheme: (theme: ThemeMode) => void;
    setLanguage: (language: Language) => void;
}

const STORAGE_KEY = "charmbake-ui";

const readStorage = (): Pick<UiState, "theme" | "language"> => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { theme: "light", language: "zh" };
        const parsed = JSON.parse(raw);
        const theme = parsed?.theme === "dark" ? "dark" : "light";
        const language = parsed?.language === "en" ? "en" : "zh";
        return { theme, language };
    } catch {
        return { theme: "light", language: "zh" };
    }
};

const writeStorage = (state: Pick<UiState, "theme" | "language">) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // ignore
    }
};

const initial = readStorage();

export const useUiStore = create<UiState>((set, get) => ({
    theme: initial.theme,
    language: initial.language,

    setTheme: (theme) => {
        set({ theme });
        writeStorage({ theme, language: get().language });
    },
    setLanguage: (language) => {
        set({ language });
        writeStorage({ theme: get().theme, language });
    },
}));
