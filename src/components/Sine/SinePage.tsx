import { useMemo, useState } from "react";
import { Card, Collapse, Form, Input, InputNumber, Layout, Radio, Slider, Space, Tooltip, Typography, theme } from "antd";
import { useUiStore } from "../../store/ui.store";
import { t } from "../../domain/i18n";

type OutputFormat = "bin" | "dec" | "hex";
type OutputStyle = "array" | "macro" | "enum";
type SignedMode = "signed" | "unsigned";

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function formatValue(value: number, format: OutputFormat, bits: number): string {
    if (format === "dec") return String(value);
    if (format === "hex") {
        const width = Math.ceil(bits / 4);
        return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
    }
    return `0b${value.toString(2).padStart(bits, "0")}`;
}

function valueType(bits: number, signed: SignedMode): string {
    if (bits <= 8) return signed === "signed" ? "int8_t" : "uint8_t";
    if (bits <= 16) return signed === "signed" ? "int16_t" : "uint16_t";
    return signed === "signed" ? "int32_t" : "uint32_t";
}

function macroName(index: number): string {
    return `SINE_${index}`;
}

function PhaseDial({
    value,
    onChange,
    hint,
}: {
    value: number;
    onChange: (next: number) => void;
    hint: string;
}) {
    const size = 72;
    const center = size / 2;
    const radius = size / 2 - 6;
    const angle = ((value % 360) * Math.PI) / 180;
    const x = center + Math.cos(angle) * radius;
    const y = center + Math.sin(angle) * radius;

    const updateFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
        const normalized = (deg + 360) % 360;
        const snap = e.shiftKey ? 15 : e.altKey ? 1 : 5;
        onChange(Math.round(normalized / snap) * snap);
    };

    return (
        <Tooltip title={hint}>
            <svg
                width={size}
                height={size}
                style={{ cursor: "pointer" }}
                onClick={updateFromEvent}
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    updateFromEvent(e);
                }}
                onPointerMove={(e) => {
                    if (e.buttons !== 1) return;
                    updateFromEvent(e);
                }}
                onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
            >
                {[0, 90, 180, 270].map((deg) => {
                    const rad = (deg * Math.PI) / 180;
                    const x1 = center + Math.cos(rad) * (radius - 6);
                    const y1 = center + Math.sin(rad) * (radius - 6);
                    const x2 = center + Math.cos(rad) * radius;
                    const y2 = center + Math.sin(rad) * radius;
                    return (
                        <line
                            key={deg}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="rgba(0,0,0,0.35)"
                            strokeWidth={2}
                        />
                    );
                })}
                <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={2} />
                <line x1={center} y1={center} x2={x} y2={y} stroke="#1677ff" strokeWidth={3} />
                <circle cx={center} cy={center} r={3} fill="#1677ff" />
            </svg>
        </Tooltip>
    );
}

export default function SinePage() {
    const { token } = theme.useToken();
    const uiTheme = useUiStore((s) => s.theme);
    const language = useUiStore((s) => s.language);

    const [samples, setSamples] = useState(64);
    const [amplitude, setAmplitude] = useState(1);
    const [offset, setOffset] = useState(0);
    const [phaseDeg, setPhaseDeg] = useState(0);
    const [cycles, setCycles] = useState(1);
    const [lutRepeat, setLutRepeat] = useState(1);
    const [windowType, setWindowType] = useState<"none" | "hann" | "hamming">("none");
    const [quantBits, setQuantBits] = useState(12);
    const [signedMode, setSignedMode] = useState<SignedMode>("unsigned");
    const [format, setFormat] = useState<OutputFormat>("bin");
    const [outputStyle, setOutputStyle] = useState<OutputStyle>("array");
    const [template, setTemplate] = useState<"c_array" | "cpp_module">("c_array");
    const [arrayName, setArrayName] = useState("sine_table");
    const [enumName, setEnumName] = useState("SineTable");
    const [macroPrefix, setMacroPrefix] = useState("SINE");
    const [previewZoom, setPreviewZoom] = useState(1);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [zoomHint, setZoomHint] = useState<number | null>(null);
    const [zoomHintPos, setZoomHintPos] = useState<{ x: number; y: number } | null>(null);

    const baseSamples = useMemo(() => {
        const count = Math.max(2, Math.floor(samples));
        const phase = (phaseDeg * Math.PI) / 180;
        const list = [];
        for (let i = 0; i < count; i += 1) {
            const t = i / count;
            const value = offset + amplitude * Math.sin(2 * Math.PI * cycles * t + phase);
            list.push(value);
        }
        return list;
    }, [samples, amplitude, offset, phaseDeg, cycles]);

    const mathSamples = useMemo(() => {
        const repeat = Math.max(1, Math.floor(lutRepeat));
        if (repeat === 1) return baseSamples;
        return Array.from({ length: repeat }, () => baseSamples).flat();
    }, [baseSamples, lutRepeat]);

    const windowedSamples = useMemo(() => {
        if (windowType === "none") return mathSamples;
        const count = mathSamples.length;
        if (count <= 1) return mathSamples;
        return mathSamples.map((v, i) => {
            const w = windowType === "hann"
                ? 0.5 * (1 - Math.cos((2 * Math.PI * i) / (count - 1)))
                : 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (count - 1));
            return v * w;
        });
    }, [mathSamples, windowType]);

    const quantized = useMemo(() => {
        const bits = Math.max(1, Math.floor(quantBits));
        const maxUnsigned = (1 << Math.min(bits, 30)) - 1;
        const minSigned = -(1 << (Math.min(bits, 30) - 1));
        const maxSigned = (1 << (Math.min(bits, 30) - 1)) - 1;
        return windowedSamples.map((v) => {
            let normalized = v;
            if (signedMode === "unsigned") {
                const scaled = Math.round((normalized + 1) * 0.5 * maxUnsigned);
                return clamp(scaled, 0, maxUnsigned);
            }
            const scaled = Math.round(normalized * maxSigned);
            return clamp(scaled, minSigned, maxSigned);
        });
    }, [windowedSamples, quantBits, signedMode]);

    const outputCode = useMemo(() => {
        const bits = Math.max(1, Math.floor(quantBits));
        const header = [
            `// samples: ${samples}`,
            `// amplitude: ${amplitude}`,
            `// offset: ${offset}`,
            `// phase: ${phaseDeg} deg`,
            `// cycles: ${cycles}`,
            `// lut_repeat: ${lutRepeat}`,
            `// window: ${windowType}`,
            `// bits: ${bits}`,
            `// signed: ${signedMode}`,
        ];
        const typeName = valueType(bits, signedMode);

        const moduleName = (enumName || arrayName || "sine_table").trim();

        const arrLines = [
            `static const ${typeName} ${arrayName}[] = {`,
            ...quantized.map((v) => `  ${formatValue(v, format, bits)},`),
            "};",
        ];
        const enumLines = [
            `enum ${enumName} {`,
            ...quantized.map((v, idx) => `  ${macroPrefix}_${macroName(idx)} = ${formatValue(v, format, bits)},`),
            "};",
        ];
        const macroLines = quantized.map((v, idx) => `#define ${macroPrefix}_${macroName(idx)} ${formatValue(v, format, bits)}`);

        if (template === "cpp_module") {
            const body =
                outputStyle === "macro"
                    ? macroLines
                    : outputStyle === "enum"
                        ? enumLines
                        : [
                            `export ${typeName} ${arrayName}[] = {`,
                            ...quantized.map((v) => `  ${formatValue(v, format, bits)},`),
                            "};",
                        ];
            return [
                "module;",
                "#include <cstdint>",
                "",
                `export module ${moduleName};`,
                "",
                ...header,
                "",
                ...body,
            ].join("\n");
        }

        const body =
            outputStyle === "macro"
                ? macroLines
                : outputStyle === "enum"
                    ? enumLines
                    : arrLines;
        return [...header, "", ...body].join("\n");
    }, [
        samples,
        amplitude,
        offset,
        phaseDeg,
        cycles,
        quantBits,
        signedMode,
        outputStyle,
        template,
        arrayName,
        enumName,
        macroPrefix,
        format,
        quantized,
        lutRepeat,
        windowType,
    ]);

    const previewPath = useMemo(() => {
        const previewSamples = windowedSamples.length > 1
            ? [...windowedSamples, windowedSamples[0]]
            : windowedSamples;
        const width = Math.max(240, previewSamples.length * 6) * previewZoom;
        const height = 200;
        const padding = { left: 28, right: 18, top: 8, bottom: 12 };
        const innerW = Math.max(10, width - padding.left - padding.right);
        const innerH = Math.max(10, height - padding.top - padding.bottom);
        const minVal = Math.min(...previewSamples, -1);
        const maxVal = Math.max(...previewSamples, 1);
        const range = maxVal - minVal || 1;
        return previewSamples
            .map((v, idx) => {
                const x = padding.left + (idx / (previewSamples.length - 1)) * innerW;
                const y = padding.top + (1 - (v - minVal) / range) * innerH;
                return `${x.toFixed(2)},${y.toFixed(2)}`;
            })
            .join(" ");
    }, [previewZoom, windowedSamples]);

    const stats = useMemo(() => {
        const min = Math.min(...windowedSamples);
        const max = Math.max(...windowedSamples);
        const avg = windowedSamples.reduce((a, b) => a + b, 0) / Math.max(1, windowedSamples.length);
        return { min, max, avg };
    }, [windowedSamples]);

    const hoverValue = useMemo(() => {
        if (hoverIndex == null || hoverIndex < 0 || hoverIndex >= quantized.length) return null;
        return {
            idx: hoverIndex,
            raw: windowedSamples[hoverIndex],
            quant: quantized[hoverIndex],
        };
    }, [hoverIndex, windowedSamples, quantized]);

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
                            defaultActiveKey={["quant", "output"]}
                            items={[
                                {
                                    key: "quant",
                                    label: t(language, "sineQuantTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "sineWindow")}>
                                                <Radio.Group value={windowType} onChange={(e) => setWindowType(e.target.value)}>
                                                    <Radio value="none">{t(language, "sineWindowNone")}</Radio>
                                                    <Radio value="hann">{t(language, "sineWindowHann")}</Radio>
                                                    <Radio value="hamming">{t(language, "sineWindowHamming")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "sineSigned")}>
                                                <Radio.Group value={signedMode} onChange={(e) => setSignedMode(e.target.value)}>
                                                    <Radio value="unsigned">{t(language, "sineUnsigned")}</Radio>
                                                    <Radio value="signed">{t(language, "sineSignedValue")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "sineFormat")}>
                                                <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)}>
                                                    <Radio value="bin">{t(language, "numberFormatBin")}</Radio>
                                                    <Radio value="dec">{t(language, "numberFormatDec")}</Radio>
                                                    <Radio value="hex">{t(language, "numberFormatHex")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                        </Form>
                                    ),
                                },
                                {
                                    key: "output",
                                    label: t(language, "sineOutputTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "sineTemplate")}>
                                                <Radio.Group value={template} onChange={(e) => setTemplate(e.target.value)}>
                                                    <Radio value="c_array">{t(language, "sineTemplateC")}</Radio>
                                                    <Radio value="cpp_module">{t(language, "sineTemplateCpp")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "sevenSegOutputStyle")}>
                                                <Radio.Group value={outputStyle} onChange={(e) => setOutputStyle(e.target.value)}>
                                                    <Radio value="array">{t(language, "sevenSegOutputStyleArray")}</Radio>
                                                    <Radio value="macro">{t(language, "sevenSegOutputStyleMacro")}</Radio>
                                                    <Radio value="enum">{t(language, "sevenSegOutputStyleEnum")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>
                                            <Form.Item label={t(language, "sevenSegOutputNames")}>
                                                <Space direction="vertical" style={{ width: "100%" }}>
                                                    <Input
                                                        value={macroPrefix}
                                                        onChange={(e) => setMacroPrefix(e.target.value)}
                                                        placeholder={t(language, "sevenSegOutputPrefix")}
                                                    />
                                                    {outputStyle === "array" ? (
                                                        <Input
                                                            value={arrayName}
                                                            onChange={(e) => setArrayName(e.target.value)}
                                                            placeholder={t(language, "sineArrayName")}
                                                        />
                                                    ) : null}
                                                    {outputStyle === "enum" ? (
                                                        <Input
                                                            value={enumName}
                                                            onChange={(e) => setEnumName(e.target.value)}
                                                            placeholder={t(language, "sineEnumName")}
                                                        />
                                                    ) : null}
                                                </Space>
                                            </Form.Item>
                                        </Form>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </Layout.Sider>

                <Layout.Content style={{ padding: 16, overflow: "auto", background: token.colorBgLayout }}>
                    <Space direction="vertical" size="large" style={{ width: "100%" }}>
                        <Card title={t(language, "sinePreviewTitle")}>
                            <Form layout="vertical">
                                <div style={{ marginBottom: 6 }} />
                                <Space wrap size={8}>
                                    <Form.Item label={t(language, "sineSamples")} style={{ marginBottom: 8 }}>
                                        <Tooltip title={t(language, "sineCtrlWheelHint")}>
                                            <InputNumber
                                                min={8}
                                                max={4096}
                                                value={samples}
                                                onChange={(v) => setSamples(Number(v || 64))}
                                                onWheel={(e) => {
                                                    if (!e.ctrlKey) return;
                                                    e.preventDefault();
                                                    const step = e.shiftKey ? 10 : e.altKey ? 1 : 5;
                                                    const next = clamp(samples + (e.deltaY < 0 ? step : -step), 8, 4096);
                                                    setSamples(next);
                                                }}
                                                style={{ width: 120 }}
                                            />
                                        </Tooltip>
                                    </Form.Item>
                                    <Form.Item label={t(language, "sineCycles")} style={{ marginBottom: 8 }}>
                                        <Tooltip title={t(language, "sineCtrlWheelHint")}>
                                            <InputNumber
                                                min={1}
                                                max={16}
                                                value={cycles}
                                                onChange={(v) => setCycles(Number(v || 1))}
                                                onWheel={(e) => {
                                                    if (!e.ctrlKey) return;
                                                    e.preventDefault();
                                                    const step = e.shiftKey ? 2 : e.altKey ? 1 : 1;
                                                    const next = clamp(cycles + (e.deltaY < 0 ? step : -step), 1, 16);
                                                    setCycles(next);
                                                }}
                                                style={{ width: 120 }}
                                            />
                                        </Tooltip>
                                    </Form.Item>
                                    <Form.Item label={t(language, "sineBits")} style={{ marginBottom: 8 }}>
                                        <Tooltip title={t(language, "sineCtrlWheelHint")}>
                                            <InputNumber
                                                min={4}
                                                max={16}
                                                value={quantBits}
                                                onChange={(v) => setQuantBits(Number(v || 12))}
                                                onWheel={(e) => {
                                                    if (!e.ctrlKey) return;
                                                    e.preventDefault();
                                                    const step = e.shiftKey ? 2 : e.altKey ? 1 : 1;
                                                    const next = clamp(quantBits + (e.deltaY < 0 ? step : -step), 4, 16);
                                                    setQuantBits(next);
                                                }}
                                                style={{ width: 120 }}
                                            />
                                        </Tooltip>
                                    </Form.Item>
                                    <Form.Item label={t(language, "sinePhase")} style={{ marginBottom: 8 }}>
                                        <Space>
                                            <Tooltip title={t(language, "sineCtrlWheelHint")}>
                                                <InputNumber
                                                    min={-360}
                                                    max={360}
                                                    value={phaseDeg}
                                                    onChange={(v) => setPhaseDeg(Number(v || 0))}
                                                    onWheel={(e) => {
                                                        if (!e.ctrlKey) return;
                                                        e.preventDefault();
                                                        const step = e.shiftKey ? 15 : e.altKey ? 1 : 5;
                                                        const next = clamp(phaseDeg + (e.deltaY < 0 ? step : -step), -360, 360);
                                                        setPhaseDeg(next);
                                                    }}
                                                    style={{ width: 120 }}
                                                    addonAfter="deg"
                                                />
                                            </Tooltip>
                                            <PhaseDial
                                                value={phaseDeg}
                                                onChange={(v) => setPhaseDeg(v)}
                                                hint={t(language, "sineWheelHint")}
                                            />
                                        </Space>
                                    </Form.Item>
                                    <Form.Item label={t(language, "sineAmplitude")} style={{ marginBottom: 8 }}>
                                        <Slider min={0} max={1} step={0.05} value={amplitude} onChange={(v) => setAmplitude(Number(v))} style={{ width: 160 }} />
                                    </Form.Item>
                                    <Form.Item label={t(language, "sineOffset")} style={{ marginBottom: 8 }}>
                                        <Slider min={-1} max={1} step={0.05} value={offset} onChange={(v) => setOffset(Number(v))} style={{ width: 160 }} />
                                    </Form.Item>
                                    <Form.Item label={t(language, "sineLutRepeat")} style={{ marginBottom: 8 }}>
                                        <Tooltip title={t(language, "sineCtrlWheelHint")}>
                                            <InputNumber
                                                min={1}
                                                max={16}
                                                value={lutRepeat}
                                                onChange={(v) => setLutRepeat(Number(v || 1))}
                                                onWheel={(e) => {
                                                    if (!e.ctrlKey) return;
                                                    e.preventDefault();
                                                    const next = clamp(lutRepeat + (e.deltaY < 0 ? 1 : -1), 1, 16);
                                                    setLutRepeat(next);
                                                }}
                                                style={{ width: 120 }}
                                            />
                                        </Tooltip>
                                    </Form.Item>
                                </Space>

                                <div style={{ width: "100%", marginBottom: 6 }}>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                        {t(language, "sineAxisTitle")}
                                    </Typography.Text>
                                </div>
                                <Space wrap size="large" style={{ marginBottom: 12 }} />
                            </Form>
                            <Space size="large" wrap style={{ marginBottom: 8 }}>
                                <Typography.Text type="secondary">{t(language, "sineStatMin")}: {stats.min.toFixed(3)}</Typography.Text>
                                <Typography.Text type="secondary">{t(language, "sineStatMax")}: {stats.max.toFixed(3)}</Typography.Text>
                                <Typography.Text type="secondary">{t(language, "sineStatAvg")}: {stats.avg.toFixed(3)}</Typography.Text>
                                {hoverValue ? (
                                    <Typography.Text type="secondary">
                                        {t(language, "sineStatPoint")} #{hoverValue.idx}: {hoverValue.raw.toFixed(3)} / {hoverValue.quant}
                                    </Typography.Text>
                                ) : null}
                            </Space>
                            <div style={{ overflowX: "auto", position: "relative" }}>
                                <svg
                                    width={Math.max(240, (windowedSamples.length + 1) * 6) * previewZoom}
                                    height={200}
                                    style={{ background: token.colorBgContainer, cursor: "crosshair" }}
                                    onMouseMove={(e) => {
                                        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const idx = Math.round((x / rect.width) * (mathSamples.length - 1));
                                        setHoverIndex(clamp(idx, 0, mathSamples.length - 1));
                                    }}
                                    onMouseLeave={() => setHoverIndex(null)}
                                    onWheel={(e) => {
                                        if (!e.ctrlKey) return;
                                        e.preventDefault();
                                        const step = e.shiftKey ? 1 : e.altKey ? 0.1 : 0.5;
                                        const next = clamp(previewZoom + (e.deltaY < 0 ? step : -step), 0.5, 10);
                                        setPreviewZoom(Number(next.toFixed(1)));
                                        setZoomHint(Number(next.toFixed(1)));
                                        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
                                        setZoomHintPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                                        setTimeout(() => setZoomHint(null), 1500);
                                    }}
                                >
                                    {(() => {
                                        const width = Math.max(240, (windowedSamples.length + 1) * 6) * previewZoom;
                                        const padding = { left: 28, right: 18, top: 8, bottom: 12 };
                                        const innerW = Math.max(10, width - padding.left - padding.right);
                                        const innerH = Math.max(10, 200 - padding.top - padding.bottom);
                                        const minVal = Math.min(...windowedSamples, -1);
                                        const maxVal = Math.max(...windowedSamples, 1);
                                        const zeroInside = minVal <= 0 && maxVal >= 0;
                                        const zeroY = zeroInside
                                            ? padding.top + (1 - (0 - minVal) / (maxVal - minVal || 1)) * innerH
                                            : null;
                                        return (
                                            <>
                                                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + innerH} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
                                                <text x={padding.left - 4} y={padding.top + 4} fontSize={10} fill="rgba(0,0,0,0.55)" textAnchor="end">
                                                    {maxVal.toFixed(2)}
                                                </text>
                                                <text x={padding.left - 4} y={padding.top + innerH + 2} fontSize={10} fill="rgba(0,0,0,0.55)" textAnchor="end">
                                                    {minVal.toFixed(2)}
                                                </text>
                                                {zeroInside ? (
                                                    <>
                                                        <text x={padding.left - 4} y={(zeroY ?? 0) + 4} fontSize={10} fill="rgba(0,0,0,0.55)" textAnchor="end">
                                                            0
                                                        </text>
                                                        <line x1={padding.left} y1={zeroY ?? 0} x2={padding.left + innerW} y2={zeroY ?? 0} stroke="rgba(0,0,0,0.18)" strokeWidth={1} />
                                                    </>
                                                ) : null}
                                                {[0.25, 0.5, 0.75].map((y, idx) => (
                                                    <line
                                                        key={idx}
                                                        x1={padding.left}
                                                        y1={padding.top + innerH * y}
                                                        x2={padding.left + innerW}
                                                        y2={padding.top + innerH * y}
                                                        stroke="rgba(0,0,0,0.08)"
                                                        strokeWidth={1}
                                                        strokeDasharray="4 6"
                                                    />
                                                ))}
                                            </>
                                        );
                                    })()}
                                    <polyline
                                        fill="none"
                                        stroke={token.colorPrimary}
                                        strokeWidth={2}
                                        points={previewPath}
                                    />
                                    {hoverValue ? (
                                        <circle
                                            cx={(() => {
                                                const width = Math.max(240, (windowedSamples.length + 1) * 6) * previewZoom;
                                                const padding = { left: 28, right: 18 };
                                                const innerW = Math.max(10, width - padding.left - padding.right);
                                                return padding.left + (hoverValue.idx / (mathSamples.length - 1)) * innerW;
                                            })()}
                                            cy={(() => {
                                                const minVal = Math.min(...windowedSamples, -1);
                                                const maxVal = Math.max(...windowedSamples, 1);
                                                const range = maxVal - minVal || 1;
                                                const padding = { top: 8, bottom: 12 };
                                                const innerH = Math.max(10, 200 - padding.top - padding.bottom);
                                                return padding.top + (1 - (hoverValue.raw - minVal) / range) * innerH;
                                            })()}
                                            r={4}
                                            fill={token.colorPrimary}
                                        />
                                    ) : null}
                                </svg>
                                {zoomHint != null && zoomHintPos ? (
                                    <div
                                        style={{
                                            position: "absolute",
                                            left: zoomHintPos.x + 4,
                                            top: zoomHintPos.y + 4,
                                            padding: "6px 10px",
                                            borderRadius: 8,
                                            background: "rgba(0, 0, 0, 0.6)",
                                            color: "#fff",
                                            fontSize: 12,
                                            pointerEvents: "none",
                                        }}
                                    >
                                        {t(language, "sinePreviewZoom")}: {zoomHint.toFixed(1)}x
                                    </div>
                                ) : null}
                            </div>
                        </Card>

                        <Card title={t(language, "sineOutputCodeTitle")}>
                            <pre style={{ margin: 0, fontSize: 12, background: token.colorBgContainer, padding: 12 }}>
                                {outputCode}
                            </pre>
                        </Card>
                    </Space>
                </Layout.Content>
            </Layout>
        </Layout>
    );
}
