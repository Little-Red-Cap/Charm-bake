import React from "react";
import { Layout, theme } from "antd";
import TopBar from "../components/TopBar/TopBar";
import StatusBar from "../components/StatusBar/StatusBar";
import LeftConfigSider from "../components/LeftConfig/LeftConfigSider";
import RightWorkspace from "../components/RightWorkspace/RightWorkspace";

const { Header, Sider, Content, Footer } = Layout;

export default function App() {
    const { token } = theme.useToken();

    return (
        <Layout style={{ height: "100vh" }}>
            <Header style={{ padding: 0, background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorder}` }}>
                <TopBar />
            </Header>

            <Layout>
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

            <Footer style={{ padding: "8px 16px", background: token.colorBgContainer, borderTop: `1px solid ${token.colorBorder}` }}>
                <StatusBar />
            </Footer>
        </Layout>
    );
}
