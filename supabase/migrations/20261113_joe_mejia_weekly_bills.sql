-- Weekly bills for Joe Mejia mirroring the Mejia Contractor series, 2026-05-15 to
-- 2026-11-13.
--
-- Twenty-seven Friday bills at $1,000, paid in full, Contract Labor (Line 11) —
-- the same dates, amount and Schedule C line as Mejia Contractor, copied from those
-- rows rather than retyped so the two series cannot drift apart.
--
-- The vendor record already exists and had no bills before this.
--
-- NOTE FOR THE RECORD: Joe Mejia is also an active employee (0d03f153…) with 454
-- hours of labor and $11,350 already run through payroll across 13 runs. Payroll
-- here is how 1099 crew are paid, so after this migration the same person is
-- carried at $38,350 for the year across two systems, all of it Contract Labor.
-- That is correct only if the bills and the payroll are genuinely different money.
-- Recorded as instructed; flagged so it is not mistaken for a reconciled figure.
--
-- Guarded by NOT EXISTS on (vendor_id, issue_date) so a re-run cannot double-post.

insert into vendor_bills (
  vendor, vendor_id, bill_number, project_id,
  issue_date, due_date, amount, amount_paid,
  tax_category, notes
)
select
  joe.name,
  joe.id,
  '',
  null,                 -- overhead, as on the source series
  src.issue_date,
  src.issue_date,       -- issue and due are the same date on this series
  src.amount,
  src.amount,           -- paid in full
  src.tax_category,
  'Mirrors the Mejia Contractor weekly bill of the same date. Recorded 2026-11-13.'
from vendor_bills src
join vendors mc  on mc.id = src.vendor_id and mc.name = 'Mejia Contractor'
cross join (select id, name from vendors where name = 'Joe Mejia') joe
where not exists (
  select 1 from vendor_bills b
  where b.vendor_id = joe.id and b.issue_date = src.issue_date
);
