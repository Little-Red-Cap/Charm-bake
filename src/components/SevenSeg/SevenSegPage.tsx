import { useEffect, useMemo, useState } from "react";
import { Button, Card, Checkbox, Collapse, Form, Input, InputNumber, Layout, Radio, Select, Space, Typography, theme } from "antd";
import { useUiStore } from "../../store/ui.store";
import { t } from "../../domain/i18n";
import { formatNumber } from "../../domain/format";
import CodeEditor from "../common/CodeEditor";
import SplitPane from "../common/SplitPane";

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

const PREVIEW_MIN_HEIGHT = 240;
const CODE_MIN_HEIGHT = 240;

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

function macroNameForChar(ch: string): string {
    if (/^[0-9A-Z]$/.test(ch)) return ch;
    if (ch === " ") return "SPACE";
    const cp = ch.codePointAt(0);
    return cp ? `U${cp.toString(16).toUpperCase()}` : "UNK";
}

function SevenSegSvg({
    active,
    onToggle,
    highlight = false,
    size = 120,
}: {
    active: Set<Segment>;
    onToggle?: (seg: Segment) => void;
    highlight?: boolean;
    size?: number;
}) {
    const w = size;
    const h = Math.round(size * 1.6);
    const t = Math.round(size * 0.16);
    const gap = Math.round(size * 0.08);
    const vLen = Math.round((h - 3 * t - 4 * gap) / 2);
    const segColor = highlight ? "#ff4d4f" : "#ff7875";
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
        <svg width={w} height={h} style={{ filter: highlight ? "drop-shadow(0 0 6px rgba(255, 77, 79, 0.6))" : "none" }}>
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
    const [outputPrefix, setOutputPrefix] = useState("SEVENSEG");
    const [arrayName, setArrayName] = useState("sevenseg_table");
    const [charsetName, setCharsetName] = useState("sevenseg_charset");
    const [enumName, setEnumName] = useState("SevenSegCode");
    const [digitsName, setDigitsName] = useState("sevenseg_digits");
    const [scanMode, setScanMode] = useState<"static" | "dynamic">("static");
    const [digitPolarity, setDigitPolarity] = useState<"active_high" | "active_low">("active_high");
    const [digitOrderPreset, setDigitOrderPreset] = useState<"forward" | "reverse" | "custom">("forward");
    const [digitCustomOrder, setDigitCustomOrder] = useState("");
    const [digitOrder, setDigitOrder] = useState<number[]>([0, 1, 2, 3]);
    const [digitOrderError, setDigitOrderError] = useState<string | null>(null);
    const [activeDigit, setActiveDigit] = useState(0);
    const [autoScan, setAutoScan] = useState(true);
    const [scanInterval, setScanInterval] = useState(200);
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

    useEffect(() => {
        if (scanMode !== "dynamic" || !autoScan) return;
        const handle = setInterval(() => {
            setActiveDigit((prev) => (prev + 1) % Math.max(1, digitCount));
        }, scanInterval);
        return () => clearInterval(handle);
    }, [autoScan, digitCount, scanInterval, scanMode]);

    useEffect(() => {
        if (activeDigit >= digitCount) setActiveDigit(0);
    }, [activeDigit, digitCount]);

    const digitValues = useMemo(() => {
        if (scanMode !== "dynamic") return [];
        const digitBits = Math.max(1, digitCount);
        return Array.from({ length: digitCount }, (_, i) => {
            const mapped = digitOrder[i] ?? i;
            let value = 1 << mapped;
            if (digitPolarity === "active_low") {
                const mask = (1 << digitBits) - 1;
                value = mask ^ value;
            }
            return formatNumber(value, format, digitBits);
        });
    }, [digitCount, digitOrder, digitPolarity, format, scanMode]);

    const handleDigitOrderPreset = (value: "forward" | "reverse" | "custom") => {
        setDigitOrderPreset(value);
        if (value === "forward") {
            setDigitOrder(Array.from({ length: digitCount }, (_, i) => i));
            setDigitCustomOrder("");
            setDigitOrderError(null);
        } else if (value === "reverse") {
            setDigitOrder(Array.from({ length: digitCount }, (_, i) => digitCount - 1 - i));
            setDigitCustomOrder("");
            setDigitOrderError(null);
        } else {
            const parsed = digitCustomOrder
                .split(/[\s,]+/)
                .map((v) => v.trim())
                .filter(Boolean)
                .map((v) => Number(v));
            if (parsed.length === digitCount && parsed.every((v) => Number.isInteger(v) && v >= 0)) {
                setDigitOrder(parsed);
                setDigitOrderError(null);
            } else {
                setDigitOrderError(t(language, "sevenSegDigitOrderHint"));
            }
        }
    };

    const handleDigitCustomOrder = (value: string) => {
        setDigitCustomOrder(value);
        const parsed = value
            .split(/[\s,]+/)
            .map((v) => v.trim())
            .filter(Boolean)
            .map((v) => Number(v));
        if (parsed.length === digitCount && parsed.every((v) => Number.isInteger(v) && v >= 0)) {
            setDigitOrder(parsed);
            setDigitOrderError(null);
        } else {
            setDigitOrderError(t(language, "sevenSegDigitOrderHint"));
        }
    };

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
            body = values.map((entry) => `#define ${outputPrefix}_${macroNameForChar(entry.ch)} ${formatNumber(entry.value, format, bits)}`);
        } else if (outputStyle === "enum") {
            body = [
                `enum ${enumName} {`,
                ...values.map((entry) => `  ${outputPrefix}_${macroNameForChar(entry.ch)} = ${formatNumber(entry.value, format, bits)},`),
                "};",
            ];
        } else {
            const charsetString = values.map((entry) => entry.ch).join("");
            body = [
                `static const char ${charsetName}[] = "${charsetString}";`,
                `static const uint8_t ${arrayName}[] = {`,
                ...values.map((entry) => `  /* ${entry.ch} */ ${formatNumber(entry.value, format, bits)},`),
                "};",
            ];
        }

        const tail: string[] = [];
        if (scanMode === "dynamic") {
            const digitBits = Math.max(1, digitCount);
            const digitLines = Array.from({ length: digitCount }, (_, i) => {
                const mapped = digitOrder[i] ?? i;
                let value = 1 << mapped;
                if (digitPolarity === "active_low") {
                    const mask = (1 << digitBits) - 1;
                    value = mask ^ value;
                }
                return `  ${formatNumber(value, format, digitBits)},`;
            });
            tail.push(`static const uint8_t ${digitsName}[] = {`, ...digitLines, "};");
        }

        return [...header, "", ...body, ...(tail.length ? ["", ...tail] : [])].join("\n");
    }, [
        availableChars,
        bitOrder,
        digitCount,
        digitOrder,
        digitPolarity,
        format,
        outputStyle,
        outputPrefix,
        arrayName,
        charsetName,
        enumName,
        digitsName,
        overrides,
        polarity,
        scanMode,
        segmentOrder,
    ]);

    

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

                                            <Form.Item label={t(language, "sevenSegOutputNames")}>
                                                <Space direction="vertical" style={{ width: "100%" }}>
                                                    <Input
                                                        value={outputPrefix}
                                                        onChange={(e) => setOutputPrefix(e.target.value)}
                                                        placeholder={t(language, "sevenSegOutputPrefix")}
                                                    />
                                                    {outputStyle === "array" ? (
                                                        <>
                                                            <Input
                                                                value={charsetName}
                                                                onChange={(e) => setCharsetName(e.target.value)}
                                                                placeholder={t(language, "sevenSegCharsetName")}
                                                            />
                                                            <Input
                                                                value={arrayName}
                                                                onChange={(e) => setArrayName(e.target.value)}
                                                                placeholder={t(language, "sevenSegArrayName")}
                                                            />
                                                        </>
                                                    ) : null}
                                                    {outputStyle === "enum" ? (
                                                        <Input
                                                            value={enumName}
                                                            onChange={(e) => setEnumName(e.target.value)}
                                                            placeholder={t(language, "sevenSegEnumName")}
                                                        />
                                                    ) : null}
                                                    {scanMode === "dynamic" ? (
                                                        <Input
                                                            value={digitsName}
                                                            onChange={(e) => setDigitsName(e.target.value)}
                                                            placeholder={t(language, "sevenSegDigitsName")}
                                                        />
                                                    ) : null}
                                                </Space>
                                            </Form.Item>

                                            <Form.Item label={t(language, "sevenSegScanMode")}>
                                                <Radio.Group value={scanMode} onChange={(e) => setScanMode(e.target.value)}>
                                                    <Radio value="static">{t(language, "sevenSegScanStatic")}</Radio>
                                                    <Radio value="dynamic">{t(language, "sevenSegScanDynamic")}</Radio>
                                                </Radio.Group>
                                            </Form.Item>

                                            {scanMode === "dynamic" ? (
                                                <>
                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                        {t(language, "sevenSegScanSection")}
                                                    </Typography.Text>
                                                    <Form.Item label={t(language, "sevenSegSampleText")}>
                                                        <Input
                                                            value={sampleText}
                                                            onChange={(e) => setSampleText(e.target.value)}
                                                            placeholder={t(language, "sevenSegSamplePlaceholder")}
                                                        />
                                                    </Form.Item>
                                                    <Form.Item label={t(language, "sevenSegScanAuto")}>
                                                        <Radio.Group value={autoScan ? "on" : "off"} onChange={(e) => setAutoScan(e.target.value === "on")}>
                                                            <Radio value="on">{t(language, "sevenSegScanAutoOn")}</Radio>
                                                            <Radio value="off">{t(language, "sevenSegScanAutoOff")}</Radio>
                                                        </Radio.Group>
                                                    </Form.Item>
                                                    <Form.Item label={t(language, "sevenSegScanInterval")}>
                                                        <InputNumber
                                                            min={50}
                                                            max={1000}
                                                            step={10}
                                                            value={scanInterval}
                                                            onChange={(v) => setScanInterval(Number(v || 200))}
                                                            style={{ width: "100%" }}
                                                            addonAfter="ms"
                                                        />
                                                    </Form.Item>
                                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                                        {t(language, "sevenSegDigitSection")}
                                                    </Typography.Text>
                                                    <Form.Item label={t(language, "sevenSegDigitCount")}>
                                                        <InputNumber
                                                            min={1}
                                                            max={12}
                                                            value={digitCount}
                                                            onChange={(v) => setDigitCount(Number(v || 1))}
                                                            style={{ width: "100%" }}
                                                        />
                                                    </Form.Item>
                                                    <Form.Item label={t(language, "sevenSegDigitPolarity")}>
                                                        <Radio.Group
                                                            value={digitPolarity}
                                                            onChange={(e) => setDigitPolarity(e.target.value)}
                                                        >
                                                            <Radio value="active_high">{t(language, "sevenSegDigitActiveHigh")}</Radio>
                                                            <Radio value="active_low">{t(language, "sevenSegDigitActiveLow")}</Radio>
                                                        </Radio.Group>
                                                    </Form.Item>
                                                    <Form.Item label={t(language, "sevenSegDigitOrder")}>
                                                        <Radio.Group
                                                            value={digitOrderPreset}
                                                            onChange={(e) => handleDigitOrderPreset(e.target.value)}
                                                        >
                                                            <Radio value="forward">{t(language, "sevenSegOrderPresetForward")}</Radio>
                                                            <Radio value="reverse">{t(language, "sevenSegOrderPresetReverse")}</Radio>
                                                            <Radio value="custom">{t(language, "sevenSegOrderCustom")}</Radio>
                                                        </Radio.Group>
                                                        {digitOrderPreset === "custom" ? (
                                                            <Input
                                                                value={digitCustomOrder}
                                                                onChange={(e) => handleDigitCustomOrder(e.target.value)}
                                                                placeholder={t(language, "sevenSegDigitOrderPlaceholder")}
                                                                style={{ marginTop: 8 }}
                                                            />
                                                        ) : null}
                                                        {digitOrderError ? (
                                                            <Typography.Text type="danger" style={{ fontSize: 12 }}>
                                                                {digitOrderError}
                                                            </Typography.Text>
                                                        ) : null}
                                                    </Form.Item>
                                                    <Form.Item label={t(language, "sevenSegActiveDigit")}>
                                                        <InputNumber
                                                            min={1}
                                                            max={digitCount}
                                                            value={Math.min(activeDigit + 1, digitCount)}
                                                            disabled={autoScan}
                                                            onChange={(v) => setActiveDigit(Math.max(0, Number(v || 1) - 1))}
                                                            style={{ width: "100%" }}
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

                <Layout.Content style={{ padding: 16, overflow: "hidden", background: token.colorBgLayout }}>
                    <SplitPane
                        minTop={PREVIEW_MIN_HEIGHT}
                        minBottom={CODE_MIN_HEIGHT}
                        initialRatio={0.6}
                        handleStyle={{ background: token.colorFillSecondary }}
                        top={
                            <Card title={t(language, "sevenSegPreviewTitle")}>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                                    {previewChars.map((ch, index) => {
                                        const isActive = scanMode === "dynamic" && index === activeDigit;
                                        return (
                                            <div
                                                key={`${ch}-${index}`}
                                                className={`sevensegDigit ${scanMode === "dynamic" ? "isScanning" : ""} ${isActive ? "isActive" : ""}`}
                                                style={{
                                                    display: "flex",
                                                    flexDirection: "column",
                                                    alignItems: "center",
                                                    padding: 6,
                                                    borderRadius: 8,
                                                    border: isActive ? `1px solid ${token.colorPrimary}` : "1px solid transparent",
                                                    background: isActive ? token.colorPrimaryBg : "transparent",
                                                    color: token.colorText,
                                                }}
                                            >
                                                <SevenSegSvg active={new Set(segmentsForChar(ch))} size={80} highlight={isActive} />
                                                <Typography.Text type="secondary" style={{ marginTop: 4 }}>
                                                    {scanMode === "dynamic" ? `${index + 1}` : ch || " "}
                                                </Typography.Text>
                                                {scanMode === "dynamic" ? (
                                                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                                        {digitValues[index] ?? ""}
                                                    </Typography.Text>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Card>
                        }
                        bottom={
                            <Card
                                title={t(language, "sevenSegOutputTitle")}
                                style={{ height: "100%" }}
                                styles={{ body: { padding: 0, height: "100%" } }}
                            >
                                <div style={{ padding: "8px 12px" }}>
                                    <Typography.Paragraph style={{ marginBottom: 8 }} type="secondary">
                                        {t(language, "sevenSegOutputHint")}
                                    </Typography.Paragraph>
                                </div>
                                <CodeEditor value={outputCode} height="100%" />
                            </Card>
                        }
                    />
                </Layout.Content>
            </Layout>
        </Layout>
    );
}
