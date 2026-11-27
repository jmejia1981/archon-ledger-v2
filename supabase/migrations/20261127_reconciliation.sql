-- Reconciliation dispositions.
--
-- matched_kind already said what a bank line corresponds to, but it had no way to
-- record the one answer that matters most for tax: money that left the business
-- account and was not a business cost at all. Booking that as an expense
-- overstates the deduction and understates taxable income; leaving it unmarked
-- means it comes back for review every time.
--
--   owner_draw  an owner distribution, not an operating expense
--
-- 'ignored' stays for lines that are genuinely nothing — a reversed charge, a
-- duplicate feed entry — and is not a synonym for owner_draw.

alter table bank_transactions drop constraint if exists bank_transactions_matched_kind_check;
alter table bank_transactions add constraint bank_transactions_matched_kind_check
  check (matched_kind in ('payment','bill','expense','payroll','transfer','owner_draw','ignored'));

-- Who decided, and when. Reconciliation is a judgement, and a judgement with no
-- date behind it cannot be reviewed later.
alter table bank_transactions
  add column if not exists matched_at timestamptz,
  add column if not exists matched_note text;

-- The review queue reads "everything still undecided", so that is what gets the index.
create index if not exists bank_transactions_unmatched_idx
  on bank_transactions (date desc) where matched_kind is null;

comment on column bank_transactions.matched_kind is
  'What this bank line corresponds to. null means still to be reviewed. owner_draw is a distribution, not an expense.';
