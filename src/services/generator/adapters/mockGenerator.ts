import type { FontGenerateResult, FontJobConfig } from "../../../domain/types";

function bytesOfText(s: string): number {
    return new TextEncoder().encode(s).byteLength;
}

export async function mockGenerate(cfg: FontJobConfig): Promise<FontGenerateResult> {
    await new Promise((r) => setTimeout(r, 250));

    const code = `// MOCK GENERATED (TODO: Rust backend)\n` +
        `// font: ${cfg.fontSourceMode === "system" ? cfg.systemFontName : cfg.fontFilePath}\n` +
        `// size: ${cfg.sizePx}px\n` +
        `// range: '${cfg.rangeStart}'..'${cfg.rangeEnd}', custom="${cfg.customChars}", fallback='${cfg.fallbackChar}'\n` +
        `\n` +
        `module;\n#include <cstdint>\n#include <span>\nexport module ${cfg.moduleName};\n\n` +
        `import ui_font;\n\n` +
        `static constexpr uint8_t glyph_bitmaps[] = {\n` +
        `  ${cfg.numberFormat === "hex" ? "0x10" : "0b00010000"},\n` +
        `};\n\n` +
        `// TODO: glyph_table, glyph_ranges, baseline/line_height...\n` +
        `export constexpr Font ${cfg.exportName} = { /* TODO */ };\n`;

    const stats = {
        glyphCount: 95,
        rangeCount: 1,
        bitmapBytes: 1024,
        textBytes: bytesOfText(code),
        warnings: ["点阵预览未实现（TODO）"],
    };

    return { code, stats };
}
