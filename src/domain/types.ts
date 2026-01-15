export type OutputKind = "cpp_module" | "cpp" | "c";
export type NumberFormat = "bin" | "hex" | "dec";
export type BinarizeMode = "mask" | "mask_1bit" | "gamma_oversample";

export type FontSourceMode = "system" | "file";

export interface FontJobConfig {
    fontSourceMode: FontSourceMode;
    systemFontName: string | null;
    fontFilePath: string | null;

    rangeStart: string; // 单字符，例如 " "
    rangeEnd: string;   // 单字符，例如 "~"
    customChars: string; // 任意字符
    fallbackChar: string; // 单字符，默认 "?"

    sizePx: number;

    outputKind: OutputKind;
    moduleName: string;
    exportName: string;
    withComments: boolean;
    numberFormat: NumberFormat;

    binarizeMode: BinarizeMode;
    threshold: number;
    gamma: number;
    oversample: number;
    previewScale: number;

    saveDir: string | null;
    saveFileName: string; // e.g. yahei_12.cppm
}

export interface FontGenerateStats {
    glyphCount: number;
    rangeCount?: number;
    bitmapBytes: number;
    textBytes: number;
    maxW?: number;
    maxH?: number;
    lineHeight?: number;
    baseline?: number;
    warnings?: string[];
}

export interface PreviewGlyph {
    codepoint: number;
    w: number;
    h: number;
    advance: number;
    bitmapB64: string;
    monoB64?: string;
    rawB64?: string;
}

export interface FontPreview {
    glyphs: PreviewGlyph[];
}

export interface FontGenerateResult {
    code: string;
    stats: FontGenerateStats;
    preview?: FontPreview;
}

export type JobStatus = "idle" | "generating" | "success" | "error";

export interface FontJobState {
    config: FontJobConfig;
    status: JobStatus;
    result: FontGenerateResult | null;
    error: string | null;
}


