import type { FontJobConfig } from "./types";

export function sanitizeIdent(input: string): string {
    // 模块/变量名安全化：字母数字下划线，首字符不能是数字
    const s = (input || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    if (!s) return "font";
    if (/^[0-9]/.test(s)) return `f_${s}`;
    return s;
}

export function defaultModuleName(fontNameLike: string, sizePx: number): string {
    return `${sanitizeIdent(fontNameLike)}_${sizePx}`;
}

export function defaultExportName(fontNameLike: string, sizePx: number): string {
    // 你现有示例是 export constexpr Font font_12 这种；这里先统一为 moduleName
    return defaultModuleName(fontNameLike, sizePx);
}

export function defaultSaveFileName(moduleName: string, outputKind: FontJobConfig["outputKind"]): string {
    if (outputKind === "cpp_module") return `${moduleName}.cppm`;
    if (outputKind === "cpp") return `${moduleName}.hpp`; // TODO: 你也可以改成 .h/.cpp
    return `${moduleName}.h`;
}

export const DEFAULT_CONFIG: FontJobConfig = {
    fontSourceMode: "system",
    systemFontName: "Microsoft YaHei UI",
    fontFilePath: null,

    rangeStart: " ",
    rangeEnd: "~",
    customChars: "℃",
    fallbackChar: "?",

    sizePx: 12,

    outputKind: "cpp_module",
    moduleName: "yahei_12",
    exportName: "yahei_12",
    withComments: true,
    numberFormat: "bin",
    binarizeMode: "mask",
    threshold: 128,
    gamma: 1.4,
    oversample: 2,

    saveDir: null,
    saveFileName: "yahei_12.cppm",
};
