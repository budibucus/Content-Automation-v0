ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS scheduled_for timestamptz;
ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS revision_notes text;
