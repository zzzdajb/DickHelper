# Telemetry Daily 查询指南

> 用于查询 Cloudflare Workers D1 数据库中 `telemetry_daily` 表的常用 SQL。

## 表结构

```sql
CREATE TABLE IF NOT EXISTS telemetry_daily (
    uuid         TEXT NOT NULL,
    date         TEXT NOT NULL,          -- 'YYYY-MM-DD' UTC+8
    platform     TEXT NOT NULL,          -- 'desktop' / 'mobile'
    app_version  TEXT NOT NULL,
    os           TEXT NOT NULL,
    last_seen_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (uuid, date)
);
```

主键为 `(uuid, date)`，同一设备每天会有一条记录。

---

## 查询唯一设备列表

### 方法一：子查询（简洁）

```sql
SELECT uuid, platform, app_version, os, date, last_seen_at
FROM telemetry_daily
WHERE date = (
    SELECT MAX(t2.date)
    FROM telemetry_daily t2
    WHERE t2.uuid = telemetry_daily.uuid
)
ORDER BY last_seen_at DESC;
```

### 方法二：窗口函数（推荐，大数据量更高效）

```sql
SELECT uuid, platform, app_version, os, date, last_seen_at
FROM (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY uuid ORDER BY date DESC) AS rn
    FROM telemetry_daily
)
WHERE rn = 1
ORDER BY last_seen_at DESC;
```

---

## 统计唯一设备数量

```sql
SELECT COUNT(DISTINCT uuid) AS unique_devices FROM telemetry_daily;
```

---

## 按平台统计

```sql
SELECT platform, COUNT(DISTINCT uuid) AS unique_devices
FROM telemetry_daily
GROUP BY platform;
```

---

## 按日期统计活跃设备

```sql
SELECT date, COUNT(DISTINCT uuid) AS active_devices
FROM telemetry_daily
GROUP BY date
ORDER BY date DESC;
```
