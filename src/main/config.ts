import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { randomUUID } from "node:crypto";

interface ICachedCommunityStats {
    WeekId: string;
    MedianCount: number;
    MedianDuration: number;
    SampleSize: number;
    FetchedAt: string;
}

interface IConfigData {
    CommunityOptIn: boolean;
    ContributorId: string | null;
    ApiEndpoint: string;
    LastSubmitTime: string | null;
    CachedCommunityStats: ICachedCommunityStats | null;
}

const DEFAULT_API_ENDPOINT = "https://dickhelper-api.your-worker.workers.dev";

const DEFAULT_CONFIG: IConfigData = {
    CommunityOptIn: false,
    ContributorId: null,
    ApiEndpoint: DEFAULT_API_ENDPOINT,
    LastSubmitTime: null,
    CachedCommunityStats: null,
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
                LastSubmitTime: typeof parsed.LastSubmitTime === "string" ? parsed.LastSubmitTime : DEFAULT_CONFIG.LastSubmitTime,
                CachedCommunityStats: parsed.CachedCommunityStats !== null && parsed.CachedCommunityStats !== undefined
                    && typeof parsed.CachedCommunityStats === "object"
                    ? parsed.CachedCommunityStats
                    : DEFAULT_CONFIG.CachedCommunityStats,
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

    // 距离上次提交是否超过 6 小时
    public ShouldSubmit(): boolean {
        const THROTTLE_MS: number = 6 * 60 * 60 * 1000;
        if (this._config.LastSubmitTime === null) return true;
        const elapsed: number = Date.now() - new Date(this._config.LastSubmitTime).getTime();
        return elapsed >= THROTTLE_MS;
    }

    public RecordSubmitTime(): void {
        this._config.LastSubmitTime = new Date().toISOString();
        this._save();
    }

    // 社区统计缓存是否在 1 小时内
    public GetCachedCommunityStats(): ICachedCommunityStats | null {
        const CACHE_TTL_MS: number = 60 * 60 * 1000;
        const cached: ICachedCommunityStats | null = this._config.CachedCommunityStats;
        if (cached === null) return null;
        const age: number = Date.now() - new Date(cached.FetchedAt).getTime();
        if (age >= CACHE_TTL_MS) return null;
        return cached;
    }

    public SetCachedCommunityStats(stats: Omit<ICachedCommunityStats, "FetchedAt">): void {
        this._config.CachedCommunityStats = {
            ...stats,
            FetchedAt: new Date().toISOString(),
        };
        this._save();
    }
}
