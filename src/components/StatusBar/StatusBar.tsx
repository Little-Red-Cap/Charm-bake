import { Space, Typography } from "antd";
import { useFontJobStore } from "../../store/fontjob.store";
import { useUiStore } from "../../store/ui.store";
import type { I18nKey } from "../../domain/i18n";
import { t } from "../../domain/i18n";

const statusKey = (status: string): I18nKey => {
    switch (status) {
        case "idle":
            return "statusIdle";
        case "generating":
            return "statusGenerating";
        case "success":
            return "statusSuccess";
        case "error":
            return "statusError";
        default:
            return "statusIdle";
    }
};

export default function StatusBar() {
    const { status, result, error } = useFontJobStore();
    const language = useUiStore((s) => s.language);
    const s = result?.stats;

    return (
        <Space size="large" wrap>
            <Typography.Text type="secondary">
                {t(language, "statusLabel")}?{t(language, statusKey(status))}
            </Typography.Text>
            {s ? (
                <>
                    <Typography.Text type="secondary">{t(language, "statsGlyphs")}: {s.glyphCount}</Typography.Text>
                    <Typography.Text type="secondary">{t(language, "statsRanges")}: {s.rangeCount ?? "-"}</Typography.Text>
                    <Typography.Text type="secondary">{t(language, "statsBitmapBytes")}: {s.bitmapBytes} bytes</Typography.Text>
                    <Typography.Text type="secondary">{t(language, "statsTextBytes")}: {s.textBytes} bytes</Typography.Text>
                </>
            ) : (
                <Typography.Text type="secondary">{t(language, "statsNoOutput")}</Typography.Text>
            )}
            {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Space>
    );
}
