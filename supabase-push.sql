create table if not exists public.push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  user_id text not null default 'personal-workbench',
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
