-- Data migration, applied 2026-08-21. Recorded here for the audit trail.
--
-- Invoices recorded $157,250.00 collected against $148,950.00 ever billed — more
-- money received than invoiced, which cannot be true. Two causes:
--
-- 1. Both payment-recording paths set amount_paid = existing + amount. Recording a
--    payment against an invoice already marked paid therefore doubled it. INV-003
--    ($5,000 invoice, $10,000 recorded) and INV-005 ($3,300 / $6,600) were both hit
--    on 2026-08-21. The invoice detail page had no outstanding-balance guard at all.
--
-- 2. INV-015 carried two identical payment rows created 0.46 seconds apart — a
--    double form submit, flagged in the August audit and still present.
--
-- The payments ledger is treated as the source of truth: it holds one correct row
-- per real payment in both cases. Deletes the duplicate, then rebuilds amount_paid
-- from the ledger for any invoice claiming more than it billed.
--
-- Not touched: five invoices marked paid that have no payment row at all
-- (INV-004, 006, 007, 009, 010 — $24,900, all MRS INC, May–June). Whether and when
-- those were paid is not derivable from the data.
--
-- Snapshots: invoices_backup_20260821, payments_backup_20260821.

begin;

delete from payments p
where p.id in (
  select id from (
    select id, row_number() over (
      partition by invoice_id, amount, payment_date order by created_at
    ) rn
    from payments
  ) x where x.rn > 1
);

update invoices i
   set amount_paid = l.paid
  from (select invoice_id, sum(amount) paid from payments group by 1) l
 where l.invoice_id = i.id
   and i.amount_paid > i.invoice_amount;

commit;

-- Result: 23 payments totalling $124,050.00; no invoice claims more than it billed.

-- ── Backfill, same date ─────────────────────────────────────────────────────
-- The five invoices left alone above (INV-004, 006, 007, 009, 010 — $24,900) were
-- marked paid directly on the invoice, so Payment Tracking had nothing to show.
-- Owner confirmed they were paid by check and approved using each invoice's own
-- date as the payment date. That is an approximation: payment normally follows
-- invoicing, so these run slightly early. The notes field records that on every
-- row so it is not mistaken for an observed date.

begin;

insert into payments (invoice_id, amount, payment_date, payment_method, status, notes)
select i.id, i.amount_paid, i.invoice_date, 'check', 'completed',
       'Backfilled 2026-08-21: invoice was marked paid without a payment record. Date assumed to be the invoice date.'
from invoices i
where not exists (select 1 from payments p where p.invoice_id = i.id)
  and coalesce(i.amount_paid, 0) > 0;

commit;

-- Result: 28 payments totalling $148,950.00, matching invoice amount_paid exactly.
-- Invoiced $148,950.00, collected $148,950.00, outstanding $0.00, none overpaid,
-- none paid without a record.
