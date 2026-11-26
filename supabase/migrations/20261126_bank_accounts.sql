-- Somewhere to hold cash.
--
-- Nothing in the schema recorded a bank balance, so Available Cash, the 13-week
-- forecast and every shortfall metric had no number to start from. A forecast
-- needs an opening balance; without one it can only show movement, never position.
--
-- Deliberately provider-agnostic. The balance may arrive from the Truthifi MCP
-- connector run in the owner's assistant, from a Chase CSV, or be typed in by
-- hand, and `source` records which. No bank credential is ever stored here —
-- whatever fetches the figure does so elsewhere and writes only the result.
--
-- balance_as_of is the whole point of the design: a fed balance is a snapshot, not
-- a live reading, and a stale snapshot shown as today's cash is worse than no cash
-- figure at all. Every read of these tables must surface that date, and the
-- dashboard greys the figure out once it is more than a few days old.

create table if not exists bank_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution text,
  -- Last four digits only. The full account number is deliberately not storable.
  mask text,
  account_type text default 'checking'
    check (account_type in ('checking', 'savings', 'credit', 'loan', 'other')),
  current_balance numeric(14,2) not null default 0,
  -- What is actually spendable: current less holds. Null when the feed does not
  -- report it, and the dashboard then falls back to current rather than showing 0.
  available_balance numeric(14,2),
  currency text not null default 'USD',
  balance_as_of timestamptz,
  -- 'truthifi' | 'csv' | 'manual' | 'plaid' — how this figure arrived.
  source text not null default 'manual',
  -- The provider's own id, so a later automated feed can match instead of
  -- duplicating. Unique where present.
  external_id text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists bank_accounts_external_id_key
  on bank_accounts (external_id) where external_id is not null;

create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references bank_accounts(id) on delete cascade,
  date date not null,
  -- Signed: negative is money out, positive is money in. One sign convention so
  -- inflow and outflow are a filter rather than two columns that can disagree.
  amount numeric(14,2) not null,
  description text,
  category text,
  pending boolean not null default false,
  source text not null default 'manual',
  external_id text,
  -- Set once a line has been matched to a payment, bill or expense already in the
  -- books, so reconciliation can show what is still unaccounted for.
  matched_kind text check (matched_kind in ('payment', 'bill', 'expense', 'payroll', 'transfer', 'ignored')),
  matched_id uuid,
  created_at timestamptz default now()
);

create unique index if not exists bank_transactions_external_id_key
  on bank_transactions (external_id) where external_id is not null;
create index if not exists bank_transactions_account_date_idx
  on bank_transactions (account_id, date desc);

comment on table bank_accounts is
  'Cash positions. Holds balances only, never credentials. balance_as_of says when the figure was true; treat it as a snapshot, not a live reading.';
comment on table bank_transactions is
  'Bank lines, signed: negative out, positive in. matched_kind/matched_id link a line to the record it already corresponds to.';

-- Signed-in users only, matching the schedule_entries policy. These two tables
-- carry the business's cash position, so they get the protection payments and
-- schedule_entries already have rather than the open default some older tables
-- were left with. The anon key cannot read a balance.

alter table bank_accounts enable row level security;
alter table bank_transactions enable row level security;

drop policy if exists bank_accounts_authenticated_all on bank_accounts;
create policy bank_accounts_authenticated_all on bank_accounts
  for all to authenticated using (true) with check (true);

drop policy if exists bank_transactions_authenticated_all on bank_transactions;
create policy bank_transactions_authenticated_all on bank_transactions
  for all to authenticated using (true) with check (true);
