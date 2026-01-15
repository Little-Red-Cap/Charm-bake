import { useEffect, useMemo, useState } from "react";
import { Form, Input, Radio, Space, Button, Typography, Select } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function FontSelectPanel() {
    const { config, setConfig } = useFontJobStore();
    const language = useUiStore((s) => s.language);
    const [systemFonts, setSystemFonts] = useState<Array<{ family: string }>>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            setLoading(true);
            try {
                const result = await invoke<Array<{ family: string }>>("list_system_fonts");
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
        () => systemFonts.map((f) => ({ label: f.family, value: f.family })),
        [systemFonts]
    );

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
        <Form layout="horizontal" labelCol={{ flex: "0 0 72px" }} wrapperCol={{ flex: "1 1 0" }}>
            <Form.Item label={t(language, "fontSource")}>
                <Radio.Group
                    value={config.fontSourceMode}
                    onChange={(e) => setConfig({ fontSourceMode: e.target.value })}
                >
                    <Radio value="system">{t(language, "fontSourceSystem")}</Radio>
                    <Radio value="file">{t(language, "fontSourceFile")}</Radio>
                </Radio.Group>
            </Form.Item>

            {config.fontSourceMode === "system" ? (
                <Form.Item label={t(language, "systemFontLabel")}>
                    <Select
                        showSearch
                        loading={loading}
                        virtual={false}
                        dropdownStyle={{ maxHeight: 320, overflow: "auto" }}
                        value={config.systemFontName ?? undefined}
                        placeholder={loading ? t(language, "systemFontLoading") : t(language, "systemFontSelect")}
                        options={fontOptions}
                        onChange={(v) => setConfig({ systemFontName: v, fontFilePath: null })}
                        optionFilterProp="label"
                    />
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t(language, "systemFontHint")}
                    </Typography.Text>
                </Form.Item>
            ) : (
                <Form.Item label={t(language, "filePathLabel")}>
                    <Space.Compact style={{ width: "100%" }}>
                        <Input
                            value={config.fontFilePath ?? ""}
                            placeholder={t(language, "filePathPlaceholder")}
                            onChange={(e) => setConfig({ fontFilePath: e.target.value, systemFontName: null })}
                        />
                        <Button onClick={pickFontFile}>{t(language, "chooseFile")}</Button>
                    </Space.Compact>
                </Form.Item>
            )}
        </Form>
    );
}
