import { useMemo, useState } from "react";
import { Button, Card, Checkbox, Collapse, Form, Input, InputNumber, Layout, Radio, Select, Space, Typography, theme } from "antd";
import { useUiStore } from "../../store/ui.store";
import { t } from "../../domain/i18n";

type Segment = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "dp";

const DEFAULT_ORDER: Segment[] = ["a", "b", "c", "d", "e", "f", "g", "dp"];
const REVERSE_ORDER: Segment[] = ["dp", "g", "f", "e", "d", "c", "b", "a"];

const BASE_PATTERNS: Record<string, Segment[]> = {
    "0": ["a", "b", "c", "d", "e", "f"],
    "1": ["b", "c"],
    "2": ["a", "b", "g", "e", "d"],
    "3": ["a", "b", "g", "c", "d"],
    "4": ["f", "g", "b", "c"],
    "5": ["a", "f", "g", "c", "d"],
    "6": ["a", "f", "g", "e", "c", "d"],
    "7": ["a", "b", "c"],
    "8": ["a", "b", "c", "d", "e", "f", "g"],
    "9": ["a", "b", "c", "d", "f", "g"],
    A: ["a", "b", "c", "e", "f", "g"],
    B: ["c", "d", "e", "f", "g"],
    C: ["a", "d", "e", "f"],
    D: ["b", "c", "d", "e", "g"],
    E: ["a", "d", "e", "f", "g"],
    F: ["a", "e", "f", "g"],
};

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const HEX = ["A", "B", "C", "D", "E", "F"];
const CHARSET_OPTIONS = [
    ...DIGITS.map((v) => ({ label: v, value: v })),
    ...HEX.map((v) => ({ label: v, value: v })),
    { label: "SPACE", value: " " },
];

function parseSegmentOrder(raw: string): Segment[] | null {
    const tokens = raw
        .toLowerCase()
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => (t === "p" ? "dp" : t)) as Segment[];

    const unique = Array.from(new Set(tokens));
    const allSegments: Segment[] = ["a", "b", "c", "d", "e", "f", "g", "dp"];
    if (unique.length !== allSegments.length) return null;
    if (!unique.every((seg) => allSegments.includes(seg))) return null;
    return unique;
}

function encodeSegments(on: Set<Segment>, order: Segment[], bitOrder: "msb" | "lsb"): number {
    let value = 0;
    for (let i = 0; i < order.length; i += 1) {
        const seg = order[i];
        const bitIndex = bitOrder === "msb" ? order.length - 1 - i : i;
        if (on.has(seg)) value |= 1 << bitIndex;
    }
    return value;
}

function formatValue(value: number, format: "bin" | "dec" | "hex", bits: number): string {
    if (format === "dec") return String(value);
    if (format === "hex") {
        const width = Math.ceil(bits / 4);
        return `0x${value.toString(16).toUpperCase().padStart(width, "0")}`;
    }
    return `0b${value.toString(2).padStart(bits, "0")}`;
}

function macroNameForChar(ch: string): string {
    if (/^[0-9A-Z]$/.test(ch)) return ch;
    if (ch === " ") return "SPACE";
    const cp = ch.codePointAt(0);
    return cp ? `U${cp.toString(16).toUpperCase()}` : "UNK";
}

function SevenSegSvg({
    active,
    onToggle,
    size = 120,
}: {
    active: Set<Segment>;
    onToggle?: (seg: Segment) => void;
    size?: number;
}) {
    const w = size;
    const h = Math.round(size * 1.6);
    const t = Math.round(size * 0.16);
    const gap = Math.round(size * 0.08);
    const vLen = Math.round((h - 3 * t - 4 * gap) / 2);
    const segColor = "#ff4d4f";
    const offColor = "rgba(0, 0, 0, 0.08)";

    const segmentRect = (seg: Segment, x: number, y: number, width: number, height: number) => {
        const isOn = active.has(seg);
        return (
            <rect
                key={seg}
                x={x}
                y={y}
                width={width}
                height={height}
                rx={3}
                fill={isOn ? segColor : offColor}
                style={{ cursor: onToggle ? "pointer" : "default" }}
                onClick={onToggle ? () => onToggle(seg) : undefined}
            />
        );
    };

    return (
        <svg width={w} height={h}>
            {segmentRect("a", t, 0, w - 2 * t, t)}
            {segmentRect("f", 0, t + gap, t, vLen)}
            {segmentRect("b", w - t, t + gap, t, vLen)}
            {segmentRect("g", t, t + gap + vLen + gap, w - 2 * t, t)}
            {segmentRect("e", 0, t + gap + vLen + gap + t + gap, t, vLen)}
            {segmentRect("c", w - t, t + gap + vLen + gap + t + gap, t, vLen)}
            {segmentRect("d", t, t + gap + vLen + gap + t + gap + vLen + gap, w - 2 * t, t)}
            <circle
                cx={w - t / 2}
                cy={h - t / 2}
                r={Math.max(2, Math.round(t / 3))}
                fill={active.has("dp") ? segColor : offColor}
                style={{ cursor: onToggle ? "pointer" : "default" }}
                onClick={onToggle ? () => onToggle("dp") : undefined}
            />
        </svg>
    );
}

export default function SevenSegPage() {
    const { token } = theme.useToken();
    const uiTheme = useUiStore((s) => s.theme);
    const language = useUiStore((s) => s.language);

    const [polarity, setPolarity] = useState<"common_cathode" | "common_anode">("common_cathode");
    const [orderPreset, setOrderPreset] = useState<"forward" | "reverse" | "custom">("forward");
    const [customOrder, setCustomOrder] = useState("a b c d e f g dp");
    const [orderError, setOrderError] = useState<string | null>(null);
    const [segmentOrder, setSegmentOrder] = useState<Segment[]>(DEFAULT_ORDER);
    const [bitOrder, setBitOrder] = useState<"msb" | "lsb">("msb");
    const [format, setFormat] = useState<"bin" | "dec" | "hex">("bin");
    const [outputStyle, setOutputStyle] = useState<"array" | "macro" | "enum">("array");
    const [scanMode, setScanMode] = useState<"static" | "dynamic">("static");
    const [digitCount, setDigitCount] = useState(4);
    const [sampleText, setSampleText] = useState("0123");
    const [charset, setCharset] = useState<string[]>([...DIGITS]);
    const [editChar, setEditChar] = useState("0");
    const [overrides, setOverrides] = useState<Record<string, Segment[]>>({});

    const handlePresetChange = (value: "forward" | "reverse" | "custom") => {
        setOrderPreset(value);
        if (value === "forward") {
            setSegmentOrder(DEFAULT_ORDER);
            setOrderError(null);
        } else if (value === "reverse") {
            setSegmentOrder(REVERSE_ORDER);
            setOrderError(null);
        } else {
            const parsed = parseSegmentOrder(customOrder);
            if (parsed) {
                setSegmentOrder(parsed);
                setOrderError(null);
            } else {
                setOrderError(t(language, "sevenSegOrderHint"));
            }
        }
    };

    const handleCustomOrderChange = (value: string) => {
        setCustomOrder(value);
        const parsed = parseSegmentOrder(value);
        if (parsed) {
            setSegmentOrder(parsed);
            setOrderError(null);
        } else {
            setOrderError(t(language, "sevenSegOrderHint"));
        }
    };

    const availableChars = charset.length ? charset : [...DIGITS];
    const currentChar = availableChars.includes(editChar) ? editChar : availableChars[0];
    const previewChars = useMemo(() => {
        if (scanMode !== "dynamic") return availableChars;
        const padded = (sampleText || "").padEnd(digitCount, " ").slice(0, digitCount);
        return padded.split("").map((ch) => (availableChars.includes(ch) ? ch : " "));
    }, [availableChars, digitCount, sampleText, scanMode]);

    const segmentsForChar = (ch: string): Segment[] => overrides[ch] ?? BASE_PATTERNS[ch] ?? [];

    const onToggleSegment = (seg: Segment) => {
        const current = new Set(segmentsForChar(currentChar));
        if (current.has(seg)) current.delete(seg);
        else current.add(seg);
        setOverrides((prev) => ({ ...prev, [currentChar]: Array.from(current) }));
    };

    const onResetChar = () => {
        setOverrides((prev) => {
            const next = { ...prev };
            delete next[currentChar];
            return next;
        });
    };

    const outputCode = useMemo(() => {
        const bits = segmentOrder.length;
        const values = availableChars.map((ch) => {
            const on = new Set(segmentsForChar(ch));
            let value = encodeSegments(on, segmentOrder, bitOrder);
            if (polarity === "common_anode") {
                const mask = (1 << bits) - 1;
                value = mask ^ value;
            }
            return { ch, value };
        });
        const header = [
            `// order: ${segmentOrder.join(", ")}`,
            `// polarity: ${polarity}`,
            `// bit_order: ${bitOrder}`,
            `// scan: ${scanMode}`,
        ];

        let body: string[] = [];
        if (outputStyle === "macro") {
            body = values.map((entry) => `#define SEVENSEG_${macroNameForChar(entry.ch)} ${formatValue(entry.value, format, bits)}`);
        } else if (outputStyle === "enum") {
            body = [
                "enum SevenSegCode {",
                ...values.map((entry) => `  SEVENSEG_${macroNameForChar(entry.ch)} = ${formatValue(entry.value, format, bits)},`),
                "};",
            ];
        } else {
            const charsetString = values.map((entry) => entry.ch).join("");
            body = [
                `static const char sevenseg_charset[] = "${charsetString}";`,
                "static const uint8_t sevenseg_table[] = {",
                ...values.map((entry) => `  /* ${entry.ch} */ ${formatValue(entry.value, format, bits)},`),
                "};",
            ];
        }

        const tail: string[] = [];
        if (scanMode === "dynamic") {
            const digitBits = Math.max(1, digitCount);
            const digitLines = Array.from({ length: digitCount }, (_, i) => {
                const value = 1 << i;
                return `  ${formatValue(value, format, digitBits)},`;
            });
            tail.push("static const uint8_t sevenseg_digits[] = {", ...digitLines, "};");
        }

        return [...header, "", ...body, ...(tail.length ? ["", ...tail] : [])].join("\n");
    }, [availableChars, bitOrder, digitCount, format, outputStyle, overrides, polarity, scanMode, segmentOrder]);

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
                            defaultActiveKey={["config", "edit"]}
                            items={[
                                {
                                    key: "config",
                                    label: t(language, "sevenSegConfigTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "sevenSegPolarity")}>
                                                <Radio.Group
                                                    value={polarity}
                                                    onChange={(e) => setPolarity(e.target.value)}
                                                >
                                                    <Radio value="common_cathode">{t(language, "sevenSegCommonCathode")}</Radio>
                                                    <Radio value="common_anode">{t(language, "sevenSegCommonAnode")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>

                                            <Form.Item label={t(language, "sevenSegSegmentOrder")}>
                                                <Radio.Group
                                                    value={orderPreset}
                                                    onChange={(e) => handlePresetChange(e.target.value)}
                                                >
                                                    <Radio value="forward">{t(language, "sevenSegOrderPresetForward")}</Radio>
                                                    <Radio value="reverse">{t(language, "sevenSegOrderPresetReverse")}</Radio>
                                                    <Radio value="custom">{t(language, "sevenSegOrderCustom")}</Radio>
                                                </Radio.Group>
                                                {orderPreset === "custom" ? (
                                                    <Input
                                                        value={customOrder}
                                                        onChange={(e) => handleCustomOrderChange(e.target.value)}
                                                        placeholder={t(language, "sevenSegOrderPlaceholder")}
                                                        style={{ marginTop: 8 }}
                                                    />
                                                ) : null}
                                                {orderError ? (
                                                    <Typography.Text type="danger" style={{ fontSize: 12 }}>
                                                        {orderError}
                                                    </Typography.Text>
                                                ) : null}
                                            </Form.Item>

                                            <Form.Item label={t(language, "sevenSegBitOrder")}>
                                                <Radio.Group value={bitOrder} onChange={(e) => setBitOrder(e.target.value)}>
                                                    <Radio value="msb">{t(language, "sevenSegBitOrderMsb")}</Radio>
                                                    <Radio value="lsb">{t(language, "sevenSegBitOrderLsb")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>

                                            <Form.Item label={t(language, "sevenSegOutputFormat")}>
                                                <Radio.Group value={format} onChange={(e) => setFormat(e.target.value)}>
                                                    <Radio value="bin">{t(language, "numberFormatBin")}</Radio>
                                                    <Radio value="dec">{t(language, "numberFormatDec")}</Radio>
                                                    <Radio value="hex">{t(language, "numberFormatHex")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>

                                            <Form.Item label={t(language, "sevenSegOutputStyle")}>
                                                <Radio.Group value={outputStyle} onChange={(e) => setOutputStyle(e.target.value)}>
                                                    <Radio value="array">{t(language, "sevenSegOutputStyleArray")}</Radio>
                                                    <Radio value="macro">{t(language, "sevenSegOutputStyleMacro")}</Radio>
                                                    <Radio value="enum">{t(language, "sevenSegOutputStyleEnum")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>

                                            <Form.Item label={t(language, "sevenSegScanMode")}>
                                                <Radio.Group value={scanMode} onChange={(e) => setScanMode(e.target.value)}>
                                                    <Radio value="static">{t(language, "sevenSegScanStatic")}</Radio>
                                                    <Radio value="dynamic">{t(language, "sevenSegScanDynamic")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>

                                            {scanMode === "dynamic" ? (
                                                <>
                                                    <Form.Item label={t(language, "sevenSegDigitCount")}>
                                                        <InputNumber
                                                            min={1}
                                                            max={12}
                                                            value={digitCount}
                                                            onChange={(v) => setDigitCount(Number(v || 1))}
                                                            style={{ width: "100%" }}
                                                        />
                                                    </Form.Item>
                                                    <Form.Item label={t(language, "sevenSegSampleText")}>
                                                        <Input
                                                            value={sampleText}
                                                            onChange={(e) => setSampleText(e.target.value)}
                                                            placeholder={t(language, "sevenSegSamplePlaceholder")}
                                                        />
                                                    </Form.Item>
                                                </>
                                            ) : null}

                                            <Form.Item label={t(language, "sevenSegCharset")}>
                                                <Checkbox.Group
                                                    value={charset}
                                                    onChange={(vals) => setCharset(vals as string[])}
                                                    options={CHARSET_OPTIONS}
                                                />
                                            </Form.Item>
                                        </Form>
                                    ),
                                },
                                {
                                    key: "edit",
                                    label: t(language, "sevenSegEditorTitle"),
                                    children: (
                                        <Form layout="vertical">
                                            <Form.Item label={t(language, "sevenSegEditChar")}>
                                                <Select
                                                    value={currentChar}
                                                    onChange={(v) => setEditChar(v)}
                                                    options={availableChars.map((c) => ({ value: c, label: c }))}
                                                />
                                            </Form.Item>
                                            <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
                                                <SevenSegSvg
                                                    active={new Set(segmentsForChar(currentChar))}
                                                    onToggle={onToggleSegment}
                                                    size={120}
                                                />
                                            </div>
                                            <Button onClick={onResetChar}>{t(language, "sevenSegResetChar")}</Button>
                                        </Form>
                                    ),
                                },
                            ]}
                        />
                    </div>
                </Layout.Sider>

                <Layout.Content style={{ padding: 16, overflow: "auto", background: token.colorBgLayout }}>
                    <Space direction="vertical" size="large" style={{ width: "100%" }}>
                        <Card title={t(language, "sevenSegPreviewTitle")}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                                {previewChars.map((ch, index) => (
                                    <div key={`${ch}-${index}`} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                        <SevenSegSvg active={new Set(segmentsForChar(ch))} size={80} />
                                        <Typography.Text type="secondary" style={{ marginTop: 4 }}>
                                            {scanMode === "dynamic" ? `${index + 1}` : ch || " "}
                                        </Typography.Text>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card title={t(language, "sevenSegOutputTitle")}>
                            <Typography.Paragraph style={{ marginBottom: 8 }} type="secondary">
                                {t(language, "sevenSegOutputHint")}
                            </Typography.Paragraph>
                            <pre style={{ margin: 0, fontSize: 12, background: token.colorBgContainer, padding: 12 }}>
                                {outputCode}
                            </pre>
                        </Card>
                    </Space>
                </Layout.Content>
            </Layout>
            <Layout.Footer
                style={{
                    padding: "4px 12px",
                    background: token.colorBgContainer,
                    borderTop: `1px solid ${token.colorBorder}`,
                }}
            >
                <div className="compactStatusBar">
                    <Typography.Text type="secondary">7-Seg</Typography.Text>
                </div>
            </Layout.Footer>
        </Layout>
    );
}
