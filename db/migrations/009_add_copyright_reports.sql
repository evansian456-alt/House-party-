-- Migration: 008_add_copyright_reports.sql
-- Creates the copyright_reports table for tracking user-submitted copyright infringement reports.

CREATE TABLE IF NOT EXISTS copyright_reports (
  id SERIAL PRIMARY KEY,
  track_id TEXT NOT NULL,
  party_id TEXT NOT NULL,
  reporter_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('copyright_infringement', 'unauthorized_upload', 'other')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'removed', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_copyright_reports_track_id ON copyright_reports(track_id);
CREATE INDEX IF NOT EXISTS idx_copyright_reports_party_id ON copyright_reports(party_id);
CREATE INDEX IF NOT EXISTS idx_copyright_reports_status ON copyright_reports(status);
CREATE INDEX IF NOT EXISTS idx_copyright_reports_created_at ON copyright_reports(created_at DESC);
