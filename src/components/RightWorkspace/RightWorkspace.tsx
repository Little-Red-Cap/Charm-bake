import React from "react";
import { Tabs } from "antd";
import CodePreviewTab from "./tabs/CodePreviewTab";
import StatsTab from "./tabs/StatsTab";
import PreviewTab from "./tabs/PreviewTab";

export default function RightWorkspace() {
    return (
        <Tabs
            defaultActiveKey="preview"
            items={[
                { key: "preview", label: "Preview", children: <PreviewTab /> },
                { key: "code", label: "Code", children: <CodePreviewTab /> },
                { key: "stats", label: "Stats", children: <StatsTab /> },
            ]}
        />
    );
}
