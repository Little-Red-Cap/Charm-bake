import { Suspense, lazy, useEffect, useState } from "react";
import { Button, ConfigProvider, Layout, Menu, Space, Tooltip, message, theme as antdTheme } from "antd";
import {
    CopyOutlined,
    FontSizeOutlined,
    LineChartOutlined,
    PictureOutlined,
    PlayCircleOutlined,
    SaveOutlined,
    TableOutlined,
} from "@ant-design/icons";
import { invoke } from "@tauri-apps/api/core";
import TopBar from "../components/TopBar/TopBar";
import StatusBar from "../components/StatusBar/StatusBar";
import LeftConfigSider from "../components/LeftConfig/LeftConfigSider";
import SavePanel from "../components/LeftConfig/panels/SavePanel";
import RightWorkspace from "../components/RightWorkspace/RightWorkspace";
const SevenSegPage = lazy(() => import("../components/SevenSeg/SevenSegPage"));
const SinePage = lazy(() => import("../components/Sine/SinePage"));
const ImagePage = lazy(() => import("../components/Image/ImagePage"));
import { DEFAULT_CONFIG } from "../domain/presets";
import { useFontJobStore } from "../store/fontjob.store";
import { useImageJobStore } from "../store/imagejob.store";
import { useUiStore } from "../store/ui.store";
import { t } from "../domain/i18n";
import type { Language } from "../domain/i18n";
import { saveTextFile } from "../services/saveTextFile";
import { copyText } from "../services/clipboard";
import "../App.css";

const parseRangeString = (range: string | undefined) => {
    if (!range) return null;
    const match = range.match(/(\d+)\s*-\s*(\d+)/);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start < 0 || end < 0 || start > 0x10ffff || end > 0x10ffff) return null;
    return {
        rangeStart: String.fromCodePoint(start),
        rangeEnd: String.fromCodePoint(end),
    };
};

const migrateSettings = (raw: any) => {
    if (!raw || typeof raw !== "object") return {};
    const version = raw.version ?? 0;

    if (version === 1) {
        const options = raw.build?.options ?? {};
        const cfg: any = {};
        const meta = raw.meta ?? {};
        const range = parseRangeString(raw.charset?.range);
        if (range) {
            cfg.rangeStart = range.rangeStart;
            cfg.rangeEnd = range.rangeEnd;
        }
        if (typeof raw.font?.size === "number") cfg.sizePx = raw.font.size;
        if (raw.build?.name) cfg.moduleName = raw.build.name;
        if (typeof options.exportName === "string") cfg.exportName = options.exportName;
        if (typeof options.outputKind === "string") cfg.outputKind = options.outputKind;
        if (typeof options.withComments === "boolean") cfg.withComments = options.withComments;
        if (typeof options.numberFormat === "string") cfg.numberFormat = options.numberFormat;
        if (typeof options.binarizeMode === "string") cfg.binarizeMode = options.binarizeMode;
        if (typeof options.threshold === "number") cfg.threshold = options.threshold;
        if (typeof options.gamma === "number") cfg.gamma = options.gamma;
        if (typeof options.oversample === "number") cfg.oversample = options.oversample;
        if (typeof options.previewScale === "number") cfg.previewScale = options.previewScale;
        if (typeof options.customChars === "string") cfg.customChars = options.customChars;
        if (typeof options.fallbackChar === "string") cfg.fallbackChar = options.fallbackChar;
        if (typeof options.saveDir === "string" || options.saveDir === null) cfg.saveDir = options.saveDir;
        if (typeof options.saveFileName === "string") cfg.saveFileName = options.saveFileName;
        if (cfg.saveDir == null && typeof meta.lastDir === "string") {
            const d = meta.lastDir.trim();
            cfg.saveDir = d ? d : null;
        }
        const currentFile = typeof cfg.saveFileName === "string" ? cfg.saveFileName.trim() : "";
        const lastFile = typeof meta.lastFile === "string" ? meta.lastFile.trim() : "";
        if (!currentFile && lastFile) cfg.saveFileName = lastFile;

        const mode = options.fontSourceMode ?? DEFAULT_CONFIG.fontSourceMode;
        cfg.fontSourceMode = mode;
        if (mode === "system") {
            cfg.systemFontName = raw.font?.family ?? options.systemFontName ?? DEFAULT_CONFIG.systemFontName;
            cfg.fontFilePath = null;
        } else {
            cfg.fontFilePath = raw.font?.family ?? options.fontFilePath ?? DEFAULT_CONFIG.fontFilePath;
            cfg.systemFontName = null;
        }

        return cfg;
    }

    if (version === 0) {
        if (raw.config && typeof raw.config === "object") return raw.config;
        if (raw.font || raw.charset || raw.build) return migrateSettings({ ...raw, version: 1 });
        return raw;
    }

    // TODO: future migrations
    return {};
};

const { Sider, Content, Footer } = Layout;

function FontTab() {
    const { token } = antdTheme.useToken();
    const uiTheme = useUiStore((s) => s.theme);

    return (
        <Layout style={{ height: "100%" }}>
            <Layout style={{ flex: 1 }}>
                <Sider
                    width={360}
                    theme={uiTheme}
                    style={{ borderRight: `1px solid ${token.colorBorder}`, overflow: "auto" }}
                >
                    <LeftConfigSider />
                </Sider>

                <Content style={{ padding: 16, overflow: "auto", background: token.colorBgLayout }}>
                    <RightWorkspace />
                </Content>
            </Layout>

            <Footer
                style={{
                    padding: "4px 12px",
                    background: token.colorBgContainer,
                    borderTop: `1px solid ${token.colorBorder}`,
                }}
            >
                <div className="compactStatusBar">
                    <StatusBar />
                </div>
            </Footer>
        </Layout>
    );
}

function ImageTab() {
    return <ImagePage />;
}

function SineTab() {
    return <SinePage />;
}

function SevenSegTab() {
    return <SevenSegPage />;
}

function HeaderActions({ activeTab }: { activeTab: string }) {
    const language = useUiStore((s) => s.language);
    const { outputCode, imagePath } = useImageJobStore();
    const [msgApi, contextHolder] = message.useMessage();

    if (activeTab === "font") {
        return <TopBar />;
    }

    if (activeTab === "image") {
        const hasOutput = Boolean(outputCode);
        const base = imagePath ? imagePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") : null;
        const defaultName = `${base || "image"}.c`;

        const onCopy = async () => {
            if (!outputCode) return;
            await copyText(outputCode);
            msgApi.success(t(language, "copySuccess"));
        };

        const onSave = async () => {
            if (!outputCode) return;
            try {
                const savedPath = await saveTextFile({
                    defaultPath: defaultName,
                    filters: [{ name: "C Source", extensions: ["c"] }],
                    contents: outputCode,
                });
                if (savedPath) {
                    msgApi.success(t(language, "saveSuccess", { path: savedPath }));
                }
            } catch (e: any) {
                msgApi.error(e?.message || String(e));
            }
        };

        return (
            <>
                {contextHolder}
                <Space>
                    <Tooltip title={t(language, "generatePreview")}>
                        <Button type="primary" icon={<PlayCircleOutlined />} disabled>
                            {t(language, "generatePreview")}
                        </Button>
                    </Tooltip>
                    <Button icon={<CopyOutlined />} disabled={!hasOutput} onClick={onCopy}>
                        {t(language, "copy")}
                    </Button>
                    <Button icon={<SaveOutlined />} disabled={!hasOutput} onClick={onSave}>
                        {t(language, "save")}
                    </Button>
                </Space>
            </>
        );
    }

    return (
        <>
            {contextHolder}
            <Space>
                <Tooltip title={t(language, "generatePreview")}>
                    <Button type="primary" icon={<PlayCircleOutlined />} disabled>
                        {t(language, "generatePreview")}
                    </Button>
                </Tooltip>
                <Button icon={<CopyOutlined />} disabled>
                    {t(language, "copy")}
                </Button>
                <Button icon={<SaveOutlined />} disabled>
                    {t(language, "save")}
                </Button>
            </Space>
        </>
    );
}

function headerLabel(activeTab: string, language: Language): string {
    switch (activeTab) {
        case "font":
            return t(language, "headerFont");
        case "image":
            return t(language, "headerImage");
        case "sine":
            return t(language, "headerSine");
        case "sevenseg":
            return t(language, "headerSevenSeg");
        default:
            return "";
    }
}

export default function App() {
    const [activeTab, setActiveTab] = useState("font");
    const [isReady, setIsReady] = useState(false);
    const hydrateConfig = useFontJobStore((s) => s.hydrateConfig);
    const uiTheme = useUiStore((s) => s.theme);
    const language = useUiStore((s) => s.language);

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const json = await invoke<string>("load_settings");
                if (!json || !json.trim()) return;
                const parsed = JSON.parse(json);
                const saved = migrateSettings(parsed);
                if (!saved || typeof saved !== "object") return;
                const next = {
                    ...DEFAULT_CONFIG,
                    ...saved,
                    rangeStart: saved.rangeStart || DEFAULT_CONFIG.rangeStart,
                    rangeEnd: saved.rangeEnd || DEFAULT_CONFIG.rangeEnd,
                };
                hydrateConfig(next);
            } catch (err) {
                const msg = typeof err === "string" ? err : (err as Error)?.message || String(err);
                message.error(t(language, "loadFailed", { msg }));
            } finally {
                if (active) setIsReady(true);
            }
        };

        load();
        return () => {
            active = false;
        };
    }, [hydrateConfig]);

    useEffect(() => {
        document.documentElement.dataset.theme = uiTheme;
        document.documentElement.dataset.lang = language;
    }, [uiTheme, language]);

    return (
        <ConfigProvider
            theme={{
                algorithm: uiTheme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            }}
        >
            <div className="app">
                <header className="appHeader">
                    <div className="appHeaderBar">
                        <div className="appTitleWrap">
                            <div className="appTitle">Charm-bake</div>
                            <div className="appSubtitle">{headerLabel(activeTab, language)}</div>
                        </div>
                        <div className="appHeaderSpacer" />
                        <div className="appHeaderActions">
                            <HeaderActions activeTab={activeTab} />
                        </div>
                    </div>
                </header>

                <div className="appBody">
                    <aside className="appNav">
                        <Menu
                            mode="inline"
                            inlineCollapsed
                            theme={uiTheme}
                            selectedKeys={[activeTab]}
                            onClick={(e) => setActiveTab(e.key)}
                            items={[
                                { key: "font", label: t(language, "menuFont"), icon: <FontSizeOutlined /> },
                                { key: "image", label: t(language, "menuImage"), icon: <PictureOutlined /> },
                                { key: "sine", label: t(language, "menuSine"), icon: <LineChartOutlined /> },
                                { key: "sevenseg", label: t(language, "menuSevenSeg"), icon: <TableOutlined /> },
                            ]}
                        />
                        <div className="appNavFooter">
                            <SavePanel />
                        </div>
                    </aside>
                    <main className="appMain">
                        <Suspense fallback={t(language, "loading")}>
                            {!isReady
                                ? t(language, "loading")
                                : activeTab === "font"
                                    ? <FontTab />
                                    : activeTab === "image"
                                        ? <ImageTab />
                                        : activeTab === "sine"
                                            ? <SineTab />
                                            : <SevenSegTab />}
                        </Suspense>
                    </main>
                </div>
            </div>
        </ConfigProvider>
    );
}
