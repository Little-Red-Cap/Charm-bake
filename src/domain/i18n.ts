export type Language = "zh" | "en";

const zh = {
    headerFont: "字体构建",
    headerImage: "图像工具",
    headerSine: "正弦波生成",
    headerSevenSeg: "数码管工具",
    menuFont: "字体",
    menuImage: "图像",
    menuSine: "正弦",
    menuSevenSeg: "数码管",
    loading: "加载中...",
    imageTodo: "图像工具即将到来。",
    sineTodo: "正弦波生成器即将到来。",
    sevenSegTodo: "数码管工具即将到来。",
    saveSettingsTitle: "保存设置",
    saveSettingsConfigName: "配置名",
    saveSettingsSaveDir: "保存路径",
    saveSettingsChoose: "选择",
    saveSettingsRememberPath: "记住路径",
    saveSettingsIncludeOptions: "包含生成选项",
    saveSettingsOk: "确定",
    saveSettingsCancel: "取消",
    saveSettingsSuccess: "保存成功",
    saveSettingsFail: "保存失败：{msg}",
    saveSettingsUiSection: "界面设置",
    saveSettingsTheme: "主题",
    saveSettingsThemeLight: "浅色",
    saveSettingsThemeDark: "深色",
    saveSettingsLanguage: "语言",
    languageZh: "中文",
    languageEn: "English",
    generatePreview: "生成预览",
    copy: "复制",
    save: "保存",
    copySuccess: "已复制到剪贴板",
    saveSuccess: "已保存：{path}",
    loadFailed: "加载失败：{msg}",
} as const;

export type I18nKey = keyof typeof zh;

const en: Record<I18nKey, string> = {
    headerFont: "Font Builder",
    headerImage: "Image Tools",
    headerSine: "Sine Generator",
    headerSevenSeg: "7-Seg Tools",
    menuFont: "Font",
    menuImage: "Image",
    menuSine: "Sine",
    menuSevenSeg: "7-Seg",
    loading: "Loading...",
    imageTodo: "Image tools coming soon.",
    sineTodo: "Sine generator coming soon.",
    sevenSegTodo: "Seven-seg tools coming soon.",
    saveSettingsTitle: "Save Settings",
    saveSettingsConfigName: "Config Name",
    saveSettingsSaveDir: "Save Directory",
    saveSettingsChoose: "Browse",
    saveSettingsRememberPath: "Remember path",
    saveSettingsIncludeOptions: "Include build options",
    saveSettingsOk: "OK",
    saveSettingsCancel: "Cancel",
    saveSettingsSuccess: "Saved",
    saveSettingsFail: "Save failed: {msg}",
    saveSettingsUiSection: "UI Settings",
    saveSettingsTheme: "Theme",
    saveSettingsThemeLight: "Light",
    saveSettingsThemeDark: "Dark",
    saveSettingsLanguage: "Language",
    languageZh: "Chinese",
    languageEn: "English",
    generatePreview: "Generate Preview",
    copy: "Copy",
    save: "Save",
    copySuccess: "Copied to clipboard",
    saveSuccess: "Saved: {path}",
    loadFailed: "Load failed: {msg}",
};

const dictionaries: Record<Language, Record<I18nKey, string>> = { zh, en };

export function t(language: Language, key: I18nKey, vars?: Record<string, string | number>): string {
    const template = dictionaries[language]?.[key] ?? zh[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (_, name) => {
        const value = vars[name];
        return value == null ? "" : String(value);
    });
}
