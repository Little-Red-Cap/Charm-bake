import { Card, Descriptions, Empty, List } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";

export default function StatsTab() {
    const { result } = useFontJobStore();
    const s = result?.stats;

    if (!s) return <Empty description="尚无统计信息（先生成预览）" />;

    return (
        <Card>
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Glyphs">{s.glyphCount}</Descriptions.Item>
                <Descriptions.Item label="Ranges">{s.rangeCount ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="Bitmap bytes">{s.bitmapBytes} bytes</Descriptions.Item>
                <Descriptions.Item label="Text bytes">{s.textBytes} bytes</Descriptions.Item>
                <Descriptions.Item label="max_w">{s.maxW ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="max_h">{s.maxH ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="line_height">{s.lineHeight ?? "-"}</Descriptions.Item>
                <Descriptions.Item label="baseline">{s.baseline ?? "-"}</Descriptions.Item>
            </Descriptions>

            {s.warnings?.length ? (
                <List
                    style={{ marginTop: 12 }}
                    size="small"
                    header="Warnings"
                    dataSource={s.warnings}
                    renderItem={(it) => <List.Item>{it}</List.Item>}
                />
            ) : null}
        </Card>
    );
}
