import { Layout, Tabs, theme } from "antd";
import TopBar from "../components/TopBar/TopBar";
import StatusBar from "../components/StatusBar/StatusBar";
import LeftConfigSider from "../components/LeftConfig/LeftConfigSider";
import RightWorkspace from "../components/RightWorkspace/RightWorkspace";
import "../App.css";

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
