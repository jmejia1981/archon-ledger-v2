-- Data migration, applied 2026-08-08. Recorded here for the audit trail.
--
-- The payroll table held $24,874 against $49,607 actually paid: five weeks
-- (Jun 13, Jun 20, Jul 11, Jul 18, Jul 25) had approved timesheets and no payroll
-- run at all, and nine other weeks disagreed with their timesheets in both
-- directions. The owner confirmed $49,607 is the correct amount paid, so
-- timesheets govern and payroll was rebuilt from them.
--
-- A first attempt updated rows in place and produced $51,850. Three
-- employee-weeks had two payroll rows each, because payroll_period_start values
-- had been hand-edited onto different weekdays that normalise to the same
-- Saturday week; updating both rows to the full timesheet value double-counted
-- $2,243. The rebuild below cannot hit that, since it derives exactly one row per
-- (employee, week).
--
-- Weeks run Saturday–Friday, matching getWeekStart() in the labor and payroll
-- pages. taxes stays 0: the crew is engaged as 1099 contractors, so the business
-- owes no employer FICA. Their pay maps to Schedule C Line 11 (Contract Labor),
-- not Line 26 (Wages).
--
-- Pre-change snapshot: payroll_backup_20260808 (31 rows, $24,874). To revert:
--   begin;
--   delete from payroll;
--   insert into payroll select * from payroll_backup_20260808;
--   commit;

begin;

delete from payroll;

insert into payroll (
  payroll_period_start, payroll_period_end, employee_id,
  regular_hours, overtime_hours, gross_pay,
  taxes, benefits, reimbursements, total_employer_cost, status
)
select
  wk,
  wk + 6,
  employee_id,
  reg,
  ot,
  gross,
  0,      -- employer FICA: none owed on 1099 contract labour
  0,
  0,
  gross,
  'paid'
from (
  select
    l.employee_id,
    (l.date - mod(extract(dow from l.date)::int + 1, 7))::date wk,
    sum(coalesce(l.regular_hours, 0)) reg,
    sum(coalesce(l.overtime_hours, 0)) ot,
    round(sum(
      coalesce(l.regular_hours, 0) * e.hourly_rate +
      coalesce(l.overtime_hours, 0) * e.hourly_rate * 1.5
    ), 2) gross
  from labor_entries l
  join employees e on e.id = l.employee_id
  group by 1, 2
) ts;

commit;

-- Result: 58 rows, $49,607.00 gross, 1,957.50 hours, $0 employer tax, 9 contractors.
-- All 14 weeks tie to their timesheets exactly.
