import { Card, Typography } from "antd";
import { useUiStore } from "../../../store/ui.store";
import { t } from "../../../domain/i18n";

export default function DotMatrixTab() {
    const language = useUiStore((s) => s.language);

    return (
        <Card>
            <Typography.Title level={5}>{t(language, "dotMatrixTodoTitle")}</Typography.Title>
            <Typography.Paragraph type="secondary">
                {/*???????? -> ?? width/height/advance/offset??? Canvas ???????*/}
            </Typography.Paragraph>
        </Card>
    );
}
