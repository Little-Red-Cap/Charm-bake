import { Form, Input, Radio, Checkbox, Space, Typography, Button, InputNumber, Slider } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";

export default function OutputOptionsPanel() {
    const { config, setConfig, applySuggestedNames } = useFontJobStore();

    return (
        <Form layout="vertical">
            <Form.Item label="输出类型">
                <Radio.Group
                    value={config.outputKind}
                    onChange={(e) => setConfig({ outputKind: e.target.value })}
                >
                    <Radio value="cpp_module">C++20 Module（cppm）</Radio>
                    <Radio value="cpp" disabled>
                        C++（TODO）
                    </Radio>
                    <Radio value="c" disabled>
                        C（TODO）
                    </Radio>
                </Radio.Group>
            </Form.Item>

            <Form.Item label="模块名（module name）">
                <Input value={config.moduleName} onChange={(e) => setConfig({ moduleName: e.target.value })} />
            </Form.Item>

            <Form.Item label="导出字体对象名（export name）">
                <Input value={config.exportName} onChange={(e) => setConfig({ exportName: e.target.value })} />
                <Form.Item>
                    <Button onClick={() => applySuggestedNames()}>按当前字体字号生成默认命名</Button>
                </Form.Item>
            </Form.Item>

            <Form.Item>
                <Space direction="vertical" style={{ width: "100%" }}>
                    <Checkbox checked={config.withComments} onChange={(e) => setConfig({ withComments: e.target.checked })}>
                        生成注释（如 // code 33 ('!')）
                    </Checkbox>

                    <div>
                        <Typography.Text style={{ marginRight: 8 }}>点阵数据格式：</Typography.Text>
                        <Radio.Group
                            value={config.numberFormat}
                            onChange={(e) => setConfig({ numberFormat: e.target.value })}
                        >
                            <Radio value="bin">Bin</Radio>
                            <Radio value="dec">Dec</Radio>
                            <Radio value="hex">Hex</Radio>
                        </Radio.Group>
                    </div>

                    <div style={{ width: "100%" }}>
                        <Typography.Text style={{ marginRight: 8 }}>阈值</Typography.Text>
                        <Space style={{ width: "100%" }}>
                            <Slider
                                min={0}
                                max={255}
                                value={config.threshold}
                                onChange={(value) => {
                                    if (typeof value === "number") setConfig({ threshold: value });
                                }}
                                style={{ flex: 1 }}
                            />
                            <InputNumber
                                min={0}
                                max={255}
                                value={config.threshold}
                                onChange={(value) => {
                                    if (typeof value === "number") setConfig({ threshold: value });
                                }}
                            />
                        </Space>
                    </div>
                </Space>
            </Form.Item>

            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                TODO：将 withComments/numberFormat 真实传给 Rust 生成器
            </Typography.Text>
        </Form>
    );
}

