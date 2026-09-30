-- ============================================================================
-- ProfJohns — Subscriptions table (Stripe billing sync)
-- Idempotent: safe to re-run. Drops and recreates policies only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Subscriptions — one row per user, synced from Stripe webhooks
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'free',                       -- 'free' | 'pro'
  status text not null default 'none',                     -- active|trialing|past_due|canceled|incomplete|none
  stripe_customer_id text,                                 -- cus_...
  stripe_subscription_id text,                             -- sub_...
  current_period_end bigint,                               -- unix seconds
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for webhook lookups by Stripe customer ID
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

-- Index for webhook lookups by Stripe subscription ID
create index if not exists subscriptions_stripe_subscription_id_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ----------------------------------------------------------------------------
-- RLS — users can read only their own subscription row.
-- Writes are done via the service-role client (webhooks), which bypasses RLS.
-- ----------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- No insert/update/delete policies for client access — all mutations
-- go through the service client in webhook handlers and API routes.

-- ----------------------------------------------------------------------------
-- Auto-create a free subscription row when a user signs up.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_subscription()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'none')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function public.handle_new_subscription();