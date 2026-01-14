import { useState } from 'react';
import {
    Button,
    Form,
    Input,
    InputNumber,
    Radio,
    Card,
    message,
    Space,
    Typography,
    Divider,
    Row,
    Col,
    Collapse,
    Statistic,
    Empty
} from 'antd';
import {
    FileTextOutlined,
    FontSizeOutlined,
    SaveOutlined,
    ThunderboltOutlined,
    CodeOutlined,
    CheckCircleOutlined,
    BarChartOutlined
} from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

const { Title, Text } = Typography;

interface FontConfig {
    font_path: string;
    font_size: number;
    char_ranges: string;
    fallback_char: number;
    output_format: string;
    output_path: string;
}

interface GenerateResult {
    success: boolean;
    message: string;
    error?: string;
    generated_code?: string;
    stats?: {
        glyph_count: number;
        range_count: number;
        line_height: number;
        baseline: number;
        file_size: number;
    };
}

function FontGenerate() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [fontPath, setFontPath] = useState<string>('');
    const [outputPath, setOutputPath] = useState<string>('');
    const [generatedCode, setGeneratedCode] = useState<string>('');
    const [stats, setStats] = useState<GenerateResult['stats'] | null>(null);

    // 选择字体文件
    const selectFontFile = async () => {

    };

    // 选择输出路径
    const selectOutputPath = async () => {

    };

    // 生成字体
    const handleGenerate = async (values: FontConfig) => {

    };

    return (
        <div style={{ padding: '24px', minHeight: '100vh', background: '#f0f2f5' }}>
            <Card
                style={{ maxWidth: 800, margin: '0 auto' }}
                title={
                    <Space>
                        <FontSizeOutlined style={{ fontSize: 24 }} />
                        <Title level={3} style={{ margin: 0 }}>Charm Font Tool</Title>
                    </Space>
                }
            >
                <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
                    为 Charm 嵌入式 GUI 框架生成位图字体数据
                </Text>

                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleGenerate}
                    initialValues={{
                        font_size: 12,
                        char_ranges: '32-126',
                        fallback_char: 63,
                        output_format: 'bin',
                    }}
                >
                    <Divider orientation="left" orientationMargin={0}>字体文件</Divider>

                    <Row gutter={16}>
                        <Col span={18}>
                            <Form.Item
                                name="font_path"
                                label="字体文件路径"
                            >
                                <Input
                                    placeholder="点击右侧按钮选择 TTF/OTF 文件"
                                    readOnly
                                    value={fontPath}
                                    prefix={<FileTextOutlined />}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label=" ">
                                <Button
                                    block
                                    onClick={selectFontFile}
                                    icon={<FileTextOutlined />}
                                >
                                    选择文件
                                </Button>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Divider orientation="left" orientationMargin={0}>字体参数</Divider>

                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="font_size"
                                label="字体大小（像素）"
                                rules={[{ required: true, message: '请输入字体大小' }]}
                            >
                                <InputNumber
                                    min={6}
                                    max={128}
                                    style={{ width: '100%' }}
                                    placeholder="如: 12"
                                />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item
                                name="fallback_char"
                                label="备用字符代码"
                                tooltip="当字符不存在时显示的字符，默认 63 是 '?'"
                                rules={[{ required: true, message: '请输入备用字符' }]}
                            >
                                <InputNumber
                                    min={0}
                                    max={65535}
                                    style={{ width: '100%' }}
                                    placeholder="默认: 63 (?)"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item
                        name="char_ranges"
                        label="字符范围"
                        rules={[{ required: true, message: '请输入字符范围' }]}
                        tooltip="使用逗号分隔多个范围，如: 32-126,160-255"
                    >
                        <Input
                            placeholder="如: 32-126 (基本 ASCII 字符)"
                        />
                    </Form.Item>

                    <Form.Item
                        name="output_format"
                        label="输出格式"
                        rules={[{ required: true, message: '请选择输出格式' }]}
                    >
                        <Radio.Group>
                            <Radio value="hex">十六进制 (0x00)</Radio>
                            <Radio value="bin">二进制 (0b00000000)</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Divider orientation="left" orientationMargin={0}>输出设置</Divider>

                    <Row gutter={16}>
                        <Col span={18}>
                            <Form.Item
                                name="output_path"
                                label="输出文件路径"
                            >
                                <Input
                                    placeholder="点击右侧按钮选择保存位置"
                                    readOnly
                                    value={outputPath}
                                    prefix={<SaveOutlined />}
                                />
                            </Form.Item>
                        </Col>
                        <Col span={6}>
                            <Form.Item label=" ">
                                <Button
                                    block
                                    onClick={selectOutputPath}
                                    icon={<SaveOutlined />}
                                >
                                    选择路径
                                </Button>
                            </Form.Item>
                        </Col>
                    </Row>

                    <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            size="large"
                            block
                            icon={<ThunderboltOutlined />}
                        >
                            {loading ? '生成中...' : '生成字体文件'}
                        </Button>
                    </Form.Item>
                </Form>
            </Card>

            {/* 统计信息 */}
            {stats && (
                <Card
                    style={{ maxWidth: 800, margin: '24px auto' }}
                    title={
                        <Space>
                            <BarChartOutlined />
                            <span>生成统计</span>
                        </Space>
                    }
                >
                    <Row gutter={16}>
                        <Col span={6}>
                            <Statistic
                                title="字形数量"
                                value={stats.glyph_count}
                                suffix="个"
                                valueStyle={{ color: '#3f8600' }}
                                prefix={<CheckCircleOutlined />}
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="范围数量"
                                value={stats.range_count}
                                suffix="个"
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="行高"
                                value={stats.line_height}
                                suffix="px"
                            />
                        </Col>
                        <Col span={6}>
                            <Statistic
                                title="基线"
                                value={stats.baseline}
                                suffix="px"
                            />
                        </Col>
                    </Row>
                    <Divider />
                    <Row>
                        <Col span={24}>
                            <Statistic
                                title="文件大小"
                                value={(stats.file_size / 1024).toFixed(2)}
                                suffix="KB"
                            />
                        </Col>
                    </Row>
                </Card>
            )}

            {/* 代码预览 */}
            {generatedCode && (
                <Card
                    style={{ maxWidth: 800, margin: '24px auto' }}
                    title={
                        <Space>
                            <CodeOutlined />
                            <span>生成的代码</span>
                        </Space>
                    }
                >
                    <Collapse
                        items={[
                            {
                                key: '1',
                                label: `查看生成的 C++ Module 代码 (${generatedCode.split('\n').length} 行)`,
                                children: (
                                    <div style={{
                                        maxHeight: '400px',
                                        overflow: 'auto',
                                        background: '#f5f5f5',
                                        padding: '16px',
                                        borderRadius: '4px'
                                    }}>
                    <pre style={{
                        margin: 0,
                        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                        fontSize: '12px',
                        lineHeight: '1.5'
                    }}>
                      {generatedCode}
                    </pre>
                                    </div>
                                )
                            }
                        ]}
                        defaultActiveKey={['1']}
                    />
                    <div style={{ marginTop: 16 }}>
                        <Button
                            type="default"
                            icon={<CodeOutlined />}
                            onClick={() => {
                                navigator.clipboard.writeText(generatedCode);
                                message.success('代码已复制到剪贴板');
                            }}
                        >
                            复制代码
                        </Button>
                    </div>
                </Card>
            )}


            <div style={{ textAlign: 'center', marginTop: 16, color: '#888' }}>
                <Text type="secondary">
                    Charm Font Tool v1.0 - 为嵌入式 GUI 生成位图字体
                </Text>
            </div>
        </div>
    );
}

export default FontGenerate;
