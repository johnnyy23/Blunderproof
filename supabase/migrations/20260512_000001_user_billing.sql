-- Stores Stripe subscription state keyed by app user id.
-- Service-role writes (via `supabaseAdmin`) bypass RLS.

create table if not exists public.user_billing (
  app_user_id text primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  cancel_at_period_end boolean,
  trial_end timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_billing enable row level security;

-- Optional: allow authenticated users to read their own billing row (if/when you add Supabase auth).
-- create policy "read own billing" on public.user_billing
-- for select to authenticated
-- using (auth.uid()::text = app_user_id);
