import React from "react";
import { Card, Descriptions, Empty, List } from "antd";
import { useFontJobStore } from "../../../store/fontJob.store";

export default function StatsTab() {
    const { result } = useFontJobStore();
    const s = result?.stats;

    if (!s) return <Empty description="尚无统计信息（先生成预览）" />;

    return (
        <Card>
            <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label="Glyph 数">{s.glyphCount}</Descriptions.Item>
                <Descriptions.Item label="Range 数">{s.rangeCount}</Descriptions.Item>
                <Descriptions.Item label="Bitmap 估算">{s.bitmapBytes} bytes</Descriptions.Item>
                <Descriptions.Item label="文本大小">{s.textBytes} bytes</Descriptions.Item>
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
