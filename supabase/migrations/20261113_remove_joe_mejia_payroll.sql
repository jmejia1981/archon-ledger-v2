-- Remove Joe Mejia's payroll, which duplicated his vendor bills.
--
-- He was being paid twice in the books: 13 payroll runs totalling $11,350 between
-- 2026-04-25 and 2026-08-01, and a weekly vendor bill series of $27,000 covering
-- 2026-05-15 to 2026-11-13. Both land on Contract Labor (Line 11), so Schedule C
-- carried him at $38,350 for a year in which he was paid once. The vendor bills are
-- the record being kept; the payroll goes.
--
-- Backed up first to payroll_backup_20261113_joe_mejia — all 13 rows, $11,350 —
-- alongside the existing payroll_backup_20260808 and payroll_backup_20261007. The
-- delete is therefore reversible by inserting that table back into payroll.
--
-- His 21 labor entries (454 hours, 2026-04-30 to 2026-08-01) are deliberately kept,
-- at the owner's direction, so the job costing on those projects stays intact.
-- Consequence to expect: payroll is what marks hours as paid, so the dashboard will
-- report 454 unpaid hours — $11,350 at his $25 rate — until those entries are
-- either removed or paid. That figure is this, not a new liability.
--
-- Scoped to the one employee id. Nothing else in payroll is touched.

delete from payroll
where employee_id = '0d03f153-cbbf-4cd5-a675-48d1b0e22051';
