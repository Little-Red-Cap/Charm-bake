import { Card, Descriptions, Empty, List } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function StatsTab() {
    const { result } = useFontJobStore();
    const language = useUiStore((s) => s.language);
    const s = result?.stats;

    if (!s) return <Empty description={t(language, "statsEmpty")} />;

    return (
        <Card>
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label={t(language, "statsGlyphs")}>{s.glyphCount}</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsRanges")}>{s.rangeCount ?? "-"}</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsBitmapBytes")}>{s.bitmapBytes} bytes</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsTextBytes")}>{s.textBytes} bytes</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsMaxW")}>{s.maxW ?? "-"}</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsMaxH")}>{s.maxH ?? "-"}</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsLineHeight")}>{s.lineHeight ?? "-"}</Descriptions.Item>
                <Descriptions.Item label={t(language, "statsBaseline")}>{s.baseline ?? "-"}</Descriptions.Item>
            </Descriptions>

            {s.warnings?.length ? (
                <List
                    style={{ marginTop: 12 }}
                    size="small"
                    header={t(language, "statsWarnings")}
                    dataSource={s.warnings}
                    renderItem={(it) => <List.Item>{it}</List.Item>}
                />
            ) : null}
        </Card>
    );
}
