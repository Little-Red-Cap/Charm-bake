import { Tabs } from "antd";
import CodePreviewTab from "./tabs/CodePreviewTab";
import StatsTab from "./tabs/StatsTab";
import PreviewTab from "./tabs/PreviewTab";
import { useUiStore } from "../../store/ui.store";
import { t } from "../../domain/i18n";

export default function RightWorkspace() {
    const language = useUiStore((s) => s.language);

    return (
        <div className="workspaceTabs">
            <Tabs
                defaultActiveKey="preview"
                items={[
                    { key: "preview", label: t(language, "tabPreview"), children: <PreviewTab /> },
                    { key: "code", label: t(language, "tabCode"), children: <CodePreviewTab /> },
                    { key: "stats", label: t(language, "tabStats"), children: <StatsTab /> },
                ]}
            />
        </div>
    );
}
