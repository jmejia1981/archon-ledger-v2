-- Ladrillero #1's 2026-11-12 bill was filed under Legal & Professional (Line 17).
--
-- A ladrillero is a bricklayer. The work is contract labor, and the vendor's only
-- other bill is already on Line 11, so the one row on Line 17 is a mis-pick in the
-- tax-category dropdown rather than a different kind of spend. Left as it was it
-- would move $1,000 from Schedule C line 11 to line 17 on the return, and leave it
-- out of the contract-labor figure that the 1099-NEC totals are read against.
--
-- Scoped to that vendor, that date and that category, so it cannot touch the
-- vendor's other bill or any genuine Line 17 spend.

update vendor_bills b
set tax_category = 'Contract Labor (Line 11)'
from vendors v
where v.id = b.vendor_id
  and v.name = 'Ladrillero #1'
  and b.issue_date = date '2026-11-12'
  and b.tax_category = 'Legal & Professional (Line 17)';
