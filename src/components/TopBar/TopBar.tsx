import { Button, Space, Tooltip, message } from "antd";
import { CopyOutlined, PlayCircleOutlined, SaveOutlined } from "@ant-design/icons";
import { save } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../store/fontjob.store";
import { exportFont } from "../../services/generator/generator";

export default function TopBar() {
    const { config, status, result, generate } = useFontJobStore();
    const [msgApi, contextHolder] = message.useMessage();

    const onCopy = async () => {
        if (!result?.code) return;
        await navigator.clipboard.writeText(result.code);
        msgApi.success("已复制到剪贴板");
    };

    const onSave = async () => {
        if (!result?.code) return;
        const selected = await save({
            defaultPath: config.saveFileName || "font.cppm",
            filters: [{ name: "C++ Module", extensions: ["cppm"] }],
        });
        if (!selected) return;
        const normalized = selected.replace(/\\/g, "/");
        const filename = normalized.split("/").pop() || config.saveFileName;
        try {
            const outputPath = await exportFont(config, selected, filename);
            msgApi.success(`已保存：${outputPath || config.saveFileName}`);
        } catch (e: any) {
            msgApi.error(e?.message || String(e));
        }
    };

    return (
        <>
            {contextHolder}
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <Space>
                    <Tooltip title="生成预览">
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            loading={status === "generating"}
                            onClick={() => generate()}
                        >
                            生成预览
                        </Button>
                    </Tooltip>

                    <Button icon={<CopyOutlined />} disabled={!result?.code} onClick={onCopy}>
                        复制
                    </Button>

                    <Button icon={<SaveOutlined />} disabled={!result?.code} onClick={onSave}>
                        保存
                    </Button>
                </Space>
            </div>
        </>
    );
}
