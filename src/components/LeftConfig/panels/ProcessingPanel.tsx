import { Form, Radio, Slider, Space, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";

export default function ProcessingPanel() {
    const { config, setConfig } = useFontJobStore();

    const showAdvanced = config.binarizeMode === "gamma_oversample";

    return (
        <Form layout="vertical">
            <Form.Item label="二值化模式">
                <Radio.Group
                    value={config.binarizeMode}
                    onChange={(e) => setConfig({ binarizeMode: e.target.value })}
                >
                    <Radio value="mask_1bit">Python 风格（1-bit mask）</Radio>
                    <Radio value="gamma_oversample">Gamma + Oversample</Radio>
                </Radio.Group>
            </Form.Item>

            <Form.Item label="阈值">
                <Slider
                    min={0}
                    max={255}
                    value={config.threshold}
                    onChange={(value) => {
                        if (typeof value === "number") setConfig({ threshold: value });
                    }}
                />
            </Form.Item>

            {showAdvanced ? (
                <Form.Item label="高级（Gamma / Oversample）">
                    <Space direction="vertical" style={{ width: "100%" }}>
                        <div>
                            <Typography.Text style={{ marginRight: 8 }}>Gamma</Typography.Text>
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
                            <Typography.Text style={{ marginRight: 8 }}>Oversample</Typography.Text>
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

