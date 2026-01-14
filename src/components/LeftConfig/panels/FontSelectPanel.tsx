import React, { useEffect, useMemo, useState } from "react";
import { Form, Input, Radio, Space, Button, Typography, Select } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../../store/fontJob.store";

export default function FontSelectPanel() {
    const { config, setConfig } = useFontJobStore();
    const [systemFonts, setSystemFonts] = useState<Array<{ family: string; path: string }>>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const result = await invoke<Array<{ family: string; path: string }>>("list_system_fonts");
                if (active) setSystemFonts(result);
            } catch (err) {
                console.warn("Failed to load system fonts", err);
            } finally {
                if (active) setLoading(false);
            }
        };
        load();
        return () => {
            active = false;
        };
    }, []);

    const fontOptions = useMemo(
        () => systemFonts.map((f) => ({ label: f.family, value: f.path })),
        [systemFonts]
    );

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
                <Form.Item label="系统字体">
                    <Select
                        showSearch
                        loading={loading}
                        value={config.systemFontName ?? undefined}
                        placeholder={loading ? "加载中..." : "选择系统字体"}
                        options={fontOptions}
                        onChange={(v) => setConfig({ systemFontName: v, fontFilePath: null })}
                        filterOption={(input, option) =>
                            (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())
                        }
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        枚举系统字体（按名称显示，内部使用字体文件路径）。
                    </Typography.Text>
                </Form.Item>
            ) : (
                <Form.Item label="字体文件路径">
                    <Space.Compact style={{ width: "100%" }}>
                        <Input
                            value={config.fontFilePath ?? ""}
                            placeholder="选择 .ttf/.otf 文件"
                            onChange={(e) => setConfig({ fontFilePath: e.target.value, systemFontName: null })}
                        />
                        <Button onClick={pickFontFile}>选择文件</Button>
                    </Space.Compact>
                </Form.Item>
            )}
        </Form>
    );
}
