import { Card, Typography } from "antd";

export default function DotMatrixTab() {
    return (
        <Card>
            <Typography.Title level={5}>TODO：点阵渲染器</Typography.Title>
            <Typography.Paragraph type="secondary">
                {/*后续：选择某字符 -> 展示 width/height/advance/offset，并用 Canvas 绘制像素点阵。*/}
            </Typography.Paragraph>
        </Card>
    );
}

