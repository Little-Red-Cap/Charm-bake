import type { FontJobConfig, FontGenerateResult, PreviewGlyph } from "../../domain/types";
import { invoke } from "@tauri-apps/api/core";

type BackendPreviewGlyph = {
    codepoint: number;
    w: number;
    h: number;
    advance: number;
    bitmap_b64: string;
};

type BackendResult = {
    ok: boolean;
    warnings: string[];
    stats: {
        glyph_count: number;
        bytes: number;
        max_w: number;
        max_h: number;
        line_height: number;
        baseline: number;
    };
    preview?: {
        glyphs: BackendPreviewGlyph[];
    };
    c?: {
        header: string;
        source: string;
    };
};

function toCodepoint(ch: string, fallback: number): number {
    const cp = ch?.codePointAt(0);
    return typeof cp === "number" ? cp : fallback;
}

function normalizeText(value: string | null | undefined): string | undefined {
    const v = (value ?? "").trim();
    return v ? v : undefined;
}

export async function generateFont(cfg: FontJobConfig): Promise<FontGenerateResult> {
    const job = {
        source: cfg.fontSourceMode === "system"
            ? { mode: "system", family: cfg.systemFontName ?? "" }
            : { mode: "file", path: cfg.fontFilePath ?? "" },
        module_name: cfg.moduleName,
        size_px: cfg.sizePx,
        range: {
            start: toCodepoint(cfg.rangeStart, 32),
            end: toCodepoint(cfg.rangeEnd, 126),
        },
        custom_chars: normalizeText(cfg.customChars),
        fallback_char: normalizeText(cfg.fallbackChar),
        output_kind: "c_array",
        export_name: cfg.exportName,
        with_comments: cfg.withComments,
        number_format: cfg.numberFormat === "hex" ? "hex" : "dec",
    };

    const result = await invoke<BackendResult>("generate_font", { job });
    if (!result.ok) {
        const msg = result.warnings?.join("\n") || "Generate failed";
        throw new Error(msg);
    }

    const previewGlyphs: PreviewGlyph[] | undefined = result.preview?.glyphs?.map((g) => ({
        codepoint: g.codepoint,
        w: g.w,
        h: g.h,
        advance: g.advance,
        bitmapB64: g.bitmap_b64,
    }));

    const code = result.c?.source ?? "";
    const stats = {
        glyphCount: result.stats.glyph_count,
        rangeCount: undefined,
        bitmapBytes: result.stats.bytes,
        textBytes: new TextEncoder().encode(code).byteLength,
        maxW: result.stats.max_w,
        maxH: result.stats.max_h,
        lineHeight: result.stats.line_height,
        baseline: result.stats.baseline,
        warnings: result.warnings,
    };

    return {
        code,
        stats,
        preview: previewGlyphs ? { glyphs: previewGlyphs } : undefined,
    };
}
