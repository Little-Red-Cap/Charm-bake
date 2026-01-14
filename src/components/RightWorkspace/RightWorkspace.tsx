import React from "react";
import { Tabs } from "antd";
import CodePreviewTab from "./tabs/CodePreviewTab";
import StatsTab from "./tabs/StatsTab";
import DotMatrixTab from "./tabs/DotMatrixTab";

export default function RightWorkspace() {
    return (
        <Tabs
            defaultActiveKey="code"
            items={[
                { key: "code", label: "生成内容预览", children: <CodePreviewTab /> },
                { key: "stats", label: "统计", children: <StatsTab /> },
                { key: "dot", label: "点阵预览（TODO）", children: <DotMatrixTab /> },
            ]}
        />
    );
}
