import initSqlJs, { type Database, type SqlJsStatic, type BindParams, type ParamsObject } from "sql.js";
import fs from "node:fs";
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

    public GetDailyCounts(startDate: string, endDate: string): IDailyCount[] {
        const rows = this._queryAll(`
            SELECT date(EndTime) as Date, COUNT(*) as Count
            FROM ${TABLE_NAME}
            WHERE date(EndTime) >= ? AND date(EndTime) <= ?
            GROUP BY date(EndTime)
            ORDER BY Date
        `, [startDate, endDate]);
        return rows as unknown as IDailyCount[];
    }

    public RecordExists(id: string): boolean {
        const row = this._queryOne(
            `SELECT 1 FROM ${TABLE_NAME} WHERE Id = ?`,
            [id]
        );
        return row !== undefined;
    }

    // 批量导入（带去重），返回导入统计
    public ImportRecords(
        records: { Id: string; StartTime?: string; EndTime?: string; Duration: number; Notes?: string }[]
    ): IImportResult {
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

    public Close(): void {
        this._db.close();
    }
}
