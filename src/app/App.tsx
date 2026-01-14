import { useEffect, useState } from "react";
import { Layout, Tabs, theme, message } from "antd";
import { invoke } from "@tauri-apps/api/core";
import TopBar from "../components/TopBar/TopBar";
import StatusBar from "../components/StatusBar/StatusBar";
import LeftConfigSider from "../components/LeftConfig/LeftConfigSider";
import RightWorkspace from "../components/RightWorkspace/RightWorkspace";
import { DEFAULT_CONFIG } from "../domain/presets";
import { useFontJobStore } from "../store/fontJob.store";
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
        if (typeof options.customChars === "string") cfg.customChars = options.customChars;
        if (typeof options.fallbackChar === "string") cfg.fallbackChar = options.fallbackChar;
        if (typeof options.saveDir === "string" || options.saveDir === null) cfg.saveDir = options.saveDir;
        if (typeof options.saveFileName === "string") cfg.saveFileName = options.saveFileName;

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

const { Header, Sider, Content, Footer } = Layout;

function FontTab() {
    const { token } = theme.useToken();

    return (
        <Layout style={{ height: "100%" }}>
            <Header style={{ padding: 0, background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}` }}>
                <TopBar />
            </Header>

            <Layout style={{ flex: 1 }}>
                <Sider
                    width={360}
                    theme="light"
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
                    padding: "8px 16px",
                    background: token.colorBgContainer,
                    borderTop: `1px solid ${token.colorBorder}`,
                }}
            >
                <StatusBar />
            </Footer>
        </Layout>
    );
}

function ImageTab() {
    return <div>Image tools coming soon.</div>;
}

export default function App() {
    const [isReady, setIsReady] = useState(false);
    const hydrateConfig = useFontJobStore((s) => s.hydrateConfig);

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
                message.error(`Load failed: ${msg}`);
            } finally {
                if (active) setIsReady(true);
            }
        };

        load();
        return () => {
            active = false;
        };
    }, [hydrateConfig]);

    if (!isReady) {
        return (
            <div className="app">
                <header className="appHeader">
                    <div className="appTitle">Charm-bake</div>
                    <div className="appSubtitle">Font Builder</div>
                </header>
                <main className="appMain">Loading...</main>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="appHeader">
                <div className="appTitle">Charm-bake</div>
                <div className="appSubtitle">Font Builder</div>
            </header>

            <main className="appMain">
                <Tabs
                    defaultActiveKey="font"
                    items={[
                        { key: "font", label: "Font", children: <FontTab /> },
                        { key: "image", label: "Image", children: <ImageTab /> },
                    ]}
                />
            </main>
        </div>
    );
}
