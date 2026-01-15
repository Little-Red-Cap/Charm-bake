import { useMemo } from "react";
import { Card } from "antd";
import Editor from "@monaco-editor/react";
import { useFontJobStore } from "../../../store/fontjob.store";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function CodePreviewTab() {
    const { result } = useFontJobStore();
    const language = useUiStore((s) => s.language);

    const text = useMemo(() => {
        if (!result?.code) return t(language, "codePreviewPlaceholder");
        return result.code;
    }, [language, result?.code]);

    return (
        <Card style={{ height: "100%" }} styles={{ body: { height: "100%", padding: 0 } }}>
            <Editor
                height="100%"
                language="cpp"
                value={text}
                options={{
                    readOnly: true,
                    fontSize: 12,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: "off",
                }}
            />
        </Card>
    );
}
