import { useMemo } from "react";
import { Card } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";
import CodeEditor from "../../common/CodeEditor";

export default function CodePreviewTab() {
    const { result } = useFontJobStore();
    const language = useUiStore((s) => s.language);

    const text = useMemo(() => {
        if (!result?.code) return t(language, "codePreviewPlaceholder");
        return result.code;
    }, [language, result?.code]);

    return (
        <Card style={{ height: "100%" }} styles={{ body: { height: "100%", padding: 0 } }}>
            <CodeEditor value={text} height="100%" />
        </Card>
    );
}
