import Editor from "@monaco-editor/react";

type CodeEditorProps = {
    value: string;
    height?: string | number;
    language?: string;
    options?: Record<string, unknown>;
};

export default function CodeEditor({ value, height = "100%", language = "cpp", options }: CodeEditorProps) {
    return (
        <Editor
            height={height}
            language={language}
            value={value}
            options={{
                readOnly: true,
                fontSize: 12,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "off",
                ...options,
            }}
        />
    );
}
