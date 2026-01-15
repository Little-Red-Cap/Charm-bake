<div align="center">

# [Charm-bake](https://github.com/Little-Red-Cap/Charm-bake)

**为 Charm GUI 生成 MCU 友好的 C/C++ 字体与图像数据**
<br>
**Bake fonts & images into MCU-friendly C/C++ data for Charm GUI.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Build Status](https://github.com/Little-Red-Cap/Charm-bake/actions/workflows/tauri.yml/badge.svg)](https://github.com/Little-Red-Cap/Charm-bake/actions)

</div>

[English](doc/README_en.md) | [简体中文](README.md)

---

<div align="center">

问题反馈：[GitHub Issues](https://github.com/Little-Red-Cap/Charm-bake/issues)

</div>

## ✨ 项目亮点

- 一键把字体/图像烘焙成 MCU 友好的数据结构，直接可用
- Tauri + React + Rust，跨平台桌面体验
- 丰富预览：灰度/二值/导出一致性、波形与数码管可视化
- 面向嵌入式：位序、扫描方向、数据格式可扩展

## 📸 截图

> 这里预留截图位置，后续补充。

![Font Builder](docs/images/font-builder.png)
![Image Tools](docs/images/image-tools.png)
![Sine Generator](docs/images/sine-generator.png)
![Seven-Seg Tools](docs/images/sevenseg-tools.png)

## 🚀 功能一览

### 字体生成
- 系统字体/文件字体加载
- 字符集范围 + 自定义字符 + fallback
- 灰度/二值预览与导出一致
- C++20 module 导出（cppm）

### 图像工具
- 图片加载与缩放
- 单色/灰度/RGB565/RGB888 输出
- 抖动算法（Floyd/Atkinson/Bayer）
- 输出代码预览与一键保存

### 正弦波生成
- 波形预览 + 控制参数
- 量化位宽、输出格式、模板切换

### 数码管工具
- 共阳/共阴、段序、位序
- 动态扫描/位选配置
- 输出代码预览

## 🧱 技术栈

- **Frontend**: React, Ant Design, Vite
- **Desktop**: Tauri v2
- **Backend**: Rust
- **Preview**: Monaco Editor

## 🗂️ 项目结构

```
src/
  app/                应用入口与全局布局
  components/         UI 组件（Font/Image/Sine/SevenSeg）
    common/           通用组件（SplitPane、CodeEditor）
  domain/             领域模型与工具（i18n、format、validate）
  services/           前端服务（generator、saveTextFile）
  store/              Zustand 状态管理
src-tauri/
  src/                Rust 后端（font_pipeline、settings 等）
```

## 🧪 开发与构建

```bash
npm install
npm run dev
```

构建（Tauri）：
```bash
npm run build
cargo tauri build
```

## 🧭 Roadmap

- 图像导出完整参数（位序/扫描方向/阈值/矩阵大小）
- 统一导出模板与多语言文档
- 更多 MCU 友好输出格式

## 🤝 贡献

欢迎 PR / Issue，一起把 Charm-bake 打磨成真正好用的嵌入式资源生成器。
