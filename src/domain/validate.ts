import type { FontJobConfig } from "./types";
import { useUiStore } from "../store/ui.store";
import { t } from "./i18n";

export function isSingleChar(s: string): boolean {
    return typeof s === "string" && [...s].length === 1;
}

export function validateConfig(cfg: FontJobConfig): string[] {
    const errs: string[] = [];
    const language = useUiStore.getState().language;

    if (cfg.fontSourceMode === "system") {
        if (!cfg.systemFontName) errs.push(t(language, "validateSystemFont"));
    } else {
        if (!cfg.fontFilePath) errs.push(t(language, "validateFontFile"));
    }

    if (!isSingleChar(cfg.rangeStart) || !isSingleChar(cfg.rangeEnd)) {
        errs.push(t(language, "validateRangeSingle"));
    } else {
        const a = cfg.rangeStart.codePointAt(0)!;
        const b = cfg.rangeEnd.codePointAt(0)!;
        if (a > b) errs.push(t(language, "validateRangeOrder"));
    }

    if (!isSingleChar(cfg.fallbackChar)) errs.push(t(language, "validateFallbackSingle"));

    if (!cfg.sizePx || cfg.sizePx < 4 || cfg.sizePx > 128) errs.push(t(language, "validateSizeRange"));

    if (!cfg.moduleName.trim()) errs.push(t(language, "validateModuleName"));
    if (!cfg.exportName.trim()) errs.push(t(language, "validateExportName"));

    if (!cfg.saveFileName.trim()) errs.push(t(language, "validateSaveFileName"));

    if (cfg.threshold < 0 || cfg.threshold > 255) errs.push(t(language, "validateThresholdRange"));
    if (cfg.binarizeMode === "gamma_oversample") {
        if (cfg.gamma <= 0 || cfg.gamma > 5) errs.push(t(language, "validateGammaRange"));
        if (cfg.oversample < 1 || cfg.oversample > 4) errs.push(t(language, "validateOversampleRange"));
    }

    return errs;
}
