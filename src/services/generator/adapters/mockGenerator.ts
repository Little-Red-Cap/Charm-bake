import type { FontGenerateResult, FontJobConfig } from "../../../domain/types";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

function bytesOfText(s: string): number {
    return new TextEncoder().encode(s).byteLength;
}

export async function mockGenerate(cfg: FontJobConfig): Promise<FontGenerateResult> {
    await new Promise((r) => setTimeout(r, 250));

    const code = `// MOCK GENERATED (TODO: Rust backend)
` +
        `// font: ${cfg.fontSourceMode === "system" ? cfg.systemFontName : cfg.fontFilePath}
` +
        `// size: ${cfg.sizePx}px
` +
        `// range: '${cfg.rangeStart}'..'${cfg.rangeEnd}', custom="${cfg.customChars}", fallback='${cfg.fallbackChar}'
` +
        `
` +
        `module;
#include <cstdint>
#include <span>
export module ${cfg.moduleName};

` +
        `import ui_font;

` +
        `static constexpr uint8_t glyph_bitmaps[] = {
` +
        `  ${cfg.numberFormat === "hex" ? "0x10" : "0b00010000"},
` +
        `};

` +
        `// TODO: glyph_table, glyph_ranges, baseline/line_height...
` +
        `export constexpr Font ${cfg.exportName} = { /* TODO */ };
`;

    const language = useUiStore.getState().language;
    const stats = {
        glyphCount: 95,
        rangeCount: 1,
        bitmapBytes: 1024,
        textBytes: bytesOfText(code),
        warnings: [t(language, "mockWarning")],
    };

    return { code, stats };
}
