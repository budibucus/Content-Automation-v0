ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS funnel_stage text;
ALTER TABLE content_pieces ADD COLUMN IF NOT EXISTS thread_posts jsonb;
