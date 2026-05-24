export type UpdateSource = "mirror" | "github";

export type UpdateStatus =
    | "idle"
    | "checking"
    | "available"
    | "not-available"
    | "downloading"
    | "downloaded"
    | "error"
    | "disabled";

export interface IUpdateSettings {
    readonly Source: UpdateSource;
    readonly FeedUrl: string;
}

export interface IUpdateState {
    readonly Status: UpdateStatus;
    readonly Source: UpdateSource;
    readonly CurrentVersion: string;
    readonly AvailableVersion: string | null;
    readonly DownloadProgress: number | null;
    readonly ErrorMessage: string | null;
    readonly IsChecking: boolean;
    readonly IsUpdateAvailable: boolean;
    readonly IsDownloading: boolean;
    readonly IsUpdateDownloaded: boolean;
}
