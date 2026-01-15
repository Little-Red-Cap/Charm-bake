import { Form, Input, Radio, Checkbox, Space, Typography, Button } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function OutputOptionsPanel() {
    const { config, setConfig, applySuggestedNames } = useFontJobStore();
    const language = useUiStore((s) => s.language);

    return (
        <Form layout="vertical">
            <Form.Item label={t(language, "outputType")}>
                <Radio.Group
                    value={config.outputKind}
                    onChange={(e) => setConfig({ outputKind: e.target.value })}
                >
                    <Radio value="cpp_module">{t(language, "outputCppModule")}</Radio>
                    <Radio value="cpp" disabled>
                        {t(language, "outputCppTodo")}
                    </Radio>
                    <Radio value="c" disabled>
                        {t(language, "outputCTodo")}
                    </Radio>
                </Radio.Group>
            </Form.Item>

            <Form.Item label={t(language, "moduleNameLabel")}>
                <Input value={config.moduleName} onChange={(e) => setConfig({ moduleName: e.target.value })} />
            </Form.Item>

            <Form.Item label={t(language, "exportNameLabel")}>
                <Input value={config.exportName} onChange={(e) => setConfig({ exportName: e.target.value })} />
                <Form.Item>
                    <Button onClick={() => applySuggestedNames()}>{t(language, "applySuggestedNames")}</Button>
                </Form.Item>
            </Form.Item>

            <Form.Item>
                <Space direction="vertical" style={{ width: "100%" }}>
                    <Checkbox checked={config.withComments} onChange={(e) => setConfig({ withComments: e.target.checked })}>
                        {t(language, "withCommentsLabel")}
                    </Checkbox>

                    <div>
                        <Typography.Text style={{ marginRight: 8 }}>{t(language, "numberFormatLabel")}</Typography.Text>
                        <Radio.Group
                            value={config.numberFormat}
                            onChange={(e) => setConfig({ numberFormat: e.target.value })}
                        >
                            <Radio value="bin">{t(language, "numberFormatBin")}</Radio>
                            <Radio value="dec">{t(language, "numberFormatDec")}</Radio>
                            <Radio value="hex">{t(language, "numberFormatHex")}</Radio>
                        </Radio.Group>
                    </div>
                </Space>
            </Form.Item>

        </Form>
    );
}
