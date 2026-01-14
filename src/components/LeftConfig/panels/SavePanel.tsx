import React, { useState } from "react";
import { Form, Input, Space, Button, Typography, Modal, Checkbox } from "antd";
import { useFontJobStore } from "../../../store/fontJob.store";

type SaveSettingsValues = {
    configName: string;
    savePath: string;
    rememberPath: boolean;
    includeOptions: boolean;
};

export default function SavePanel() {
    const { config } = useFontJobStore();
    const [open, setOpen] = useState(false);
    const [form] = Form.useForm<SaveSettingsValues>();

    const doSaveSettings = (values: SaveSettingsValues) => {
        console.log("save settings", values);
    };

    const handleOk = async () => {
        const values = await form.validateFields();
        doSaveSettings(values);
        setOpen(false);
    };

    return (
        <>
            <Button type="primary" onClick={() => setOpen(true)}>
                保存设置
            </Button>

            <Modal
                title="保存设置"
                open={open}
                onOk={handleOk}
                onCancel={() => setOpen(false)}
                okText="确定"
                cancelText="取消"
            >
                <Form
                    form={form}
                    layout="vertical"
                    initialValues={{
                        configName: "settings.json",
                        savePath: config.saveDir ?? "",
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

                    <Form.Item label="保存路径" name="savePath">
                        <Space.Compact style={{ width: "100%" }}>
                            <Input readOnly placeholder="选择保存路径" />
                            <Button>选择</Button>
                        </Space.Compact>
                    </Form.Item>

                    <Form.Item name="rememberPath" valuePropName="checked">
                        <Checkbox>记住路径</Checkbox>
                    </Form.Item>

                    <Form.Item name="includeOptions" valuePropName="checked">
                        <Checkbox>包含生成选项</Checkbox>
                    </Form.Item>
                </Form>

                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    TODO：接入 Tauri fs.writeFile
                </Typography.Text>
            </Modal>
        </>
    );
}
