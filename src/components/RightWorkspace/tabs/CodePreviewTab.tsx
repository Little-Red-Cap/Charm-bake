import { useMemo } from "react";
import { Card, Typography } from "antd";
import { useFontJobStore } from "../../../store/fontjob.store";

function withLineNumbers(code: string): string {
    const lines = code.split(/\r?\n/);
    const pad = String(lines.length).length;
    return lines
        .map((l, i) => `${String(i + 1).padStart(pad, " ")} | ${l}`)
        .join("\n");
}

export default function CodePreviewTab() {
    const { result } = useFontJobStore();

    const text = useMemo(() => {
        if (!result?.code) return "点击「生成预览」后在此显示生成结果。";
        return withLineNumbers(result.code);
    }, [result?.code]);

    return (
        <Card>
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                只读预览（Milestone 2 可替换为 Monaco Editor）
            </Typography.Paragraph>
            <pre style={{ margin: 0, whiteSpace: "pre", overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
        {text}
      </pre>
        </Card>
    );
}


