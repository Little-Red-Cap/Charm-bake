import type { FontJobConfig } from "./types";

export function isSingleChar(s: string): boolean {
    return typeof s === "string" && [...s].length === 1;
}

export function validateConfig(cfg: FontJobConfig): string[] {
    const errs: string[] = [];

    if (cfg.fontSourceMode === "system") {
        if (!cfg.systemFontName) errs.push("请选择系统字体。");
    } else {
        if (!cfg.fontFilePath) errs.push("请选择字体文件路径。");
    }

    if (!isSingleChar(cfg.rangeStart) || !isSingleChar(cfg.rangeEnd)) {
        errs.push("字符范围起止必须是单个字符。");
    } else {
        const a = cfg.rangeStart.codePointAt(0)!;
        const b = cfg.rangeEnd.codePointAt(0)!;
        if (a > b) errs.push("字符范围起始不能大于结束。");
    }

    if (!isSingleChar(cfg.fallbackChar)) errs.push("Fallback 字符必须是单个字符。");

    if (!cfg.sizePx || cfg.sizePx < 4 || cfg.sizePx > 128) errs.push("字号(px)建议在 4~128 范围内。");

    if (!cfg.moduleName.trim()) errs.push("模块名不能为空。");
    if (!cfg.exportName.trim()) errs.push("导出名不能为空。");

    if (!cfg.saveFileName.trim()) errs.push("保存文件名不能为空。");

    return errs;
}
