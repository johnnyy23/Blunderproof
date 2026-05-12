-- Replaces on-disk JSON stores with Supabase persistence.
-- Vercel serverless functions cannot rely on local filesystem writes.

create table if not exists public.app_users (
  id text primary key,
  name text not null,
  email text not null,
  password_hash text not null,
  password_salt text not null,
  created_at timestamptz not null default now(),
  membership_plan text not null default 'free',
  membership_status text not null default 'active',
  billing_email text,
  billing_cycle text,
  billing_state text not null default 'none',
  trial_ends_at timestamptz,
  billing_started_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  affiliate_id text,
  referral_code text,
  referred_at timestamptz
);

create unique index if not exists app_users_email_unique on public.app_users (lower(email));

alter table public.app_users enable row level security;

create table if not exists public.app_sessions (
  token text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions (expires_at);

alter table public.app_sessions enable row level security;

create table if not exists public.affiliate_clicks (
  id text primary key,
  affiliate_id text not null,
  referral_code text not null,
  landing_page text not null,
  ip_hash text not null,
  user_agent text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  clicked_at timestamptz not null default now()
);

create index if not exists affiliate_clicks_affiliate_id_idx on public.affiliate_clicks (affiliate_id);
create index if not exists affiliate_clicks_clicked_at_idx on public.affiliate_clicks (clicked_at);

alter table public.affiliate_clicks enable row level security;