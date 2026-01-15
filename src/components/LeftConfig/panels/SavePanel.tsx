import { useState } from "react";
import { Form, Input, Space, Button, Modal, Checkbox, message } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../../store/fontjob.store";

type SaveSettingsValues = {
    configName: string;
    saveDir: string;
    rememberPath: boolean;
    includeOptions: boolean;
};

export default function SavePanel() {
    const { config, setConfig } = useFontJobStore();
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
            message.success("保存成功");
            return true;
        } catch (err) {
            const msg = typeof err === "string" ? err : (err as Error)?.message || String(err);
            message.error(`保存失败：${msg}`);
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
            <Button type="primary" onClick={() => setOpenModal(true)}>
                保存设置
            </Button>

            <Modal
                title="保存设置"
                open={openModal}
                onOk={handleOk}
                onCancel={() => setOpenModal(false)}
                okText="确定"
                cancelText="取消"
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
                        label="配置名"
                        name="configName"
                        rules={[{ required: true, message: "请输入配置名" }]}
                    >
                        <Input placeholder="settings.json" />
                    </Form.Item>

                    <Form.Item label="保存路径" name="saveDir">
                        <Space.Compact style={{ width: "100%" }}>
                            <Input readOnly placeholder="选择保存路径" />
                            <Button onClick={handleSelectPath}>选择</Button>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item name="rememberPath" valuePropName="checked">
                        <Checkbox>记住路径</Checkbox>
                    </Form.Item>

                    <Form.Item name="includeOptions" valuePropName="checked">
                        <Checkbox>包含生成选项</Checkbox>
                    </Form.Item>
                </Form>

            </Modal>
        </>
    );
}
