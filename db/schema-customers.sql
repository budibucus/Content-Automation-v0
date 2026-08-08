create table customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  phone text,
  password_hash text,
  status text default 'paid_not_activated',
  created_at timestamptz default now()
);
