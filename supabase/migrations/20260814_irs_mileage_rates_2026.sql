-- Data migration, applied 2026-08-14. Recorded here for the audit trail.
--
-- All 56 mileage entries carried 0.65, the app's hardcoded default, rather than
-- the IRS standard business rate. The rate changed mid-year, so it depends on the
-- date of the trip:
--
--   Jan 1 – Jun 30, 2026   72.5 cents/mile
--   Jul 1 – Dec 31, 2026   76.0 cents/mile
--
-- reimbursement_rate was numeric(5,2) and silently rounded 0.725 to 0.73, which
-- overstated the first half by $6.20. Widened to numeric(6,3) first.
--
-- Effect: mileage cost rises from $1,206.40 to $1,367.16.
--   H1  1,240.00 miles x 0.725 = $  899.00
--   H2    616.00 miles x 0.760 = $  468.16
--
-- Pre-change snapshot: mileage_entries_backup_20260814 (56 rows, $1,206.40). To
-- revert, restore reimbursement_rate from it:
--   update mileage_entries m set reimbursement_rate = b.reimbursement_rate
--   from mileage_entries_backup_20260814 b where b.id = m.id;
--
-- Going forward the rate is applied in code by irsMileageRate() in
-- lib/calculations.ts, keyed on the entry's own date. Add the next period there
-- when the IRS publishes it.

begin;

alter table mileage_entries alter column reimbursement_rate type numeric(6,3);

update mileage_entries
   set reimbursement_rate = 0.725
 where date >= '2026-01-01' and date < '2026-07-01';

update mileage_entries
   set reimbursement_rate = 0.760
 where date >= '2026-07-01' and date < '2027-01-01';

commit;

-- Result: 34 entries at 0.725 ($899.00), 22 entries at 0.760 ($468.16).
