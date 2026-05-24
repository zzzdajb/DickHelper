import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { randomUUID } from "node:crypto";

interface IConfigData {
    CommunityOptIn: boolean;
    ContributorId: string | null;
    ApiEndpoint: string;
}

const DEFAULT_API_ENDPOINT = "https://dickhelper-api.your-worker.workers.dev";

const DEFAULT_CONFIG: IConfigData = {
    CommunityOptIn: false,
    ContributorId: null,
    ApiEndpoint: DEFAULT_API_ENDPOINT,
};

export class ConfigService {
    private _config: IConfigData;
    private readonly _configPath: string;

    public constructor() {
        this._configPath = path.join(app.getPath("userData"), "config.json");
        this._config = this._load();
    }

    private _load(): IConfigData {
        if (!fs.existsSync(this._configPath)) {
            return { ...DEFAULT_CONFIG };
        }
        try {
            const raw: string = fs.readFileSync(this._configPath, "utf-8");
            const parsed: Partial<IConfigData> = JSON.parse(raw);
            return {
                CommunityOptIn: typeof parsed.CommunityOptIn === "boolean" ? parsed.CommunityOptIn : DEFAULT_CONFIG.CommunityOptIn,
                ContributorId: typeof parsed.ContributorId === "string" ? parsed.ContributorId : DEFAULT_CONFIG.ContributorId,
                ApiEndpoint: typeof parsed.ApiEndpoint === "string" ? parsed.ApiEndpoint : DEFAULT_CONFIG.ApiEndpoint,
            };
        } catch {
            return { ...DEFAULT_CONFIG };
        }
    }

    private _save(): void {
        fs.writeFileSync(this._configPath, JSON.stringify(this._config, null, 2), "utf-8");
    }

    public GetConfig(): IConfigData {
        return { ...this._config };
    }

    // 仅允许设置 CommunityOptIn，ApiEndpoint 不通过 IPC 暴露
    public SetConfig(partial: { CommunityOptIn?: boolean }): IConfigData {
        if (partial.CommunityOptIn !== undefined) {
            this._config.CommunityOptIn = partial.CommunityOptIn;
            // 首次 opt-in 时生成 contributorId
            if (partial.CommunityOptIn && this._config.ContributorId === null) {
                this._config.ContributorId = randomUUID();
            }
        }
        this._save();
        return { ...this._config };
    }
}
