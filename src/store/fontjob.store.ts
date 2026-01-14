import { create } from "zustand";
import type { FontGenerateResult, FontJobConfig, FontJobState } from "../domain/types";
import { DEFAULT_CONFIG, defaultExportName, defaultModuleName, defaultSaveFileName } from "../domain/presets";
import { validateConfig } from "../domain/validate";
import { generateFont } from "../services/generator/generator";

function suggestNames(cfg: FontJobConfig) {
    const base = cfg.fontSourceMode === "system"
        ? (cfg.systemFontName || "font")
        : (cfg.fontFilePath?.split(/[\\/]/).pop()?.replace(/\.(ttf|otf)$/i, "") || "font");

    const moduleName = defaultModuleName(base, cfg.sizePx);
    const exportName = defaultExportName(base, cfg.sizePx);
    return { moduleName, exportName };
}

interface FontJobActions {
    setConfig: (patch: Partial<FontJobConfig>) => void;
    applySuggestedNames: () => void;
    generate: () => Promise<void>;
    setResult: (r: FontGenerateResult | null) => void;
    setError: (msg: string | null) => void;
}

export const useFontJobStore = create<FontJobState & FontJobActions>((set, get) => ({
    config: DEFAULT_CONFIG,
    status: "idle",
    result: null,
    error: null,

    setConfig: (patch) => {
        const next = { ...get().config, ...patch };

        // 自动联动保存文件名（不覆盖用户手动改过的场景：这里先简单联动，后续可加“用户已手动编辑”的标记）
        if (patch.moduleName || patch.outputKind) {
            next.saveFileName = defaultSaveFileName(next.moduleName, next.outputKind);
        }

        set({ config: next });
    },

    applySuggestedNames: () => {
        const cfg = get().config;
        const { moduleName, exportName } = suggestNames(cfg);
        const saveFileName = defaultSaveFileName(moduleName, cfg.outputKind);
        set({ config: { ...cfg, moduleName, exportName, saveFileName } });
    },

    setResult: (r) => set({ result: r }),
    setError: (msg) => set({ error: msg }),

    generate: async () => {
        const cfg = get().config;
        const errs = validateConfig(cfg);
        if (errs.length) {
            set({ status: "error", error: errs.join("\n") });
            return;
        }

        set({ status: "generating", error: null });
        try {
            const result = await generateFont(cfg);
            set({ status: "success", result, error: null });
        } catch (e: any) {
            set({ status: "error", error: e?.message || String(e) });
        }
    },
}));
