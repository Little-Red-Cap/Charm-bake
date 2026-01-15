import { Form, Radio, Slider, Space, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function ProcessingPanel() {
    const { config, setConfig } = useFontJobStore();
    const language = useUiStore((s) => s.language);

    const showAdvanced = config.binarizeMode === "gamma_oversample";
    const showThreshold = config.binarizeMode !== "mask_1bit";

    return (
        <Form layout="vertical">
            <Form.Item label={t(language, "processBinarizeMode")}>
                <Radio.Group
                    value={config.binarizeMode}
                    onChange={(e) => setConfig({ binarizeMode: e.target.value })}
                >
                    <Radio value="mask_1bit">{t(language, "processModeMask")}</Radio>
                    <Radio value="gamma_oversample">{t(language, "processModeGamma")}</Radio>
                </Radio.Group>
            </Form.Item>

            {showThreshold ? (
                <Form.Item
                    label={
                        <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                            <span>{t(language, "processThreshold")}</span>
                            <Typography.Text type="secondary">{config.threshold}</Typography.Text>
                        </div>
                    }
                >
                    <div style={{ position: "relative", width: "100%", marginTop: 6, paddingBottom: 8 }}>
                        <div
                            style={{
                                width: "100%",
                                height: 10,
                                borderRadius: 6,
                                background: "linear-gradient(90deg, #000 0%, #fff 100%)",
                                border: "1px solid rgba(0, 0, 0, 0.25)",
                            }}
                        />
                        <div
                            style={{
                                position: "absolute",
                                left: `${(config.threshold / 255) * 100}%`,
                                top: 12,
                                width: 0,
                                height: 0,
                                borderLeft: "5px solid transparent",
                                borderRight: "5px solid transparent",
                                borderBottom: "7px solid rgba(0, 0, 0, 0.75)",
                                transform: "translateX(-5px)",
                            }}
                        />
                    </div>
                    <Slider
                        min={0}
                        max={255}
                        value={config.threshold}
                        onChange={(value) => {
                            if (typeof value === "number") setConfig({ threshold: value });
                        }}
                    />
                </Form.Item>
            ) : null}

            {showAdvanced ? (
                <Form.Item label={t(language, "processAdvanced")}>
                    <Space direction="vertical" style={{ width: "100%" }}>
                        <div>
                            <Typography.Text style={{ marginRight: 8 }}>{t(language, "processGamma")}</Typography.Text>
                            <Slider
                                min={0.6}
                                max={2.2}
                                step={0.05}
                                value={config.gamma}
                                onChange={(value) => {
                                    if (typeof value === "number") setConfig({ gamma: value });
                                }}
                            />
                        </div>
                        <div>
                            <Typography.Text style={{ marginRight: 8 }}>{t(language, "processOversample")}</Typography.Text>
                            <Slider
                                min={1}
                                max={4}
                                step={1}
                                value={config.oversample}
                                onChange={(value) => {
                                    if (typeof value === "number") setConfig({ oversample: value });
                                }}
                            />
                        </div>
                    </Space>
                </Form.Item>
            ) : null}
        </Form>
    );
}
