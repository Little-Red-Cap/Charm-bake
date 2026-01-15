import { useEffect, useMemo, useState } from "react";
import { Button, Card, Collapse, Form, Input, InputNumber, Layout, Radio, Space, theme } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useUiStore } from "../../store/ui.store";
import { useImageJobStore } from "../../store/imagejob.store";
import { formatNumber, type NumberFormat } from "../../domain/format";
import CodeEditor from "../common/CodeEditor";
import SplitPane from "../common/SplitPane";
import { t } from "../../domain/i18n";
import sampleImageUrl from "../../assets/sample-image.png";

type ResizeMode = "fit" | "fill" | "stretch";
type OutputMode = "mono" | "gray" | "rgb565" | "rgb888";
type DitherMode = "none" | "floyd" | "atkinson" | "bayer4" | "bayer8";

const PREVIEW_TARGET = { width: 240, height: 240 };
const PREVIEW_MIN_SIZE = 64;
const PREVIEW_MAX_SIZE = 1024;
const PREVIEW_MIN_HEIGHT = 200;
const CODE_MIN_HEIGHT = 240;

const BAYER_4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
];

const BAYER_8 = [
    [0, 48, 12, 60, 3, 51, 15, 63],
    [32, 16, 44, 28, 35, 19, 47, 31],
    [8, 56, 4, 52, 11, 59, 7, 55],
    [40, 24, 36, 20, 43, 27, 39, 23],
    [2, 50, 14, 62, 1, 49, 13, 61],
    [34, 18, 46, 30, 33, 17, 45, 29],
    [10, 58, 6, 54, 9, 57, 5, 53],
    [42, 26, 38, 22, 41, 25, 37, 21],
];

function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
    const out = new Uint8ClampedArray(data.length / 4);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        out[j] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    return out;
}

function ditherOrdered(gray: Uint8ClampedArray, width: number, height: number, matrix: number[][]): Uint8ClampedArray {
    const size = matrix.length;
    const scale = 1 / (size * size);
    const out = new Uint8ClampedArray(gray.length);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const idx = y * width + x;
            const threshold = (matrix[y % size][x % size] + 0.5) * scale * 255;
            out[idx] = gray[idx] >= threshold ? 255 : 0;
        }
    }
    return out;
}

function ditherFloyd(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const data = Float32Array.from(gray);
    const out = new Uint8ClampedArray(gray.length);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const idx = y * width + x;
            const old = data[idx];
            const newVal = old >= 128 ? 255 : 0;
            out[idx] = newVal;
            const err = old - newVal;
            if (x + 1 < width) data[idx + 1] += err * (7 / 16);
            if (x - 1 >= 0 && y + 1 < height) data[idx + width - 1] += err * (3 / 16);
            if (y + 1 < height) data[idx + width] += err * (5 / 16);
            if (x + 1 < width && y + 1 < height) data[idx + width + 1] += err * (1 / 16);
        }
    }
    return out;
}

function ditherAtkinson(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
    const data = Float32Array.from(gray);
    const out = new Uint8ClampedArray(gray.length);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const idx = y * width + x;
            const old = data[idx];
            const newVal = old >= 128 ? 255 : 0;
            out[idx] = newVal;
            const err = (old - newVal) / 8;
            if (x + 1 < width) data[idx + 1] += err;
            if (x + 2 < width) data[idx + 2] += err;
            if (x - 1 >= 0 && y + 1 < height) data[idx + width - 1] += err;
            if (y + 1 < height) data[idx + width] += err;
            if (x + 1 < width && y + 1 < height) data[idx + width + 1] += err;
            if (y + 2 < height) data[idx + width * 2] += err;
        }
    }
    return out;
}

function grayToImage(gray: Uint8ClampedArray, width: number, height: number): ImageData {
    const out = new ImageData(width, height);
    for (let i = 0, j = 0; i < out.data.length; i += 4, j += 1) {
        const v = gray[j];
        out.data[i] = v;
        out.data[i + 1] = v;
        out.data[i + 2] = v;
        out.data[i + 3] = 255;
    }
    return out;
}

function monoToImage(mono: Uint8ClampedArray, width: number, height: number): ImageData {
    const out = new ImageData(width, height);
    for (let i = 0, j = 0; i < out.data.length; i += 4, j += 1) {
        const v = mono[j] ? 0 : 255;
        out.data[i] = v;
        out.data[i + 1] = v;
        out.data[i + 2] = v;
        out.data[i + 3] = 255;
    }
    return out;
}

function rgbaToImage(data: Uint8ClampedArray, width: number, height: number): ImageData {
    const out = new ImageData(width, height);
    out.data.set(data);
    return out;
}

function rgb565Quantize(data: Uint8ClampedArray): Uint8ClampedArray {
    const out = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
        const r5 = data[i] >> 3;
        const g6 = data[i + 1] >> 2;
        const b5 = data[i + 2] >> 3;
        out[i] = Math.round((r5 / 31) * 255);
        out[i + 1] = Math.round((g6 / 63) * 255);
        out[i + 2] = Math.round((b5 / 31) * 255);
        out[i + 3] = 255;
    }
    return out;
}

function rgb565ToU16(data: Uint8ClampedArray): Uint16Array {
    const out = new Uint16Array(data.length / 4);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
        const r5 = data[i] >> 3;
        const g6 = data[i + 1] >> 2;
        const b5 = data[i + 2] >> 3;
        out[j] = (r5 << 11) | (g6 << 5) | b5;
    }
    return out;
}

function thresholdMono(gray: Uint8ClampedArray, threshold = 128): Uint8ClampedArray {
    const out = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i += 1) {
        out[i] = gray[i] >= threshold ? 255 : 0;
    }
    return out;
}

function packMono(mono: Uint8ClampedArray, width: number, height: number): Uint8Array {
    // TODO: support scan direction (row/col, flip H/V, top-down/right-left).
    // TODO: support bit order per byte (MSB/LSB) and byte-level reverse options.
    const stride = Math.ceil(width / 8);
    const out = new Uint8Array(stride * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const idx = y * width + x;
            if (mono[idx]) {
                const byteIndex = y * stride + (x >> 3);
                const mask = 0x80 >> (x & 7);
                out[byteIndex] |= mask;
            }
        }
    }
    return out;
}

function formatArray(values: ArrayLike<number>, perLine: number, format: NumberFormat, bits?: number): string {
    const lines: string[] = [];
    let line: string[] = [];
    for (let i = 0; i < values.length; i += 1) {
        line.push(formatNumber(values[i], format, bits));
        if (line.length >= perLine) {
            lines.push(line.join(", "));
            line = [];
        }
    }
    if (line.length) {
        lines.push(line.join(", "));
    }
    return lines.join(",\n    ");
}

function buildOutputCode(
    mode: OutputMode,
    format: NumberFormat,
    width: number,
    height: number,
    base: ImageData,
    gray: Uint8ClampedArray,
    mono: Uint8ClampedArray
): string {
    const header = `// size: ${width}x${height}\n`;
    // TODO: include scan/bit order metadata in header once implemented.
    if (mode === "mono") {
        const packed = packMono(mono, width, height);
        const body = formatArray(packed, 12, format, 8);
        const stride = Math.ceil(width / 8);
        return (
            `${header}// format: 1-bit packed, row-major, MSB-first\n` +
            `// stride: ${stride} bytes\n` +
            `const uint8_t image_data[] = {\n    ${body}\n};\n`
        );
    }

    if (mode === "gray") {
        const body = formatArray(gray, 12, format, 8);
        return `${header}// format: 8-bit grayscale\nconst uint8_t image_data[] = {\n    ${body}\n};\n`;
    }

    if (mode === "rgb565") {
        const values = rgb565ToU16(base.data);
        const body = formatArray(values, 8, format, 16);
        return `${header}// format: RGB565\nconst uint16_t image_data[] = {\n    ${body}\n};\n`;
    }

    const rgb = new Uint8Array((base.data.length / 4) * 3);
    for (let i = 0, j = 0; i < base.data.length; i += 4) {
        rgb[j++] = base.data[i];
        rgb[j++] = base.data[i + 1];
        rgb[j++] = base.data[i + 2];
    }
    const body = formatArray(rgb, 12, format, 8);
    return `${header}// format: RGB888 (R,G,B)\nconst uint8_t image_data[] = {\n    ${body}\n};\n`;
}

function applyDither(gray: Uint8ClampedArray, width: number, height: number, mode: DitherMode): Uint8ClampedArray {
    // TODO: expose threshold, dither strength, and ordered matrix size in UI.
    switch (mode) {
        case "floyd":
            return ditherFloyd(gray, width, height);
        case "atkinson":
            return ditherAtkinson(gray, width, height);
        case "bayer4":
            return ditherOrdered(gray, width, height, BAYER_4);
        case "bayer8":
            return ditherOrdered(gray, width, height, BAYER_8);
        default:
            return thresholdMono(gray);
    }
}

function loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
        img.src = url;
    });
}

function getResizedImageData(
    img: HTMLImageElement,
    mode: ResizeMode,
    targetWidth: number,
    targetHeight: number
): ImageData {
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas context unavailable");
    }

    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;
    if (mode === "stretch") {
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        return ctx.getImageData(0, 0, targetWidth, targetHeight);
    }

    const scale =
        mode === "fill" ? Math.max(targetWidth / imgW, targetHeight / imgH) : Math.min(targetWidth / imgW, targetHeight / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const dx = (targetWidth - drawW) / 2;
    const dy = (targetHeight - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
    return ctx.getImageData(0, 0, targetWidth, targetHeight);
}

function imageDataToDataUrl(imageData: ImageData): string {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        throw new Error("Canvas context unavailable");
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
}

export default function ImagePage() {
    const { token } = theme.useToken();
    const uiTheme = useUiStore((s) => s.theme);
    const language = useUiStore((s) => s.language);
    const setOutput = useImageJobStore((s) => s.setOutput);
    const setImageJob = useImageJobStore((s) => s.setOutput);

    const [imagePath, setImagePath] = useState("");
    const [imageUrl, setImageUrl] = useState<string | null>(sampleImageUrl);
    const [processedUrl, setProcessedUrl] = useState<string | null>(null);
    const [exportUrl, setExportUrl] = useState<string | null>(null);
    const [outputCode, setOutputCode] = useState("");
    const [targetWidth, setTargetWidth] = useState(PREVIEW_TARGET.width);
    const [targetHeight, setTargetHeight] = useState(PREVIEW_TARGET.height);
    const [resizeMode, setResizeMode] = useState<ResizeMode>("fit");
    const [outputMode, setOutputMode] = useState<OutputMode>("mono");
    const [ditherMode, setDitherMode] = useState<DitherMode>("floyd");
    const [numberFormat, setNumberFormat] = useState<NumberFormat>("hex");

    const codeText = useMemo(() => {
        if (!outputCode) return t(language, "statsNoOutput");
        return outputCode;
    }, [language, outputCode]);

    const pickImageFile = async () => {
        const selected = await open({
            multiple: false,
            filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "bmp", "gif", "webp"] }],
        });
        if (!selected) return;
        const path = Array.isArray(selected) ? selected[0] : selected;
        setImagePath(path);
        setImageUrl(convertFileSrc(path));
    };

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (!imageUrl) {
                setProcessedUrl(null);
                setExportUrl(null);
                setOutputCode("");
                return;
            }

            try {
                const img = await loadImage(imageUrl);
                if (cancelled) return;

                const base = getResizedImageData(img, resizeMode, targetWidth, targetHeight);
                const gray = toGrayscale(base.data);
                const processedImage = grayToImage(gray, base.width, base.height);
                const processed = imageDataToDataUrl(processedImage);

                const mono = applyDither(gray, base.width, base.height, ditherMode);
                let exportImage: ImageData;
                if (outputMode === "mono") {
                    exportImage = monoToImage(mono, base.width, base.height);
                } else if (outputMode === "gray") {
                    exportImage = processedImage;
                } else if (outputMode === "rgb565") {
                    const quantized = rgb565Quantize(base.data);
                    exportImage = rgbaToImage(quantized, base.width, base.height);
                } else {
                    exportImage = rgbaToImage(base.data, base.width, base.height);
                }

                const exported = imageDataToDataUrl(exportImage);
                const code = buildOutputCode(outputMode, numberFormat, base.width, base.height, base, gray, mono);
                if (!cancelled) {
                    setProcessedUrl(processed);
                    setExportUrl(exported);
                    setOutputCode(code);
                }
            } catch (err) {
                console.error("Image processing failed", err);
                if (!cancelled) {
                    setProcessedUrl(null);
                    setExportUrl(null);
                    setOutputCode("");
                }
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [imageUrl, resizeMode, outputMode, ditherMode, targetWidth, targetHeight, numberFormat]);

    useEffect(() => {
        setOutput({ outputCode, outputMode, imagePath: imagePath || null });
    }, [imagePath, outputCode, outputMode, setOutput]);

    useEffect(() => {
        setImageJob({ outputCode, outputMode, imagePath: imagePath || null });
    }, [outputCode, outputMode, imagePath, setImageJob]);

    

    return (
        <Layout style={{ height: "100%" }}>
            <Layout style={{ flex: 1 }}>
                <Layout.Sider
                    width={360}
                    theme={uiTheme}
                    style={{ borderRight: `1px solid ${token.colorBorder}`, overflow: "auto" }}
                >
                    <div className="compactLayout" style={{ padding: 8 }}>
                        <Collapse
                            defaultActiveKey={["input", "preprocess", "output"]}
                            items={[
                                {
                                    key: "input",
                                    label: t(language, "imageInputTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "imageSource")}>
                                                <Radio.Group value="file">
                                                    <Radio value="file">{t(language, "imageSourceFile")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "imageSourceFile")}>
                                                <Space.Compact style={{ width: "100%" }}>
                                                    <Input
                                                        value={imagePath}
                                                        onChange={(e) => setImagePath(e.target.value)}
                                                        placeholder={t(language, "imagePathPlaceholder")}
                                                    />
                                                    <Button onClick={pickImageFile}>{t(language, "imagePickFile")}</Button>
                                                    <Button
                                                        onClick={() => {
                                                            setImagePath("src-tauri/icons/Square310x310Logo.png");
                                                            setImageUrl(sampleImageUrl);
                                                        }}
                                                    >
                                                        {t(language, "imageUseSample")}
                                                    </Button>
                                                </Space.Compact>
                                            </Form.Item>
                                        </Form>
                                    ),
                                },
                                {
                                    key: "preprocess",
                                    label: t(language, "imagePreprocessTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "imageResize")}>
                                                <Radio.Group value={resizeMode} onChange={(e) => setResizeMode(e.target.value)}>
                                                    <Radio value="fit">{t(language, "imageResizeFit")}</Radio>
                                                    <Radio value="fill">{t(language, "imageResizeFill")}</Radio>
                                                    <Radio value="stretch">{t(language, "imageResizeStretch")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "imageResizeTarget")}>
                                                <Space.Compact style={{ width: "100%" }}>
                                                    <InputNumber
                                                        min={PREVIEW_MIN_SIZE}
                                                        max={PREVIEW_MAX_SIZE}
                                                        value={targetWidth}
                                                        onChange={(value) => setTargetWidth(Number(value) || PREVIEW_TARGET.width)}
                                                        style={{ width: "100%" }}
                                                    />
                                                    <InputNumber
                                                        min={PREVIEW_MIN_SIZE}
                                                        max={PREVIEW_MAX_SIZE}
                                                        value={targetHeight}
                                                        onChange={(value) => setTargetHeight(Number(value) || PREVIEW_TARGET.height)}
                                                        style={{ width: "100%" }}
                                                    />
                                                </Space.Compact>
                                            </Form.Item>
                                        </Form>
                                    ),
                                },
                                {
                                    key: "output",
                                    label: t(language, "imageOutputTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "imageOutputTitle")}>
                                                <Radio.Group value={outputMode} onChange={(e) => setOutputMode(e.target.value)}>
                                                    <Radio value="mono">{t(language, "imageOutputMono")}</Radio>
                                                    <Radio value="gray">{t(language, "imageOutputGray")}</Radio>
                                                    <Radio value="rgb565">{t(language, "imageOutputRgb565")}</Radio>
                                                    <Radio value="rgb888">{t(language, "imageOutputRgb888")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "imageDither")}>
                                                <Radio.Group value={ditherMode} onChange={(e) => setDitherMode(e.target.value)}>
                                                    <Radio value="none">{t(language, "imageDitherNone")}</Radio>
                                                    <Radio value="floyd">{t(language, "imageDitherFloyd")}</Radio>
                                                    <Radio value="atkinson">{t(language, "imageDitherAtkinson")}</Radio>
                                                    <Radio value="bayer4">{t(language, "imageDitherBayer4")}</Radio>
                                                    <Radio value="bayer8">{t(language, "imageDitherBayer8")}</Radio>
                                                </Radio.Group>
                                                {/* TODO: add threshold slider, dither strength, matrix size, and scan/bit order options. */}
                                            </Form.Item>
                                            <Form.Item label={t(language, "numberFormatLabel")}>
                                                <Radio.Group value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)}>
                                                    <Radio value="bin">{t(language, "numberFormatBin")}</Radio>
                                                    <Radio value="dec">{t(language, "numberFormatDec")}</Radio>
                                                    <Radio value="hex">{t(language, "numberFormatHex")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                        </Form>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </Layout.Sider>

                <Layout.Content style={{ padding: 16, overflow: "hidden", background: token.colorBgLayout }}>
                    <SplitPane
                        minTop={PREVIEW_MIN_HEIGHT}
                        minBottom={CODE_MIN_HEIGHT}
                        initialRatio={0.45}
                        handleStyle={{ background: token.colorFillSecondary }}
                        top={
                            <Card title={t(language, "imagePreviewTitle")}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                                    {[
                                        { label: t(language, "imagePreviewOriginal"), url: imageUrl },
                                        { label: t(language, "imagePreviewProcessed"), url: processedUrl },
                                        { label: t(language, "imagePreviewExport"), url: exportUrl },
                                    ].map(({ label, url }) => (
                                        <Card key={label} size="small" title={label} style={{ width: 220 }}>
                                            <div
                                                style={{
                                                    width: "100%",
                                                    height: 140,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background: token.colorBgContainer,
                                                    border: `1px dashed ${token.colorBorder}`,
                                                    borderRadius: 6,
                                                }}
                                            >
                                                {url ? (
                                                    <img
                                                        src={url}
                                                        alt={label}
                                                        style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                                                    />
                                                ) : (
                                                    <PictureOutlined style={{ fontSize: 28, color: token.colorTextDescription }} />
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </Card>
                        }
                        bottom={
                            <Card
                                title={t(language, "imageOutputCodeTitle")}
                                style={{ height: "100%" }}
                                styles={{ body: { padding: 0, height: "100%" } }}
                            >
                                <CodeEditor value={codeText} height="100%" />
                            </Card>
                        }
                    />
                </Layout.Content>
            </Layout>
        </Layout>
    );
}
