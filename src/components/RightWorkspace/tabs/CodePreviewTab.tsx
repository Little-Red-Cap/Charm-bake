import { useMemo } from "react";
import { Card } from "antd";
import Editor from "@monaco-editor/react";
import { useFontJobStore } from "../../../store/fontjob.store";

export default function CodePreviewTab() {
    const { result } = useFontJobStore();

    const text = useMemo(() => {
        if (!result?.code) return "// 点击“生成预览”后在此显示生成结果。";
        return result.code;
    }, [result?.code]);

    return (
        <Card style={{ height: "100%" }}>
            <Editor
                height="60vh"
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
