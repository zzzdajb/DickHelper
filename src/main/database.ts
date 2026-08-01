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
import { GetWindowStart, LAST_7_DAYS, LAST_30_DAYS } from "@dickhelper/core";

// 从 SQLite 读取的原始记录类型
interface IDbRecord {
    Id: string;
    StartTime: string;
    EndTime: string;
    Duration: number;
    Notes: string | null;
    Deleted: number;
    DeletedAt: string | null;
}

interface IImportRecord {
    Id: string;
    StartTime?: string;
    EndTime?: string;
    Duration: number;
    Notes?: string;
    Deleted?: number;
    DeletedAt?: string | null;
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

        // Migration: add Deleted and DeletedAt columns if missing
        const columns = db.exec("PRAGMA table_info(Records)");
        const columnNames = new Set(
            (columns[0]?.values ?? []).map((row) => row[1] as string)
        );
        if (!columnNames.has("Deleted")) {
            db.run(`ALTER TABLE Records ADD COLUMN Deleted INTEGER DEFAULT 0`);
        }
        if (!columnNames.has("DeletedAt")) {
            db.run(`ALTER TABLE Records ADD COLUMN DeletedAt TEXT`);
        }

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
            `SELECT Id, StartTime, EndTime, Duration, Notes, Deleted, DeletedAt FROM ${TABLE_NAME} WHERE Deleted = 0 ORDER BY EndTime DESC`
        );
        return rows as unknown as IDbRecord[];
    }

    /** Get all records including tombstones (for sync) */
    public GetAllRecordsWithTombstones(): IDbRecord[] {
        const rows = this._queryAll(
            `SELECT Id, StartTime, EndTime, Duration, Notes, Deleted, DeletedAt FROM ${TABLE_NAME} ORDER BY EndTime DESC`
        );
        return rows as unknown as IDbRecord[];
    }

    /** Get soft-deleted records (recycle bin) */
    public GetDeletedRecords(): IDbRecord[] {
        const rows = this._queryAll(
            `SELECT Id, StartTime, EndTime, Duration, Notes, Deleted, DeletedAt FROM ${TABLE_NAME} WHERE Deleted = 1 ORDER BY DeletedAt DESC`
        );
        return rows as unknown as IDbRecord[];
    }

    public SaveRecord(startTime: Date, endTime: Date, duration: number, notes?: string): IDbRecord {
        const id: string = randomUUID();
        const stmt = this._db.prepare(
            `INSERT INTO ${TABLE_NAME} (Id, StartTime, EndTime, Duration, Notes, Deleted) VALUES (?, ?, ?, ?, ?, 0)`
        );
        stmt.run([id, startTime.toISOString(), endTime.toISOString(), duration, notes ?? null]);
        stmt.free();
        this._save();
        return { Id: id, StartTime: startTime.toISOString(), EndTime: endTime.toISOString(), Duration: duration, Notes: notes ?? null, Deleted: 0, DeletedAt: null };
    }

    public DeleteRecord(id: string): boolean {
        const now = new Date().toISOString();
        const stmt = this._db.prepare(`UPDATE ${TABLE_NAME} SET Deleted = 1, DeletedAt = ? WHERE Id = ? AND Deleted = 0`);
        stmt.run([now, id]);
        const changes = this._db.getRowsModified();
        stmt.free();
        this._save();
        return changes > 0;
    }

    public ClearAll(): void {
        const now = new Date().toISOString();
        const stmt = this._db.prepare(`UPDATE ${TABLE_NAME} SET Deleted = 1, DeletedAt = ? WHERE Deleted = 0`);
        stmt.run([now]);
        stmt.free();
        this._save();
    }

    /** Restore a soft-deleted record */
    public RestoreRecord(id: string): boolean {
        const stmt = this._db.prepare(`UPDATE ${TABLE_NAME} SET Deleted = 0, DeletedAt = NULL WHERE Id = ? AND Deleted = 1`);
        stmt.run([id]);
        const changes = this._db.getRowsModified();
        stmt.free();
        this._save();
        return changes > 0;
    }

    /** Permanently delete all soft-deleted records */
    public PurgeDeleted(): void {
        const stmt = this._db.prepare(`DELETE FROM ${TABLE_NAME} WHERE Deleted = 1`);
        stmt.run();
        stmt.free();
        this._save();
    }

    public GetStats(): {
        TotalCount: number;
        AverageDuration: number;
        Last7DayCount: number;
        Last30DayCount: number;
    } {
        const now = new Date();

        // 窗口起点取自 core，与移动端和 AI 分析共用同一份天数与边界定义
        const last7Start = GetWindowStart(now, LAST_7_DAYS);
        const last30Start = GetWindowStart(now, LAST_30_DAYS);

        const totalRow = this._queryOne(
            `SELECT COUNT(*) as count, AVG(Duration) as avgDur FROM ${TABLE_NAME} WHERE Deleted = 0`
        );

        const last7Row = this._queryOne(
            `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE EndTime >= ? AND Deleted = 0`,
            [last7Start.toISOString()]
        );

        const last30Row = this._queryOne(
            `SELECT COUNT(*) as count FROM ${TABLE_NAME} WHERE EndTime >= ? AND Deleted = 0`,
            [last30Start.toISOString()]
        );

        return {
            TotalCount: (totalRow?.count as number) ?? 0,
            AverageDuration: (totalRow?.avgDur as number) ?? 0,
            Last7DayCount: (last7Row?.count as number) ?? 0,
            Last30DayCount: (last30Row?.count as number) ?? 0,
        };
    }

    public GetDailyCounts(startTimestamp: number, endTimestamp: number): IDailyCount[] {
        const rows = this._queryAll(
            `SELECT EndTime FROM ${TABLE_NAME} WHERE EndTime >= ? AND EndTime <= ? AND Deleted = 0`,
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
        const rows = this._queryAll(`SELECT EndTime FROM ${TABLE_NAME} WHERE Deleted = 0`);
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
        const rows = this._queryAll(`SELECT EndTime FROM ${TABLE_NAME} WHERE Deleted = 0`);
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
            `SELECT EndTime FROM ${TABLE_NAME} WHERE EndTime >= ? AND Deleted = 0`,
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
        const rows = this._queryAll(`SELECT Duration FROM ${TABLE_NAME} WHERE Deleted = 0`);
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
        const insertStmt = this._db.prepare(
            `INSERT INTO ${TABLE_NAME} (Id, StartTime, EndTime, Duration, Notes, Deleted, DeletedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`
        );
        const tombstoneStmt = this._db.prepare(
            `UPDATE ${TABLE_NAME} SET Deleted = 1, DeletedAt = ? WHERE Id = ? AND Deleted = 0`
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

            const incomingDeleted: number = record.Deleted ?? 0;
            const incomingDeletedAt: string | null = record.DeletedAt ?? null;

            // 如果本地已有此记录
            if (this.RecordExists(record.Id)) {
                // 如果对方标记为已删除，本地也标记为已删除（墓碑传播）
                if (incomingDeleted === 1) {
                    tombstoneStmt.bind([incomingDeletedAt ?? new Date().toISOString(), record.Id]);
                    tombstoneStmt.step();
                    tombstoneStmt.reset();
                }
                // 否则保持本地状态不变（跳过）
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

            // 内容去重：StartTime + EndTime + Duration 完全一致视为同一条记录
            if (this._queryOne(
                `SELECT 1 FROM ${TABLE_NAME} WHERE StartTime = ? AND EndTime = ? AND Duration = ?`,
                [finalStartTime.toISOString(), endDate.toISOString(), record.Duration]
            )) {
                continue;
            }

            insertStmt.bind([record.Id, finalStartTime.toISOString(), endDate.toISOString(), record.Duration, record.Notes ?? null, incomingDeleted, incomingDeletedAt]);
            insertStmt.step();
            insertStmt.reset();
            imported.push(record.Id);
        }

        insertStmt.free();
        tombstoneStmt.free();
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
