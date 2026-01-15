import { useEffect, useMemo, useRef } from "react";
import { Card, Empty, Slider, Space, Typography } from "antd";
import type { PreviewGlyph } from "../../../domain/types";
import { useFontJobStore } from "../../../store/fontjob.store";

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

function GrayCanvas({ glyph, scale }: { glyph: PreviewGlyph; scale: number }) {
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

function RawCanvas({ glyph, scale }: { glyph: PreviewGlyph; scale: number }) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const { w, h, rawB64 } = glyph;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (w === 0 || h === 0 || !rawB64) {
            ctx.clearRect(0, 0, w, h);
            return;
        }

        const bytes = decodeBase64(rawB64);
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

function MonoCanvas({ glyph, scale }: { glyph: PreviewGlyph; scale: number }) {
    const ref = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = ref.current;
        if (!canvas) return;
        const { w, h, monoB64 } = glyph;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        if (w === 0 || h === 0 || !monoB64) {
            ctx.clearRect(0, 0, w, h);
            return;
        }

        const bytes = decodeBase64(monoB64);
        const stride = Math.ceil(w / 8);
        const imageData = ctx.createImageData(w, h);
        for (let y = 0; y < h; y += 1) {
            for (let x = 0; x < w; x += 1) {
                const byteIndex = y * stride + (x >> 3);
                const mask = 0x80 >> (x & 7);
                const on = (bytes[byteIndex] & mask) !== 0;
                const idx = (y * w + x) * 4;
                imageData.data[idx] = 0;
                imageData.data[idx + 1] = 0;
                imageData.data[idx + 2] = 0;
                imageData.data[idx + 3] = on ? 255 : 0;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }, [glyph]);

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
    const { result, config, setConfig } = useFontJobStore();
    const glyphs = result?.preview?.glyphs ?? [];
    const scale = config.previewScale ?? 3;
    const items = useMemo(() => glyphs, [glyphs]);
    if (!items.length) {
        return <Empty description="No preview yet" />;
    }

    return (
        <Card>
            <Space align="center" style={{ marginBottom: 12 }}>
                <Typography.Text>缩放</Typography.Text>
                <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={scale}
                    onChange={(value) => {
                        if (typeof value === "number") setConfig({ previewScale: value });
                    }}
                    style={{ width: 160 }}
                />
                <Typography.Text type="secondary">{scale}x</Typography.Text>
            </Space>
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    alignItems: "flex-start",
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
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 6,
                                alignItems: "flex-start",
                            }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
                                <div style={{ fontSize: 11, color: "rgba(0, 0, 0, 0.6)" }}>Raw</div>
                                <RawCanvas glyph={g} scale={scale} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
                                <div style={{ fontSize: 11, color: "rgba(0, 0, 0, 0.6)" }}>Gray</div>
                                <GrayCanvas glyph={g} scale={scale} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: "0 0 auto" }}>
                                <div style={{ fontSize: 11, color: "rgba(0, 0, 0, 0.6)" }}>Mono</div>
                                <MonoCanvas glyph={g} scale={scale} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
