-- Migration: 006_add_terms_accepted_at.sql
-- Records when a user accepted the Terms & Conditions and Privacy Policy.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
