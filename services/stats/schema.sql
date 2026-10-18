-- One table: counters, dedupe keys and rate-limit buckets. Keys are hashes or widget ids,
-- never IP addresses or raw tokens. Rows with `exp` set are deleted by the daily purge.
CREATE TABLE IF NOT EXISTS kv (
  k   TEXT PRIMARY KEY NOT NULL,
  n   INTEGER NOT NULL DEFAULT 0,
  exp INTEGER -- unix milliseconds, NULL = never expires (counters)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS kv_exp ON kv (exp) WHERE exp IS NOT NULL;
