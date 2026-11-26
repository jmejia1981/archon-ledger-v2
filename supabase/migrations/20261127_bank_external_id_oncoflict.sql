-- Make external_id upsertable.
--
-- bank_accounts and bank_transactions each had a PARTIAL unique index:
--
--   create unique index ... on bank_accounts (external_id) where external_id is not null;
--
-- Postgres will not infer a partial index from a bare `ON CONFLICT (external_id)`.
-- Inference only matches a partial index when the statement repeats the index
-- predicate, and PostgREST's `on_conflict=external_id` emits no WHERE clause. So
-- every upsert from the Plaid routes failed with:
--
--   there is no unique or exclusion constraint matching the ON CONFLICT specification
--
-- which surfaced as a 502 from /api/plaid/exchange the first time a bank was linked.
--
-- The predicate was never needed. A plain unique index treats NULLs as distinct
-- (the default, NULLS DISTINCT), so any number of hand-entered rows with a null
-- external_id are still allowed — exactly what the partial index was protecting.
-- Dropping the predicate changes no data and makes the index inferrable.

drop index if exists bank_accounts_external_id_key;
create unique index if not exists bank_accounts_external_id_key
  on bank_accounts (external_id);

drop index if exists bank_transactions_external_id_key;
create unique index if not exists bank_transactions_external_id_key
  on bank_transactions (external_id);
