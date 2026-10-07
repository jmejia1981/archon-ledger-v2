-- Data migration, applied 2026-10-07. Recorded here for the audit trail.
--
-- Seven weeks from 2026-08-22 to 2026-10-03 carried 1,280 approved timesheet hours
-- with no payroll row at all. The P&L takes labour from payroll, so $30,840 of work
-- sat outside net profit: entering a month of timesheets moved neither profit nor
-- the tax estimate, which is what prompted this.
--
-- Owner confirmed the hours were paid and simply never recorded. Payroll is
-- therefore backfilled from the timesheets, one row per employee-week, priced at
-- each employee's stored rate with overtime at 1.5x.
--
-- taxes stays 0: the crew is engaged on 1099s, so no employer FICA is owed.
--
-- Only employee-weeks with no existing payroll row are inserted, so weeks already
-- run are untouched. A $464 residue remains between the timesheet valuation
-- ($92,239) and payroll ($91,775) across six earlier weeks; that is an hourly rate
-- having been edited after those weeks were paid, which restates the timesheet
-- figure but not the pay. Payroll is right and is left alone.
--
-- Effect: labour $60,935 -> $91,775. Net profit $116,247 -> $85,407. The 30%
-- placeholder tax estimate $34,874 -> $25,622.
--
-- Pre-change snapshot: payroll_backup_20261007 (69 rows, $60,935.00). To revert:
--   begin;
--   delete from payroll;
--   insert into payroll select * from payroll_backup_20261007;
--   commit;

begin;

insert into payroll (payroll_period_start, payroll_period_end, employee_id,
                     regular_hours, overtime_hours, gross_pay,
                     taxes, benefits, reimbursements, total_employer_cost, status)
select wk, wk + 6, employee_id, reg, ot, gross, 0, 0, 0, gross, 'paid'
from (
  select l.employee_id,
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
) ts
where not exists (
  select 1 from payroll p
   where p.employee_id = ts.employee_id
     and p.payroll_period_start = ts.wk
);

commit;

-- Result: 101 payroll rows, $91,775.00 gross, 3,693.50 hours. No employee-week
-- carrying timesheet hours is left without a payroll row.
