-- Record the rate each payroll run was costed at.
--
-- gross_pay is a snapshot of what was paid, but the rate behind it lived only in
-- employees.hourly_rate, which is a single mutable field with no history. Raise
-- somebody and every payroll row they already have stops reconciling: German
-- Castaneda's week of 2026-11-07 was run at 18:49 on 11-12 for 24 hours at $23, and
-- his rate was edited to $25 seven hours later, so the history row reads 24h and
-- $552 with nothing on the page explaining where $552 came from.
--
-- Storing the rate on the row makes each one self-explanatory and stops a future
-- raise rewriting the past. Nothing about the money changes.
--
-- Backfilled from the row itself: gross / (regular + overtime * 1.5) is the rate
-- that was actually used, whatever the employee record says today.

alter table payroll add column if not exists hourly_rate numeric(10,2);

update payroll
set hourly_rate = round(gross_pay / nullif(coalesce(regular_hours,0) + coalesce(overtime_hours,0) * 1.5, 0), 2)
where hourly_rate is null
  and coalesce(regular_hours,0) + coalesce(overtime_hours,0) * 1.5 > 0;

comment on column payroll.hourly_rate is
  'Rate this run was costed at, captured when payroll was approved. Never read from employees.hourly_rate after the fact — that field changes with raises and would retroactively alter settled history.';
