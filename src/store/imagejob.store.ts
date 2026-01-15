import { create } from "zustand";

type ImageOutputMode = "mono" | "gray" | "rgb565" | "rgb888";

interface ImageJobState {
    outputCode: string;
    outputMode: ImageOutputMode;
    imagePath: string | null;
}

interface ImageJobActions {
    setOutput: (payload: Partial<ImageJobState>) => void;
}

export const useImageJobStore = create<ImageJobState & ImageJobActions>((set, get) => ({
    outputCode: "",
    outputMode: "mono",
    imagePath: null,

    setOutput: (payload) => {
        set({ ...get(), ...payload });
    },
}));
