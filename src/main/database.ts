import initSqlJs, { type Database, type SqlJsStatic, type BindParams, type ParamsObject } from "sql.js";
import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { randomUUID } from "node:crypto";
import type {
    IDailyCount,
    IHourlyCount,
    IImportResult,
    IMonthlyCount,
    IWeekdayCount,
} from "@dickhelper/shared";

// 从 SQLite 读取的原始记录类型
interface IDbRecord {
    Id: string;
    StartTime: string;
    EndTime: string;
    Duration: number;
    Notes: string | null;
}

interface IImportRecord {
    Id: string;
    StartTime?: string;
    EndTime?: string;
    Duration: number;
    Notes?: string;
}

const TABLE_NAME = "Records";
const SETTINGS_TABLE_NAME = "Settings";

export class DatabaseService {
    private readonly _db: Database;
    private readonly _dbPath: string;

    private constructor(db: Database, dbPath: string) {
        this._db = db;
        this._dbPath = dbPath;
    }

    // Async factory — replaces sync constructor
    public static async create(): Promise<DatabaseService> {
        const SQL: SqlJsStatic = await initSqlJs();
        const dbPath = path.join(app.getPath("userData"), "dickhelper.db");
        let db: Database;
        if (fs.existsSync(dbPath)) {
            const buffer = fs.readFileSync(dbPath);
            db = new SQL.Database(buffer);
        } else {
            db = new SQL.Database();
        }
        db.run(`
            CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
                Id        TEXT PRIMARY KEY,
                StartTime TEXT NOT NULL,
                EndTime   TEXT NOT NULL,
                Duration  REAL NOT NULL,
                Notes     TEXT
            )
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS ${SETTINGS_TABLE_NAME} (
                Key   TEXT PRIMARY KEY,
                Value TEXT NOT NULL
            )
        `);
        return new DatabaseService(db, dbPath);
    }

    private _save(): void {
        const data = this._db.export();
        fs.writeFileSync(this._dbPath, data);
    }

    /** Execute a SELECT query and return all rows as objects */
    private _queryAll(sql: string, params?: BindParams): ParamsObject[] {
        const stmt = this._db.prepare(sql);
        if (params !== undefined) {
            stmt.bind(params);
        }
        const rows: ParamsObject[] = [];
        while (stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    /** Execute a SELECT query and return the first row as an object, or undefined */
    private _queryOne(sql: string, params?: BindParams): ParamsObject | undefined {
        const stmt = this._db.prepare(sql);
        if (params !== undefined) {
            stmt.bind(params);
        }
        let row: ParamsObject | undefined;
        if (stmt.step()) {
            row = stmt.getAsObject();
        }
        stmt.free();
        return row;
    }

    public GetRecords(): IDbRecord[] {
        const rows = this._queryAll(
            `SELECT Id, StartTime, EndTime, Duration, Notes FROM ${TABLE_NAME} ORDER BY EndTime DESC`
        );
        return rows as unknown as IDbRecord[];
    }

    public SaveRecord(startTime: Date, endTime: Date, duration: number, notes?: string): IDbRecord {
        const id: string = randomUUID();
        const stmt = this._db.prepare(
            `INSERT INTO ${TABLE_NAME} (Id, StartTime, EndTime, Duration, Notes) VALUES (?, ?, ?, ?, ?)`
        );
        stmt.run([id, startTime.toISOString(), endTime.toISOString(), duration, notes ?? null]);
        stmt.free();
        this._save();
        return { Id: id, StartTime: startTime.toISOString(), EndTime: endTime.toISOString(), Duration: duration, Notes: notes ?? null };
    }

    public DeleteRecord(id: string): boolean {
        const stmt = this._db.prepare(`DELETE FROM ${TABLE_NAME} WHERE Id = ?`);
        stmt.run([id]);
        const changes = this._db.getRowsModified();
        stmt.free();
        this._save();
        return changes > 0;
    }

    public ClearAll(): void {
        const stmt = this._db.prepare(`DELETE FROM ${TABLE_NAME}`);
        stmt.run();
        stmt.free();
        this._save();
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

        const totalRow = this._queryOne(
            `SELECT COUNT(*) as count, AVG(Duration) as avgDur FROM ${TABLE_NAME}`
        );

        const weekRow = this._queryOne(
            `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE EndTime >= ?`,
            [oneWeekAgo.toISOString()]
        );

        const monthRow = this._queryOne(
            `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE EndTime >= ?`,
            [monthStart.toISOString()]
        );

        return {
            TotalCount: (totalRow?.count as number) ?? 0,
            AverageDuration: (totalRow?.avgDur as number) ?? 0,
            FrequencyPerWeek: (weekRow?.count as number) ?? 0,
            FrequencyPerMonth: (monthRow?.count as number) ?? 0,
        };
    }

    public GetDailyCounts(startTimestamp: number, endTimestamp: number): IDailyCount[] {
        const rows = this._queryAll(
            `SELECT EndTime FROM ${TABLE_NAME} WHERE EndTime >= ? AND EndTime <= ?`,
            [new Date(startTimestamp).toISOString(), new Date(endTimestamp).toISOString()]
        );

        const countMap = new Map<string, number>();
        for (const row of rows) {
            const d = new Date((row as { EndTime: string }).EndTime);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }

        const result: IDailyCount[] = [];
        for (const [date, count] of countMap) {
            result.push({ Date: date, Count: count });
        }
        result.sort((a, b) => a.Date.localeCompare(b.Date));
        return result;
    }

    /** 按小时统计次数（0-23，使用本地时区） */
    public GetHourlyDistribution(): IHourlyCount[] {
        const rows = this._queryAll(`SELECT EndTime FROM ${TABLE_NAME}`);
        const counts: number[] = new Array(24).fill(0);

        for (const row of rows) {
            const d = new Date((row as { EndTime: string }).EndTime);
            counts[d.getHours()] = (counts[d.getHours()] ?? 0) + 1;
        }

        const result: IHourlyCount[] = [];
        for (let hour = 0; hour < counts.length; hour++) {
            result.push({ Hour: hour, Count: counts[hour] ?? 0 });
        }
        return result;
    }

    /** 按星期统计次数（0=周一，6=周日，使用本地时区） */
    public GetWeekdayDistribution(): IWeekdayCount[] {
        const rows = this._queryAll(`SELECT EndTime FROM ${TABLE_NAME}`);
        const counts: number[] = new Array(7).fill(0);

        for (const row of rows) {
            const d = new Date((row as { EndTime: string }).EndTime);
            const weekday: number = (d.getDay() + 6) % 7;
            counts[weekday] = (counts[weekday] ?? 0) + 1;
        }

        const result: IWeekdayCount[] = [];
        for (let weekday = 0; weekday < counts.length; weekday++) {
            result.push({ Weekday: weekday, Count: counts[weekday] ?? 0 });
        }
        return result;
    }

    /** 按月统计次数（最近 12 个月，使用本地时区） */
    public GetMonthlyTrend(): IMonthlyCount[] {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const rows = this._queryAll(
            `SELECT EndTime FROM ${TABLE_NAME} WHERE EndTime >= ?`,
            [startDate.toISOString()]
        );

        const countMap = new Map<string, number>();
        for (const row of rows) {
            const d = new Date((row as { EndTime: string }).EndTime);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            countMap.set(key, (countMap.get(key) ?? 0) + 1);
        }

        const result: IMonthlyCount[] = [];
        const cursor = new Date(startDate);
        while (cursor <= now) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
            result.push({ Month: key, Count: countMap.get(key) ?? 0 });
            cursor.setMonth(cursor.getMonth() + 1);
        }

        return result;
    }

    /** 获取所有记录的持续时长（分钟） */
    public GetAllDurations(): number[] {
        const rows = this._queryAll(`SELECT Duration FROM ${TABLE_NAME}`);
        const durations: number[] = [];
        for (const row of rows) {
            durations.push((row as { Duration: number }).Duration);
        }
        return durations;
    }

    public RecordExists(id: string): boolean {
        const row = this._queryOne(
            `SELECT 1 FROM ${TABLE_NAME} WHERE Id = ?`,
            [id]
        );
        return row !== undefined;
    }

    // 批量导入（带去重），返回导入统计
    public ImportRecords(records: IImportRecord[]): IImportResult {
        const stmt = this._db.prepare(
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

            stmt.bind([record.Id, finalStartTime.toISOString(), endDate.toISOString(), record.Duration, record.Notes ?? null]);
            stmt.step();
            stmt.reset();
            imported.push(record.Id);
        }

        stmt.free();
        this._save();

        // 计算跳过的重复记录
        const totalValid = records.length - rejected;
        const skipped = totalValid - imported.length;

        return { Imported: imported.length, Skipped: skipped, Rejected: rejected };
    }

    /** 读取设置项 */
    public GetSetting(key: string): string | null {
        const row = this._queryOne(`SELECT Value FROM ${SETTINGS_TABLE_NAME} WHERE Key = ?`, [key]);
        return row !== undefined ? (row.Value as string) : null;
    }

    /** 写入设置项 */
    public SetSetting(key: string, value: string): void {
        const stmt = this._db.prepare(
            `INSERT OR REPLACE INTO ${SETTINGS_TABLE_NAME} (Key, Value) VALUES (?, ?)`
        );
        stmt.run([key, value]);
        stmt.free();
        this._save();
    }

    public Close(): void {
        this._db.close();
    }
}
