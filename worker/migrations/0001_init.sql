CREATE TABLE IF NOT EXISTS stats (
    contributor_id TEXT NOT NULL,
    week_id        TEXT NOT NULL,
    count          INTEGER NOT NULL,
    avg_duration   REAL NOT NULL,
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (contributor_id, week_id)
);

CREATE INDEX IF NOT EXISTS idx_stats_week ON stats (week_id);
