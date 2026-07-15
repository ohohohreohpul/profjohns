-- ============================================================================
-- ProfJohns — Billing and Entitlement Schema (BILL-002)
--
-- Tables: products, prices, customers, purchases, entitlements, usage_events,
--         webhook_events
--
-- Design principles:
--   - Never authorize from client-visible metadata
--   - Entitlements stored in database records, not JWT app_metadata
--   - Webhooks are signature-validated and idempotent
--   - Refund, dispute, and revocation states are tracked
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Products — what we sell (e.g., "ProfJohns Lifetime License")
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  stripe_product_id text unique not null,
  name text not null,
  description text default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Prices — pricing tiers for products
-- ----------------------------------------------------------------------------
create table if not exists public.prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  stripe_price_id text unique not null,
  amount bigint not null,           -- in cents
  currency text not null default 'usd',
  interval text,                    -- 'one_time' | 'month' | 'year' | null
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists prices_product_idx on public.prices (product_id);

-- ----------------------------------------------------------------------------
-- Customers — maps Supabase auth users to Stripe customers
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  stripe_customer_id text unique not null,
  email text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_user_idx on public.customers (user_id);
create index if not exists customers_stripe_idx on public.customers (stripe_customer_id);

-- ----------------------------------------------------------------------------
-- Purchases — records of completed transactions
-- ----------------------------------------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  price_id uuid references public.prices (id) on delete set null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  amount_paid bigint not null default 0,  -- in cents
  currency text not null default 'usd',
  status text not null default 'pending', -- 'pending' | 'paid' | 'refunded' | 'disputed' | 'revoked'
  refunded_amount bigint default 0,       -- in cents
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchases_user_idx on public.purchases (user_id);
create index if not exists purchases_status_idx on public.purchases (status);

-- ----------------------------------------------------------------------------
-- Entitlements — what features a user has access to
--   This is the single source of truth for feature access.
--   Never read from JWT metadata; always query this table server-side.
-- ----------------------------------------------------------------------------
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purchase_id uuid references public.purchases (id) on delete cascade,
  feature text not null,              -- 'ai.write' | 'ai.audit' | 'cloud.sync' | etc.
  status text not null default 'active', -- 'active' | 'expired' | 'revoked'
  granted_at timestamptz not null default now(),
  expires_at timestamptz,             -- null = no expiry
  revoked_at timestamptz,
  revoked_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature)
);

create index if not exists entitlements_user_idx on public.entitlements (user_id);
create index if not exists entitlements_status_idx on public.entitlements (status);
create index if not exists entitlements_feature_idx on public.entitlements (user_id, feature);

-- ----------------------------------------------------------------------------
-- Usage events — records of vendor API usage for spend monitoring + fair-use
-- ----------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vendor text not null,              -- 'openrouter' | 'replicate' | 'unpdf' | 'internal'
  model text,
  request_type text not null,        -- 'ai:write' | 'clip' | 'pdf-extract' | etc.
  estimated_cost_usd numeric(10,6),
  actual_token_usage integer,
  status text not null,              -- 'success' | 'error' | 'rate_limited' | 'rejected' | 'timeout'
  error_message text,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_idx on public.usage_events (user_id);
create index if not exists usage_events_created_idx on public.usage_events (created_at desc);
create index if not exists usage_events_vendor_idx on public.usage_events (vendor, created_at desc);

-- ----------------------------------------------------------------------------
-- Webhook events — idempotency tracking for Stripe webhooks
-- ----------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text unique not null,
  event_type text not null,          -- 'checkout.session.completed' | 'charge.refunded' | etc.
  processed boolean not null default false,
  processed_at timestamptz,
  payload jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists webhook_events_stripe_idx on public.webhook_events (stripe_event_id);

-- ----------------------------------------------------------------------------
-- RLS for billing tables
-- ----------------------------------------------------------------------------

-- Customers: users can see their own customer record only
alter table public.customers enable row level security;
drop policy if exists "customers_select_own" on public.customers;
create policy "customers_select_own" on public.customers
  for select to authenticated
  using (auth.uid() = user_id);

-- Purchases: users can see their own purchases
alter table public.purchases enable row level security;
drop policy if exists "purchases_select_own" on public.purchases;
create policy "purchases_select_own" on public.purchases
  for select to authenticated
  using (auth.uid() = user_id);

-- Entitlements: users can see their own entitlements (read-only)
alter table public.entitlements enable row level security;
drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select to authenticated
  using (auth.uid() = user_id);

-- Usage events: users can see their own usage (read-only)
alter table public.usage_events enable row level security;
drop policy if exists "usage_events_select_own" on public.usage_events;
create policy "usage_events_select_own" on public.usage_events
  for select to authenticated
  using (auth.uid() = user_id);

-- Products and prices: public read (catalog)
alter table public.products enable row level security;
drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select to authenticated
  using (active = true);

alter table public.prices enable row level security;
drop policy if exists "prices_select_all" on public.prices;
create policy "prices_select_all" on public.prices
  for select to authenticated
  using (active = true);

-- Webhook events: no user access (service-role only)
alter table public.webhook_events enable row level security;
-- No policies — only accessible via service role

-- Revoke public privileges on billing tables
revoke all on public.products from anon;
revoke all on public.prices from anon;
revoke all on public.customers from anon;
revoke all on public.purchases from anon;
revoke all on public.entitlements from anon;
revoke all on public.usage_events from anon;
revoke all on public.webhook_events from anon;

grant select on public.products, public.prices to authenticated;
grant select on public.customers, public.purchases, public.entitlements, public.usage_events to authenticated;
