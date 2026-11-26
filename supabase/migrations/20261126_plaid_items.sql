-- Plaid connections.
--
-- A Plaid access_token is a long-lived credential that can read the business's
-- bank accounts. It is the most sensitive value in this database and is treated
-- differently from everything else in it:
--
--   RLS is ON and there are deliberately NO POLICIES. With RLS enabled and no
--   policy granting access, Postgres denies every row to `anon` and
--   `authenticated` — which are the only roles the browser ever holds. The table
--   is reachable only by the service role, which lives in a server-side env var
--   and is never sent to a client. A missing policy here is the control, not an
--   oversight; adding one would hand bank access to anything holding the anon key.
--
-- The tokens therefore never reach the browser. The app's own pages read balances
-- from bank_accounts, which carries no credential at all.

create table if not exists plaid_items (
  id uuid primary key default gen_random_uuid(),
  -- Plaid's identifier for the connection (one per institution login).
  item_id text not null unique,
  access_token text not null,
  institution_id text,
  institution_name text,
  -- Cursor for /transactions/sync, so each pull resumes rather than refetching.
  transactions_cursor text,
  status text not null default 'active'
    check (status in ('active', 'login_required', 'error', 'revoked')),
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table plaid_items enable row level security;
-- No policies. See the note above: this is intentional.

-- Links a cash account back to the connection that feeds it, so a revoked item
-- can be traced to the balances it was updating. Null for hand-entered accounts.
alter table bank_accounts
  add column if not exists plaid_item_id uuid references plaid_items(id) on delete set null;

comment on table plaid_items is
  'Plaid connections. Holds access tokens: service-role only, RLS on with no policies by design. Never expose to a browser client.';
comment on column plaid_items.access_token is
  'Long-lived Plaid credential. Server-side use only.';
