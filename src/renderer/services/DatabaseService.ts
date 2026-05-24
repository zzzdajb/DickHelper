import type { IRecord, IRecordRaw, IStats, IDailyCount, IImportResult } from "@dickhelper/shared";

// 检查 electronAPI 是否可用，不在 Electron 环境时给出明确错误
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

/**
 * 封装渲染进程与主进程 SQLite 之间的 IPC 通信
 * 负责数据格式转换（ISO 字符串 <-> Date 对象）和导入导出逻辑
 */
export class DatabaseService {
    /**
     * 获取所有记录，ISO 字符串转 Date
     */
    public static async GetRecords(): Promise<IRecord[]> {
        const rawRecords: IRecordRaw[] = await GetApi().GetRecords();
        return rawRecords.map((r) => DatabaseService.MapRawToRecord(r));
    }

    /**
     * 保存新记录，Date 转 ISO 字符串后通过 IPC 发送
     */
    public static async SaveRecord(
        startTime: Date,
        endTime: Date,
        duration: number,
        notes?: string
    ): Promise<IRecord> {
        const raw: IRecordRaw = await GetApi().SaveRecord(
            startTime.toISOString(),
            endTime.toISOString(),
            duration,
            notes
        );
        return DatabaseService.MapRawToRecord(raw);
    }

    public static async DeleteRecord(id: string): Promise<boolean> {
        return GetApi().DeleteRecord(id);
    }

    public static async ClearAll(): Promise<void> {
        return GetApi().ClearAll();
    }

    public static async GetStats(): Promise<IStats> {
        return GetApi().GetStats();
    }

    public static async GetDailyCounts(startDate: Date, endDate: Date): Promise<IDailyCount[]> {
        return GetApi().GetDailyCounts(startDate.getTime(), endDate.getTime());
    }

    /**
     * 导入记录（支持旧版格式自动识别和字段映射）
     * 旧版格式：数组，每项含 id/startTime/duration，无 version 字段
     * 新版格式：{ version: 1, records: [...] }
     */
    public static async ImportFromJson(jsonText: string): Promise<IImportResult> {
        let rawData: unknown;
        try {
            rawData = JSON.parse(jsonText);
        } catch {
            return { Imported: 0, Skipped: 0, Rejected: 0 };
        }

        let records: { Id: string; StartTime?: string; EndTime?: string; Duration: number; Notes?: string }[];

        if (Array.isArray(rawData)) {
            // 旧版格式：JSON 数组
            records = rawData.map((item: Record<string, unknown>) => ({
                Id: String(item.id ?? ""),
                // 旧版 startTime 实际是结束时间，映射到 EndTime
                EndTime: String(item.startTime ?? ""),
                StartTime: undefined,
                Duration: Number(item.duration ?? 0),
                Notes: item.notes != null ? String(item.notes) : undefined,
            }));
        } else if (
            typeof rawData === "object" &&
            rawData !== null &&
            "version" in rawData &&
            "records" in rawData &&
            Array.isArray((rawData as Record<string, unknown>).records)
        ) {
            // 新版格式
            records = ((rawData as Record<string, unknown>).records as Record<string, unknown>[]).map((item) => ({
                Id: String(item.Id ?? ""),
                StartTime: String(item.StartTime ?? ""),
                EndTime: String(item.EndTime ?? ""),
                Duration: Number(item.Duration ?? 0),
                Notes: item.Notes !== undefined && item.Notes !== null ? String(item.Notes) : undefined,
            }));
        } else {
            return { Imported: 0, Skipped: 0, Rejected: 0 };
        }

        return GetApi().ImportRecords(records);
    }

    /**
     * 导出记录为 JSON（新版格式，带 version 字段）
     * 兼容旧版导入：导出的数据仍可被旧版识别
     */
    public static ExportToJson(records: IRecord[]): string {
        const exportData = {
            version: 1,
            records: records.map((r) => ({
                Id: r.Id,
                StartTime: r.StartTime.toISOString(),
                EndTime: r.EndTime.toISOString(),
                Duration: r.Duration,
                Notes: r.Notes ?? undefined,
            })),
        };
        return JSON.stringify(exportData, null, 2);
    }

    /**
     * 注册数据更新回调，返回取消监听的函数
     */
    public static OnRecordsUpdated(callback: () => void): () => void {
        return GetApi().OnRecordsUpdated(callback);
    }

    private static MapRawToRecord(raw: IRecordRaw): IRecord {
        return {
            Id: raw.Id,
            StartTime: new Date(raw.StartTime),
            EndTime: new Date(raw.EndTime),
            Duration: raw.Duration,
            Notes: raw.Notes ?? undefined,
        };
    }
}
