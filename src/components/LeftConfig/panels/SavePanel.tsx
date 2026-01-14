import React from "react";
import { Form, Input, Space, Button, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontJob.store";

export default function SavePanel() {
    const { config, setConfig } = useFontJobStore();

    return (
        <Form layout="vertical">
            <Form.Item label="保存目录（任意目录）">
                <Space.Compact style={{ width: "100%" }}>
                    <Input
                        value={config.saveDir ?? ""}
                        placeholder="TODO: 选择目录（Tauri dialog.open directory）"
                        onChange={(e) => setConfig({ saveDir: e.target.value })}
                    />
                    <Button onClick={() => setConfig({ saveDir: "C:\\output" })}>选择目录</Button>
                </Space.Compact>
            </Form.Item>

            <Form.Item label="保存文件名">
                <Input value={config.saveFileName} onChange={(e) => setConfig({ saveFileName: e.target.value })} />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                TODO：接入 Tauri fs.writeFile；并显示预计写入大小
            </Typography.Text>
        </Form>
    );
}
