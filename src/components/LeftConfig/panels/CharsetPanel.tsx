import { Form, Input, Space, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function CharsetPanel() {
    const { config, setConfig } = useFontJobStore();
    const language = useUiStore((s) => s.language);

    const startCode = config.rangeStart.codePointAt(0);
    const endCode = config.rangeEnd.codePointAt(0);

    return (
        <Form layout="vertical">
            <Form.Item label={t(language, "charsetRangeLabel")}>
                <Space style={{ width: "100%" }} align="start">
                    <Input
                        maxLength={2}
                        value={config.rangeStart}
                        onChange={(e) => setConfig({ rangeStart: e.target.value })}
                        style={{ width: 80 }}
                    />
                    <Typography.Text style={{ paddingTop: 6 }}>{t(language, "charsetTo")}</Typography.Text>
                    <Input
                        maxLength={2}
                        value={config.rangeEnd}
                        onChange={(e) => setConfig({ rangeEnd: e.target.value })}
                        style={{ width: 80 }}
                    />
                    <div style={{ paddingTop: 6, opacity: 0.7 }}>
                        {startCode != null && endCode != null
                            ? t(language, "charsetCodepointRange", { start: startCode, end: endCode })
                            : null}
                    </div>
                </Space>
            </Form.Item>

            <Form.Item label={t(language, "charsetCustomLabel")}>
                <Input.TextArea
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    value={config.customChars}
                    onChange={(e) => setConfig({ customChars: e.target.value })}
                    placeholder={t(language, "charsetCustomPlaceholder")}
                />
            </Form.Item>

            <Form.Item label={t(language, "charsetFallbackLabel")}>
                <Input
                    maxLength={2}
                    value={config.fallbackChar}
                    onChange={(e) => setConfig({ fallbackChar: e.target.value })}
                    style={{ width: 100 }}
                />
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t(language, "charsetTodo")}
            </Typography.Text>
        </Form>
    );
}
