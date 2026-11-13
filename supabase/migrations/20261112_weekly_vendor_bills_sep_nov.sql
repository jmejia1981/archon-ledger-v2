-- Weekly bills for JM Design Studio LLC and Mejia Contractor, 2026-09-04 to 2026-11-13.
--
-- Both vendors bill every Friday. The series ran unbroken from 2026-05-15 to
-- 2026-08-28 and then stopped being recorded; these eleven Fridays continue it with
-- no gap. Amounts confirmed by the owner at $1,000 a bill, which matches Mejia
-- Contractor's figure on all sixteen prior bills and JM Design Studio's on its last
-- five. Every bill is fully paid.
--
-- Tax treatment follows the existing rows exactly, so the P&L and the Schedule C
-- mapping keep working without a special case:
--   JM Design Studio LLC -> Legal & Professional (Line 17)
--   Mejia Contractor     -> Contract Labor (Line 11)
--
-- Both vendors are already flagged is_1099_required, and neither has a W-9 on file.
-- Twenty-two thousand dollars more through them makes that worth closing before
-- January; this migration does not change it.
--
-- vendor_id is set rather than left to the vendor text, matching all 34 prior rows.
-- project_id stays null (overhead), as on every prior bill but three.
--
-- Guarded by NOT EXISTS on (vendor, issue_date) so a re-run cannot double-post.

insert into vendor_bills (
  vendor, vendor_id, bill_number, project_id,
  issue_date, due_date, amount, amount_paid,
  tax_category, notes
)
select
  v.name,
  v.id,
  '',
  null,
  d.day,
  d.day,              -- issue and due are the same date on this series
  1000.00,
  1000.00,            -- paid in full
  t.tax_category,
  'Weekly bill recorded 2026-11-12, continuing the Friday series that ran 2026-05-15 to 2026-08-28.'
from (
  values
    ('JM Design Studio LLC', 'Legal & Professional (Line 17)'),
    ('Mejia Contractor',     'Contract Labor (Line 11)')
) as t(vendor_name, tax_category)
join vendors v on v.name = t.vendor_name
cross join (
  values
    (date '2026-09-04'), (date '2026-09-11'), (date '2026-09-18'), (date '2026-09-25'),
    (date '2026-10-02'), (date '2026-10-09'), (date '2026-10-16'), (date '2026-10-23'),
    (date '2026-10-30'), (date '2026-11-06'), (date '2026-11-13')
) as d(day)
where not exists (
  select 1 from vendor_bills b
  where b.vendor = t.vendor_name and b.issue_date = d.day
);
