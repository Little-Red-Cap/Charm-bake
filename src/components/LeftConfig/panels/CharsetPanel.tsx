import React from "react";
import { Form, Input, Space, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontJob.store";

export default function CharsetPanel() {
    const { config, setConfig } = useFontJobStore();

    const startCode = config.rangeStart.codePointAt(0);
    const endCode = config.rangeEnd.codePointAt(0);

    return (
        <Form layout="vertical">
            <Form.Item label="字符范围（单字符）">
                <Space style={{ width: "100%" }} align="start">
                    <Input
                        maxLength={2}
                        value={config.rangeStart}
                        onChange={(e) => setConfig({ rangeStart: e.target.value })}
                        style={{ width: 80 }}
                    />
                    <Typography.Text style={{ paddingTop: 6 }}>到</Typography.Text>
                    <Input
                        maxLength={2}
                        value={config.rangeEnd}
                        onChange={(e) => setConfig({ rangeEnd: e.target.value })}
                        style={{ width: 80 }}
                    />
                    <div style={{ paddingTop: 6, opacity: 0.7 }}>
                        {startCode != null && endCode != null ? `码点：${startCode} - ${endCode}` : null}
                    </div>
                </Space>
            </Form.Item>

            <Form.Item label="自定义字符（会与范围合并、去重）">
                <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={config.customChars}
                    onChange={(e) => setConfig({ customChars: e.target.value })}
                    placeholder="例如：℃★你好"
                />
            </Form.Item>

            <Form.Item label="Fallback 字符（缺字时使用）">
                <Input
                    maxLength={2}
                    value={config.fallbackChar}
                    onChange={(e) => setConfig({ fallbackChar: e.target.value })}
                    style={{ width: 100 }}
                />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                TODO：显示最终字符集数量、重复字符提示、码点列表视图
            </Typography.Text>
        </Form>
    );
}
