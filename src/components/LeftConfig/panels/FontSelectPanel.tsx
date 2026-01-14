import React, { useMemo } from "react";
import { Form, Input, Radio, Select, Space, Button, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontJob.store";

const MOCK_SYSTEM_FONTS = [
    "Microsoft YaHei UI",
    "SimSun",
    "Consolas",
    "Arial",
    "JetBrains Mono",
    "Noto Sans CJK SC",
];

export default function FontSelectPanel() {
    const { config, setConfig, applySuggestedNames } = useFontJobStore();

    const fontOptions = useMemo(
        () => MOCK_SYSTEM_FONTS.map((f) => ({ label: f, value: f })),
        []
    );

    return (
        <Form layout="vertical">
            <Form.Item label="字体来源">
                <Radio.Group
                    value={config.fontSourceMode}
                    onChange={(e) => setConfig({ fontSourceMode: e.target.value })}
                >
                    <Radio value="system">系统字体</Radio>
                    <Radio value="file">字体文件</Radio>
                </Radio.Group>
            </Form.Item>

            {config.fontSourceMode === "system" ? (
                <Form.Item label="系统字体">
                    <Select
                        showSearch
                        value={config.systemFontName ?? undefined}
                        placeholder="选择系统字体（TODO: Tauri 枚举）"
                        options={fontOptions}
                        onChange={(v) => setConfig({ systemFontName: v, fontFilePath: null })}
                    />
                </Form.Item>
            ) : (
                <Form.Item label="字体文件路径">
                    <Space.Compact style={{ width: "100%" }}>
                        <Input
                            value={config.fontFilePath ?? ""}
                            placeholder="选择 .ttf/.otf 文件（TODO: Tauri dialog.open）"
                            onChange={(e) => setConfig({ fontFilePath: e.target.value, systemFontName: null })}
                        />
                        <Button onClick={() => setConfig({ fontFilePath: "C:\\path\\to\\font.ttf", systemFontName: null })}>
                            选择文件
                        </Button>
                    </Space.Compact>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        后续这里接 Tauri 文件对话框。
                    </Typography.Text>
                </Form.Item>
            )}

            <Form.Item>
                <Button onClick={() => applySuggestedNames()}>按当前字体/字号生成默认命名</Button>
            </Form.Item>
        </Form>
    );
}
