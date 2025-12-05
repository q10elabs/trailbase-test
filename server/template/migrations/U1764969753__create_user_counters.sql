-- Migration: Create user_counters table for counter experiment
-- Each user gets their own counter record

CREATE TABLE IF NOT EXISTS user_counters (
  id           INTEGER PRIMARY KEY,
  user         BLOB NOT NULL,
  counter_value INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user) REFERENCES _user(id) ON DELETE CASCADE,
  UNIQUE(user)
) STRICT;

-- Create index on user column for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_counters_user ON user_counters(user);
