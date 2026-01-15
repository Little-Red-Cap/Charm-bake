export type NumberFormat = "bin" | "dec" | "hex";

export function formatNumber(value: number, format: NumberFormat, bits?: number): string {
    if (format === "dec") return String(value);
    if (format === "hex") {
        const width = bits ? Math.ceil(bits / 4) : 0;
        const text = value.toString(16).toUpperCase();
        return `0x${width > 0 ? text.padStart(width, "0") : text}`;
    }
    const width = bits ?? 0;
    const text = value.toString(2);
    return `0b${width > 0 ? text.padStart(width, "0") : text}`;
}
