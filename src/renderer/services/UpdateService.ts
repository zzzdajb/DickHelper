import type { IUpdateSettings, IUpdateState, UpdateSource } from "../types/IUpdate";

function GetApi(): Window["electronAPI"] {
    const api: Window["electronAPI"] | undefined = window.electronAPI;

    if (api === undefined) {
        throw new Error(
            "electronAPI is not available. The app must run inside Electron, not a browser. " +
            "The preload script may have failed to load. Check the terminal for [Preload] log messages."
        );
    }

    return api;
}

export class UpdateService {
    public static GetState(): Promise<IUpdateState> {
        return GetApi().GetUpdateState();
    }

    public static GetSettings(): Promise<IUpdateSettings> {
        return GetApi().GetUpdateSettings();
    }

    public static SetSource(source: UpdateSource): Promise<IUpdateSettings> {
        return GetApi().SetUpdateSource(source);
    }

    public static CheckForUpdates(): Promise<IUpdateState> {
        return GetApi().CheckForUpdates();
    }

    public static DownloadUpdate(): Promise<IUpdateState> {
        return GetApi().DownloadUpdate();
    }

    public static InstallUpdate(): Promise<void> {
        return GetApi().InstallUpdate();
    }

    public static OnUpdateStateChanged(callback: (state: IUpdateState) => void): () => void {
        return GetApi().OnUpdateStateChanged(callback);
    }
}
