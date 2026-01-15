import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

type SaveTextOptions = {
    defaultPath: string;
    filters?: { name: string; extensions: string[] }[];
    contents: string;
};

export async function saveTextFile({ defaultPath, filters, contents }: SaveTextOptions): Promise<string | null> {
    const selected = await save({ defaultPath, filters });
    if (!selected) return null;
    await invoke("save_text_file", { path: selected, contents });
    return selected;
}
