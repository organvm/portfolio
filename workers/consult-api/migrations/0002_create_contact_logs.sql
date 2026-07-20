CREATE TABLE IF NOT EXISTS contact_logs (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  name TEXT,
  email TEXT NOT NULL,
  audience TEXT NOT NULL,
  offer TEXT,
  message TEXT NOT NULL,
  source TEXT,
  source_page TEXT,
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_contact_logs_created_at ON contact_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_logs_audience ON contact_logs(audience);
