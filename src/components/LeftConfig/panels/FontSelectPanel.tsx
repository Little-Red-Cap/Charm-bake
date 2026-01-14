import React from "react";
import { Form, Input, Radio, Space, Button, Typography } from "antd";
import { open } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../../store/fontJob.store";

export default function FontSelectPanel() {
    const { config, setConfig } = useFontJobStore();

    const pickSystemFontFile = async () => {
        const selected = await open({
            multiple: false,
            filters: [{ name: "Font", extensions: ["ttf", "otf"] }],
        });
        if (!selected) return;
        const path = Array.isArray(selected) ? selected[0] : selected;
        setConfig({ systemFontName: path, fontFilePath: null });
    };

    const pickFontFile = async () => {
        const selected = await open({
            multiple: false,
            filters: [{ name: "Font", extensions: ["ttf", "otf"] }],
        });
        if (!selected) return;
        const path = Array.isArray(selected) ? selected[0] : selected;
        setConfig({ fontFilePath: path, systemFontName: null });
    };

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
                <Form.Item label="系统字体（临时使用文件路径）">
                    <Space.Compact style={{ width: "100%" }}>
                        <Input
                            readOnly
                            value={config.systemFontName ?? ""}
                            placeholder="选择系统字体文件（.ttf/.otf）"
                        />
                        <Button onClick={pickSystemFontFile}>选择文件</Button>
                    </Space.Compact>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        方案 A：暂用字体文件路径代替系统字体枚举。
                    </Typography.Text>
                </Form.Item>
            ) : (
                <Form.Item label="字体文件路径">
                    <Space.Compact style={{ width: "100%" }}>
                        <Input
                            readOnly
                            value={config.fontFilePath ?? ""}
                            placeholder="选择 .ttf/.otf 文件"
                        />
                        <Button onClick={pickFontFile}>选择文件</Button>
                    </Space.Compact>
                </Form.Item>
            )}
        </Form>
    );
}
