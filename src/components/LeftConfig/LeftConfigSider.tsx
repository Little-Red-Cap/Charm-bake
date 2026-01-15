import { Collapse } from "antd";
import FontSelectPanel from "./panels/FontSelectPanel";
import CharsetPanel from "./panels/CharsetPanel";
import SizePanel from "./panels/SizePanel";
import OutputOptionsPanel from "./panels/OutputOptionsPanel";
import ProcessingPanel from "./panels/ProcessingPanel";
import { useUiStore } from "../../store/ui.store";
import { t } from "../../domain/i18n";

export default function LeftConfigSider() {
    const language = useUiStore((s) => s.language);

    return (
        <div className="compactLayout" style={{ padding: 8 }}>
            <Collapse
                defaultActiveKey={["font", "charset", "size", "process", "output"]}
                items={[
                    { key: "font", label: t(language, "leftFontSelect"), children: <FontSelectPanel /> },
                    { key: "charset", label: t(language, "leftCharset"), children: <CharsetPanel /> },
                    { key: "size", label: t(language, "leftSize"), children: <SizePanel /> },
                    { key: "process", label: t(language, "leftProcessing"), children: <ProcessingPanel /> },
                    { key: "output", label: t(language, "leftOutput"), children: <OutputOptionsPanel /> },
                ]}
            />
        </div>
    );
}
