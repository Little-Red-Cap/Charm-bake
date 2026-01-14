import React from "react";
import { Collapse, Divider } from "antd";
import FontSelectPanel from "./panels/FontSelectPanel";
import CharsetPanel from "./panels/CharsetPanel";
import SizePanel from "./panels/SizePanel";
import OutputOptionsPanel from "./panels/OutputOptionsPanel";
import SavePanel from "./panels/SavePanel";

export default function LeftConfigSider() {
    return (
        <div style={{ padding: 12 }}>
            <Collapse
                defaultActiveKey={["font", "charset", "size", "output", "save"]}
                items={[
                    { key: "font", label: "选择字体", children: <FontSelectPanel /> },
                    { key: "charset", label: "字符集", children: <CharsetPanel /> },
                    { key: "size", label: "字号与像素参考", children: <SizePanel /> },
                    { key: "output", label: "生成选项", children: <OutputOptionsPanel /> },
                    { key: "save", label: "保存设置", children: <SavePanel /> },
                ]}
            />
            <Divider style={{ margin: "12px 0" }} />
            <div style={{ fontSize: 12, opacity: 0.65 }}>
                TODO：系统字体列表（Tauri）/ Rust 生成器 / 点阵预览
            </div>
        </div>
    );
}
