import React, { useEffect, useMemo, useRef } from "react";
import { Card, Empty } from "antd";
import type { PreviewGlyph } from "../../../domain/types";
import { useFontJobStore } from "../../../store/fontJob.store";

function decodeBase64(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function codepointLabel(codepoint: number): string {
    const ch = codepoint >= 32 && codepoint <= 126 ? String.fromCodePoint(codepoint) : "?";
    return `U+${codepoint.toString(16).toUpperCase().padStart(4, "0")} '${ch}'`;
}

function GlyphCanvas({ glyph }: { glyph: PreviewGlyph }) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const { w, h, bitmapB64 } = glyph;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (w === 0 || h === 0) {
            ctx.clearRect(0, 0, w, h);
            return;
        }

        const bytes = decodeBase64(bitmapB64);
        const imageData = ctx.createImageData(w, h);
        for (let i = 0; i < bytes.length; i += 1) {
            const v = bytes[i];
            const idx = i * 4;
            imageData.data[idx] = 0;
            imageData.data[idx + 1] = 0;
            imageData.data[idx + 2] = 0;
            imageData.data[idx + 3] = v;
        }
        ctx.putImageData(imageData, 0, 0);
    }, [glyph]);

    const scale = 2;
    return (
        <canvas
            ref={ref}
            style={{
                width: glyph.w * scale,
                height: glyph.h * scale,
                imageRendering: "pixelated",
                background: "#fff",
                border: "1px solid #f0f0f0",
            }}
        />
    );
}

export default function PreviewTab() {
    const { result } = useFontJobStore();
    const glyphs = result?.preview?.glyphs ?? [];

    const items = useMemo(() => glyphs, [glyphs]);
    if (!items.length) {
        return <Empty description="No preview yet" />;
    }

    return (
        <Card>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                    gap: 12,
                }}
            >
                {items.map((g) => (
                    <div
                        key={`${g.codepoint}-${g.w}x${g.h}`}
                        style={{ display: "flex", flexDirection: "column", gap: 6 }}
                    >
                        <div style={{ fontSize: 12, color: "rgba(0, 0, 0, 0.65)" }}>
                            {codepointLabel(g.codepoint)}
                        </div>
                        <GlyphCanvas glyph={g} />
                    </div>
                ))}
            </div>
        </Card>
    );
}
