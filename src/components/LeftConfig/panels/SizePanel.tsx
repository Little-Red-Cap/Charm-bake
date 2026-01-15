import { Form, InputNumber, Slider, Typography, Descriptions } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function SizePanel() {
    const { config, setConfig, result } = useFontJobStore();
    const language = useUiStore((s) => s.language);
    const stats = result?.stats;

    return (
        <Form layout="vertical">
            <Form.Item label={t(language, "sizeLabel")}>
                <Slider
                    min={4}
                    max={64}
                    value={config.sizePx}
                    onChange={(v) => setConfig({ sizePx: v })}
                />
                <InputNumber
                    min={4}
                    max={128}
                    value={config.sizePx}
                    onChange={(v) => setConfig({ sizePx: Number(v) })}
                    style={{ width: "100%" }}
                />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t(language, "sizeHint")}
            </Typography.Text>

            <div style={{ marginTop: 12 }}>
                <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label={t(language, "sizeLineHeight")}>{stats?.lineHeight ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label={t(language, "sizeBaseline")}>{stats?.baseline ?? "-"}</Descriptions.Item>
                </Descriptions>
            </div>
        </Form>
    );
}
