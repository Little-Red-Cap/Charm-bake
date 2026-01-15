import { Collapse } from "antd";
import FontSelectPanel from "./panels/FontSelectPanel";
import CharsetPanel from "./panels/CharsetPanel";
import SizePanel from "./panels/SizePanel";
import OutputOptionsPanel from "./panels/OutputOptionsPanel";
import ProcessingPanel from "./panels/ProcessingPanel";

export default function LeftConfigSider() {
    return (
        <div className="compactLayout" style={{ padding: 8 }}>
            <Collapse
                defaultActiveKey={["font", "charset", "size", "process", "output"]}
                items={[
                    { key: "font", label: "选择字体", children: <FontSelectPanel /> },
                    { key: "charset", label: "字符集", children: <CharsetPanel /> },
                    { key: "size", label: "字号与像素参考", children: <SizePanel /> },
                    { key: "process", label: "处理效果", children: <ProcessingPanel /> },
                    { key: "output", label: "生成选项", children: <OutputOptionsPanel /> },
                ]}
            />
        </div>
    );
}
