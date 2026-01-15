import { useState } from "react";
import { Form, Input, Space, Button, Modal, Checkbox, Divider, Radio, Typography, message } from "antd";
import { SaveOutlined, SettingOutlined } from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

type SaveSettingsValues = {
    configName: string;
    saveDir: string;
    rememberPath: boolean;
    includeOptions: boolean;
};

export default function SavePanel() {
    const { config, setConfig } = useFontJobStore();
    const { theme, language, setTheme, setLanguage } = useUiStore();
    const [openModal, setOpenModal] = useState(false);
    const [form] = Form.useForm<SaveSettingsValues>();

    const getRangeString = () => {
        const start = config.rangeStart?.codePointAt(0);
        const end = config.rangeEnd?.codePointAt(0);
        if (start == null || end == null) return "32-126";
        return `${start}-${end}`;
    };

    const doSaveSettings = async (values: SaveSettingsValues) => {
        let filename = (values.configName || "settings.json").trim() || "settings.json";
        if (!filename.toLowerCase().endsWith(".json")) {
            filename = `${filename}.json`;
            form.setFieldsValue({ configName: filename });
        }
        const dir = (values.saveDir || "").trim();
        const lastDir = values.rememberPath ? dir : "";
        const lastFile = values.rememberPath ? filename : "";

        const payload: any = {
            version: 1,
            font: {
                family: config.fontSourceMode === "system" ? (config.systemFontName ?? "") : (config.fontFilePath ?? ""),
                size: config.sizePx,
            },
            charset: {
                range: getRangeString(),
            },
            build: {
                name: config.moduleName,
            },
            meta: {
                rememberPath: values.rememberPath,
                lastDir,
                lastFile,
            },
        };

        if (values.includeOptions) {
            payload.build.options = {
                exportName: config.exportName,
                outputKind: config.outputKind,
                withComments: config.withComments,
                numberFormat: config.numberFormat,
                binarizeMode: config.binarizeMode,
                threshold: config.threshold,
                gamma: config.gamma,
                oversample: config.oversample,
                previewScale: config.previewScale,
                customChars: config.customChars,
                fallbackChar: config.fallbackChar,
                fontSourceMode: config.fontSourceMode,
                systemFontName: config.systemFontName,
                fontFilePath: config.fontFilePath,
                saveDir: config.saveDir,
                saveFileName: config.saveFileName,
            };
        }

        try {
            await invoke("save_settings", { dir, filename, json: JSON.stringify(payload, null, 2) });
            setConfig({ saveDir: dir || null, saveFileName: filename });
            message.success(t(language, "saveSettingsSuccess"));
            return true;
        } catch (err) {
            const msg = typeof err === "string" ? err : (err as Error)?.message || String(err);
            message.error(t(language, "saveSettingsFail", { msg }));
            return false;
        }
    };

    const handleOk = async () => {
        const values = await form.validateFields();
        const ok = await doSaveSettings(values);
        if (ok) setOpenModal(false);
    };

    const handleSelectPath = async () => {
        const selected = await open({ directory: true, multiple: false });
        if (!selected) return;
        const path = Array.isArray(selected) ? selected[0] : selected;
        form.setFieldsValue({ saveDir: path });
    };

    return (
        <>
            <Button
                className="navIconButton"
                shape="circle"
                icon={<SettingOutlined />}
                onClick={() => setOpenModal(true)}
            />

            <Modal
                title={
                    <Space size={8}>
                        <SaveOutlined />
                        <span>{t(language, "saveSettingsTitle")}</span>
                    </Space>
                }
                open={openModal}
                onOk={handleOk}
                onCancel={() => setOpenModal(false)}
                okText={t(language, "saveSettingsOk")}
                cancelText={t(language, "saveSettingsCancel")}
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        configName: "settings.json",
                        saveDir: config.saveDir ?? "",
                        rememberPath: true,
                        includeOptions: true,
                    }}
                >
                    <Form.Item
                        label={t(language, "saveSettingsConfigName")}
                        name="configName"
                        rules={[{ required: true, message: t(language, "saveSettingsConfigName") }]}
                    >
                        <Input placeholder="settings.json" />
                    </Form.Item>

                    <Form.Item label={t(language, "saveSettingsSaveDir")} name="saveDir">
                        <Space.Compact style={{ width: "100%" }}>
                            <Input readOnly placeholder={t(language, "saveSettingsSaveDir")} />
                            <Button onClick={handleSelectPath}>{t(language, "saveSettingsChoose")}</Button>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item name="rememberPath" valuePropName="checked">
                        <Checkbox>{t(language, "saveSettingsRememberPath")}</Checkbox>
                    </Form.Item>

                    <Form.Item name="includeOptions" valuePropName="checked">
                        <Checkbox>{t(language, "saveSettingsIncludeOptions")}</Checkbox>
                    </Form.Item>

                    <Divider />

                    <Form.Item label={t(language, "saveSettingsUiSection")}>
                        <Space direction="vertical" size={8} style={{ width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Typography.Text style={{ minWidth: 64 }}>
                                    {t(language, "saveSettingsTheme")}
                                </Typography.Text>
                                <Radio.Group
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    optionType="button"
                                    buttonStyle="solid"
                                >
                                    <Radio.Button value="light">{t(language, "saveSettingsThemeLight")}</Radio.Button>
                                    <Radio.Button value="dark">{t(language, "saveSettingsThemeDark")}</Radio.Button>
                                </Radio.Group>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <Typography.Text style={{ minWidth: 64 }}>
                                    {t(language, "saveSettingsLanguage")}
                                </Typography.Text>
                                <Radio.Group
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    optionType="button"
                                    buttonStyle="solid"
                                >
                                    <Radio.Button value="zh">{t(language, "languageZh")}</Radio.Button>
                                    <Radio.Button value="en">{t(language, "languageEn")}</Radio.Button>
                                </Radio.Group>
                            </div>
                        </Space>
                    </Form.Item>
                </Form>

            </Modal>
        </>
    );
}
