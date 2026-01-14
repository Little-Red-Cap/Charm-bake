import type { FontJobConfig, FontGenerateResult } from "../../domain/types";
import { mockGenerate } from "./adapters/mockGenerator";

// TODO: 切换为 tauri invoke
// import { invoke } from "@tauri-apps/api/tauri";

export async function generateFont(cfg: FontJobConfig): Promise<FontGenerateResult> {
    // Milestone 1：先 mock
    return mockGenerate(cfg);

    // Milestone 2：Rust 后端
    // return await invoke<FontGenerateResult>("generate_font", { cfg });
}
