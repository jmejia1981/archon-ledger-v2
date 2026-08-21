-- Data/schema migration, applied 2026-08-21. Recorded here for the audit trail.
--
-- The payments page selected a `status` column that the payments table never had.
-- PostgREST rejects the whole request when one requested column is missing, so
-- every load failed with 42703, the catch block only console.error'd it, and the
-- page rendered an empty list with no indication of failure. Recording payments
-- still worked — the insert never wrote status — which is why 24 rows had
-- accumulated while the page showed none.
--
-- The UI is built around this column: a status filter, the Completed and Pending
-- count cards, and a per-row badge. Adding it is the smaller change, and a payment
-- status is meaningful here — a check can bounce, an ACH can fail.
--
-- Existing rows are money already received, so they backfill to 'completed' via
-- the default. To revert: alter table payments drop column status;

begin;

alter table payments add column if not exists status text not null default 'completed';

alter table payments add constraint payments_status_check
  check (status in ('pending', 'completed', 'failed')) not valid;
alter table payments validate constraint payments_status_check;

commit;

-- Result: 24 existing payments, all 'completed', $125,850.00.
