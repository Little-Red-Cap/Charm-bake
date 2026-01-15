import { Button, Space, Tooltip, message } from "antd";
import { CopyOutlined, PlayCircleOutlined, SaveOutlined } from "@ant-design/icons";
import { save } from "@tauri-apps/plugin-dialog";
import { useFontJobStore } from "../../store/fontjob.store";
import { useUiStore } from "../../store/ui.store";
import { t } from "../../domain/i18n";
import { exportFont } from "../../services/generator/generator";

export default function TopBar() {
    const { config, status, result, generate } = useFontJobStore();
    const language = useUiStore((s) => s.language);
    const [msgApi, contextHolder] = message.useMessage();

    const onCopy = async () => {
        if (!result?.code) return;
        await navigator.clipboard.writeText(result.code);
        msgApi.success(t(language, "copySuccess"));
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
            msgApi.success(t(language, "saveSuccess", { path: outputPath || config.saveFileName }));
        } catch (e: any) {
            msgApi.error(e?.message || String(e));
        }
    };

    return (
        <>
            {contextHolder}
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
                <Space>
                    <Tooltip title={t(language, "generatePreview")}>
                        <Button
                            type="primary"
                            icon={<PlayCircleOutlined />}
                            loading={status === "generating"}
                            onClick={() => generate()}
                        >
                            {t(language, "generatePreview")}
                        </Button>
                    </Tooltip>

                    <Button icon={<CopyOutlined />} disabled={!result?.code} onClick={onCopy}>
                        {t(language, "copy")}
                    </Button>

                    <Button icon={<SaveOutlined />} disabled={!result?.code} onClick={onSave}>
                        {t(language, "save")}
                    </Button>
                </Space>
            </div>
        </>
    );
}
