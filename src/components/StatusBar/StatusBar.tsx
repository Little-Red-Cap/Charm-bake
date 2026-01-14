import React from "react";
import { Space, Typography } from "antd";
import { useFontJobStore } from "../../store/fontJob.store";

export default function StatusBar() {
    const { status, result } = useFontJobStore();
    const s = result?.stats;

    return (
        <Space size="large" wrap>
            <Typography.Text type="secondary">状态：{status}</Typography.Text>
            {s ? (
                <>
                    <Typography.Text type="secondary">Glyphs: {s.glyphCount}</Typography.Text>
                    <Typography.Text type="secondary">Ranges: {s.rangeCount}</Typography.Text>
                    <Typography.Text type="secondary">Bitmap: {s.bitmapBytes} bytes</Typography.Text>
                    <Typography.Text type="secondary">Text: {s.textBytes} bytes</Typography.Text>
                </>
            ) : (
                <Typography.Text type="secondary">尚未生成</Typography.Text>
            )}
        </Space>
    );
}
