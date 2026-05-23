import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";
import { randomUUID } from "node:crypto";

// 从 SQLite 读取的原始记录类型
interface IDbRecord {
    Id: string;
    StartTime: string;
    EndTime: string;
    Duration: number;
    Notes: string | null;
}

interface IDailyCount {
    Date: string;
    Count: number;
}

interface IImportResult {
    Imported: number;
    Skipped: number;
    Rejected: number;
}

const TABLE_NAME = "Records";

export class DatabaseService {
    private readonly _db: Database.Database;

    public constructor() {
        const dbPath: string = path.join(app.getPath("userData"), "dickhelper.db");
        this._db = new Database(dbPath);

        // WAL 模式提高并发读性能
        this._db.pragma("journal_mode = WAL");

        this._db.exec(`
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                Id        TEXT PRIMARY KEY,
                StartTime TEXT NOT NULL,
                EndTime   TEXT NOT NULL,
                Duration  REAL NOT NULL,
                Notes     TEXT
            )
        `);
    }

    public GetRecords(): IDbRecord[] {
        const stmt = this._db.prepare(
            `SELECT Id, StartTime, EndTime, Duration, Notes FROM ${TABLE_NAME} ORDER BY EndTime DESC`
        );
        return stmt.all() as IDbRecord[];
    }

    public SaveRecord(startTime: Date, endTime: Date, duration: number, notes?: string): IDbRecord {
        const id: string = randomUUID();
        const stmt = this._db.prepare(
            `INSERT INTO ${TABLE_NAME} (Id, StartTime, EndTime, Duration, Notes) VALUES (?, ?, ?, ?, ?)`
        );
        stmt.run(id, startTime.toISOString(), endTime.toISOString(), duration, notes ?? null);
        return { Id: id, StartTime: startTime.toISOString(), EndTime: endTime.toISOString(), Duration: duration, Notes: notes ?? null };
    }

    public DeleteRecord(id: string): boolean {
        const stmt = this._db.prepare(`DELETE FROM ${TABLE_NAME} WHERE Id = ?`);
        const result = stmt.run(id);
        return result.changes > 0;
    }

    public ClearAll(): void {
        this._db.prepare(`DELETE FROM ${TABLE_NAME}`).run();
    }

    public GetStats(): {
        TotalCount: number;
        AverageDuration: number;
        FrequencyPerWeek: number;
        FrequencyPerMonth: number;
    } {
        const now = new Date();

        // 本周开始（7天前）
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // 本月开始
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const totalRow = this._db
            .prepare(`SELECT COUNT(*) as count, AVG(Duration) as avgDur FROM ${TABLE_NAME}`)
            .get() as { count: number; avgDur: number | null };

        const weekRow = this._db
            .prepare(`SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE EndTime >= ?`)
            .get(oneWeekAgo.toISOString()) as { count: number };

        const monthRow = this._db
            .prepare(`SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE EndTime >= ?`)
            .get(monthStart.toISOString()) as { count: number };

        return {
            TotalCount: totalRow.count,
            AverageDuration: totalRow.avgDur ?? 0,
            FrequencyPerWeek: weekRow.count,
            FrequencyPerMonth: monthRow.count,
        };
    }

    public GetDailyCounts(startDate: string, endDate: string): IDailyCount[] {
        const stmt = this._db.prepare(`
            SELECT date(EndTime) as Date, COUNT(*) as Count
            FROM ${TABLE_NAME}
            WHERE date(EndTime) >= ? AND date(EndTime) <= ?
            GROUP BY date(EndTime)
            ORDER BY Date
        `);
        return stmt.all(startDate, endDate) as IDailyCount[];
    }

    public RecordExists(id: string): boolean {
        const row = this._db.prepare(`SELECT 1 FROM ${TABLE_NAME} WHERE Id = ?`).get(id);
        return row !== undefined;
    }

    // 批量导入（带去重），返回导入统计
    public ImportRecords(
        records: { Id: string; StartTime?: string; EndTime?: string; Duration: number; Notes?: string }[]
    ): IImportResult {
        const insertStmt = this._db.prepare(
            `INSERT INTO ${TABLE_NAME} (Id, StartTime, EndTime, Duration, Notes) VALUES (?, ?, ?, ?, ?)`
        );

        const imported: string[] = [];
        let rejected: number = 0;

        for (const record of records) {
            // 验证必填字段
            if (!record.Id || typeof record.Id !== "string") {
                rejected++;
                continue;
            }
            if (typeof record.Duration !== "number" || record.Duration < 0) {
                rejected++;
                continue;
            }
            const endTimeStr: string = record.EndTime ?? record.StartTime ?? "";
            // 尝试解析日期
            const endDate = new Date(endTimeStr);
            if (isNaN(endDate.getTime())) {
                rejected++;
                continue;
            }

            // 去重
            if (this.RecordExists(record.Id)) {
                continue;
            }

            // StartTime: 新版字段优先，否则用 EndTime 减去 Duration 推算
            const startTimeStr: string = record.StartTime ?? "";
            const startDate = new Date(startTimeStr);
            let finalStartTime: Date;
            if (!isNaN(startDate.getTime())) {
                finalStartTime = startDate;
            } else {
                // 能从 Duration 反推开始时间
                finalStartTime = new Date(endDate.getTime() - record.Duration * 60 * 1000);
            }

            insertStmt.run(
                record.Id,
                finalStartTime.toISOString(),
                endDate.toISOString(),
                record.Duration,
                record.Notes ?? null
            );
            imported.push(record.Id);
        }

        // 计算跳过的重复记录
        const totalValid = records.length - rejected;
        const skipped = totalValid - imported.length;

        return { Imported: imported.length, Skipped: skipped, Rejected: rejected };
    }

    public Close(): void {
        this._db.close();
    }
}
