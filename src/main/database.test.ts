import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock electron and fs before importing DatabaseService
vi.mock("electron", () => ({
  app: { getPath: () => "/tmp/test" },
}));
vi.mock("node:fs", () => ({
  default: {
    existsSync: () => false,
    writeFileSync: vi.fn(),
  },
}));
vi.mock("node:crypto", async () => {
  let counter = 0;
  return {
    randomUUID: () => `test-uuid-${++counter}`,
  };
});

import { DatabaseService } from "./database";

describe("DatabaseService", () => {
  let db: DatabaseService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-20T12:00:00Z"));
    vi.clearAllMocks();
    db = await DatabaseService.create();
  });

  afterEach(() => {
    db.Close();
    vi.useRealTimers();
  });

  describe("create", () => {
    it("初始化空数据库，无记录", () => {
      expect(db.GetRecords()).toEqual([]);
    });
  });

  describe("SaveRecord", () => {
    it("保存记录并返回正确字段", () => {
      const start = new Date("2026-01-01T10:00:00Z");
      const end = new Date("2026-01-01T10:05:00Z");

      const record = db.SaveRecord(start, end, 5, "test note");

      expect(record.Id).toBeTruthy();
      expect(record.StartTime).toBe(start.toISOString());
      expect(record.EndTime).toBe(end.toISOString());
      expect(record.Duration).toBe(5);
      expect(record.Notes).toBe("test note");
    });

    it("Notes 为空时存 null", () => {
      const record = db.SaveRecord(
        new Date("2026-01-01T10:00:00Z"),
        new Date("2026-01-01T10:05:00Z"),
        5
      );
      expect(record.Notes).toBeNull();
    });
  });

  describe("GetRecords", () => {
    it("按 EndTime 降序排列", () => {
      db.SaveRecord(
        new Date("2026-01-01T10:00:00Z"),
        new Date("2026-01-01T10:05:00Z"),
        5
      );
      db.SaveRecord(
        new Date("2026-01-02T10:00:00Z"),
        new Date("2026-01-02T10:10:00Z"),
        10
      );

      const records = db.GetRecords();
      expect(records).toHaveLength(2);
      expect(records[0]!.EndTime > records[1]!.EndTime).toBe(true);
    });
  });

  describe("DeleteRecord", () => {
    it("删除存在的记录返回 true", () => {
      const record = db.SaveRecord(
        new Date("2026-01-01T10:00:00Z"),
        new Date("2026-01-01T10:05:00Z"),
        5
      );

      expect(db.DeleteRecord(record.Id)).toBe(true);
      expect(db.GetRecords()).toHaveLength(0);
    });

    it("删除不存在的记录返回 false", () => {
      expect(db.DeleteRecord("nonexistent")).toBe(false);
    });
  });

  describe("ClearAll", () => {
    it("清空所有记录", () => {
      db.SaveRecord(new Date(), new Date(), 1);
      db.SaveRecord(new Date(), new Date(), 2);

      db.ClearAll();
      expect(db.GetRecords()).toHaveLength(0);
    });
  });

  describe("GetStats", () => {
    it("无记录时全部为零", () => {
      const stats = db.GetStats();

      expect(stats.TotalCount).toBe(0);
      expect(stats.AverageDuration).toBe(0);
      expect(stats.FrequencyPerWeek).toBe(0);
      expect(stats.FrequencyPerMonth).toBe(0);
    });

    it("正确计算总数和平均时长", () => {
      db.SaveRecord(new Date(), new Date(), 4);
      db.SaveRecord(new Date(), new Date(), 6);

      const stats = db.GetStats();
      expect(stats.TotalCount).toBe(2);
      expect(stats.AverageDuration).toBe(5);
    });

    it("正确计算周频率（过去7天内的记录）", () => {
      // 系统时间固定在 2026-01-20T12:00:00Z
      // 7天内的记录
      db.SaveRecord(
        new Date("2026-01-18T10:00:00Z"),
        new Date("2026-01-18T10:05:00Z"),
        5
      );
      db.SaveRecord(
        new Date("2026-01-19T10:00:00Z"),
        new Date("2026-01-19T10:05:00Z"),
        5
      );
      // 7天外的记录
      db.SaveRecord(
        new Date("2026-01-10T10:00:00Z"),
        new Date("2026-01-10T10:05:00Z"),
        5
      );

      const stats = db.GetStats();
      expect(stats.TotalCount).toBe(3);
      expect(stats.FrequencyPerWeek).toBe(2);
    });

    it("正确计算月频率（本月内的记录）", () => {
      // 系统时间固定在 2026-01-20，本月从 2026-01-01 开始
      db.SaveRecord(
        new Date("2026-01-05T10:00:00Z"),
        new Date("2026-01-05T10:05:00Z"),
        5
      );
      db.SaveRecord(
        new Date("2026-01-15T10:00:00Z"),
        new Date("2026-01-15T10:05:00Z"),
        5
      );
      // 上月的记录
      db.SaveRecord(
        new Date("2025-12-25T10:00:00Z"),
        new Date("2025-12-25T10:05:00Z"),
        5
      );

      const stats = db.GetStats();
      expect(stats.TotalCount).toBe(3);
      expect(stats.FrequencyPerMonth).toBe(2);
    });
  });

  describe("GetDailyCounts", () => {
    it("返回日期范围内的每日计数", () => {
      const day1 = new Date("2026-01-15T10:00:00Z");
      const day2 = new Date("2026-01-16T10:00:00Z");

      db.SaveRecord(day1, day1, 5);
      db.SaveRecord(day1, day1, 3);
      db.SaveRecord(day2, day2, 4);

      const counts = db.GetDailyCounts(
        new Date("2026-01-01T00:00:00Z").getTime(),
        new Date("2026-01-31T23:59:59Z").getTime()
      );

      expect(counts).toHaveLength(2);
      expect(counts[0]!.Count).toBe(2);
      expect(counts[1]!.Count).toBe(1);
    });

    it("范围外的记录不计入", () => {
      db.SaveRecord(
        new Date("2026-02-01T10:00:00Z"),
        new Date("2026-02-01T10:00:00Z"),
        5
      );

      const counts = db.GetDailyCounts(
        new Date("2026-01-01T00:00:00Z").getTime(),
        new Date("2026-01-31T23:59:59Z").getTime()
      );
      expect(counts).toHaveLength(0);
    });
  });

  describe("RecordExists", () => {
    it("存在返回 true，不存在返回 false", () => {
      const record = db.SaveRecord(new Date(), new Date(), 5);
      expect(db.RecordExists(record.Id)).toBe(true);
      expect(db.RecordExists("ghost")).toBe(false);
    });
  });

  describe("ImportRecords", () => {
    it("成功导入有效记录", () => {
      const result = db.ImportRecords([
        {
          Id: "import-1",
          StartTime: "2026-01-01T10:00:00Z",
          EndTime: "2026-01-01T10:05:00Z",
          Duration: 5,
          Notes: "imported",
        },
      ]);

      expect(result.Imported).toBe(1);
      expect(result.Skipped).toBe(0);
      expect(result.Rejected).toBe(0);
      expect(db.GetRecords()).toHaveLength(1);
    });

    it("跳过重复 ID", () => {
      db.ImportRecords([
        { Id: "dup-1", EndTime: "2026-01-01T10:00:00Z", Duration: 5 },
      ]);
      const result = db.ImportRecords([
        { Id: "dup-1", EndTime: "2026-01-01T10:00:00Z", Duration: 5 },
      ]);

      expect(result.Imported).toBe(0);
      expect(result.Skipped).toBe(1);
    });

    it("拒绝缺少 Id 的记录", () => {
      const result = db.ImportRecords([
        { Id: "", EndTime: "2026-01-01T10:00:00Z", Duration: 5 },
      ]);
      expect(result.Rejected).toBe(1);
      expect(result.Imported).toBe(0);
    });

    it("拒绝 Duration 为负数的记录", () => {
      const result = db.ImportRecords([
        { Id: "neg-1", EndTime: "2026-01-01T10:00:00Z", Duration: -1 },
      ]);
      expect(result.Rejected).toBe(1);
    });

    it("拒绝日期无效的记录", () => {
      const result = db.ImportRecords([
        { Id: "bad-date", EndTime: "not-a-date", Duration: 5 },
      ]);
      expect(result.Rejected).toBe(1);
    });

    it("无 StartTime 时从 EndTime - Duration 推算", () => {
      db.ImportRecords([
        { Id: "no-start", EndTime: "2026-01-01T10:05:00Z", Duration: 5 },
      ]);

      const records = db.GetRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.StartTime).toBe("2026-01-01T10:00:00.000Z");
    });

    it("旧版格式：只有 StartTime 没有 EndTime 时，StartTime 映射为 EndTime", () => {
      db.ImportRecords([
        { Id: "legacy-1", StartTime: "2026-01-01T10:00:00Z", Duration: 5 },
      ]);

      const records = db.GetRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.EndTime).toBe("2026-01-01T10:00:00.000Z");
    });
  });
});
