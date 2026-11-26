-- Remove two payments that were entered twice but only ever received once.
--
-- The owner confirms no second payment was taken in either case:
--
--   INV-039  $2,500 on 2026-09-18, entered 2026-09-22 and again on 2026-10-07,
--            fourteen days apart — a re-entry.
--   INV-042  $1,800 on 2026-09-25, entered twice on 2026-10-07 within half a
--            second — a double-submit of the same form.
--
-- Between them they overstated collections by $4,300 and pushed both invoices to
-- twice their face value: INV-039 showed $5,000 collected on $2,500, INV-042 showed
-- $3,600 on $1,800.
--
-- The earlier row of each pair is kept and the later one deleted, both backed up
-- first to payments_backup_20261126_dupes.
--
-- amount_paid is then recomputed from the surviving ledger rather than having
-- $4,300 subtracted from it, so the invoice agrees with its payments by
-- construction instead of by arithmetic that happened to be right today. Every
-- other invoice already reconciles against its ledger exactly and is untouched.
--
-- No unique constraint is added: two identical payments on one day can be genuine,
-- two cheques of the same amount for instance. Both write paths already refuse a
-- payment that would exceed the outstanding balance, which is what stops this
-- recurring, and neither duplicate here could be entered today.

delete from payments
where id in (
  '17cff740-8b96-4dfd-9452-70106b5a4199',  -- INV-039, the 2026-10-07 re-entry
  '239e58a0-4456-4b9f-9727-3bce32fa5a0e'   -- INV-042, the half-second double-submit
);

update invoices i
set amount_paid = coalesce(l.ledger, 0),
    updated_at = now()
from (
  select inv.id,
         (select coalesce(sum(p.amount), 0)
            from payments p
           where p.invoice_id = inv.id
             and coalesce(p.status, 'completed') <> 'void') ledger
    from invoices inv
   where inv.invoice_number in ('INV-039', 'INV-042')
) l
where l.id = i.id;
