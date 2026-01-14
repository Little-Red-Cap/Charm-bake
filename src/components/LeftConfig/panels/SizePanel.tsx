import React from "react";
import { Form, InputNumber, Slider, Typography, Descriptions } from "antd";
import { useFontJobStore } from "../../../store/fontJob.store";

export default function SizePanel() {
    const { config, setConfig, result } = useFontJobStore();
    const stats = result?.stats;

    return (
        <Form layout="vertical">
            <Form.Item label="字号（像素高度）">
                <Slider
                    min={4}
                    max={64}
                    value={config.sizePx}
                    onChange={(v) => setConfig({ sizePx: v })}
                />
                <InputNumber
                    min={4}
                    max={128}
                    value={config.sizePx}
                    onChange={(v) => setConfig({ sizePx: Number(v) })}
                    style={{ width: "100%" }}
                />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                像素参考（示例）：5x7 常见字号约 8；8x16 常见字号约 16（后续可做更智能提示）
            </Typography.Text>

            <div style={{ marginTop: 12 }}>
                <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="line_height">{stats?.lineHeight ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="baseline">{stats?.baseline ?? "-"}</Descriptions.Item>
                </Descriptions>
            </div>
        </Form>
    );
}
