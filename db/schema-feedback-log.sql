create table content_feedback_log (
  id uuid primary key default gen_random_uuid(),
  content_piece_id uuid references content_pieces(id),
  notes text not null,
  created_at timestamptz default now()
);
