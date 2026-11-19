-- German Castaneda was hired at $25/hr, not $23.
--
-- His only payroll run, the week of 2026-11-07, was approved on 2026-11-12 while
-- his employee record still read $23, and the record was corrected to $25 seven
-- hours later. The run was therefore costed at the wrong rate from the start rather
-- than at a rate that was right at the time: 24 hours at $23 = $552, where it
-- should have been 24 hours at $25 = $600.
--
-- The owner confirms $25 applies from hire, so the run is restated. Tomas Mejia's
-- six Jul-Aug weeks at $20 are deliberately left alone — he genuinely started at
-- $20 and his raise to $22 was not retroactive.
--
-- Backed up first to payroll_backup_20261119_german, so this is reversible.
--
-- taxes stay at zero: the crew are 1099 contractors, so there is no employer-side
-- payroll tax, and total_employer_cost tracks gross.
--
-- The row's status is already 'paid'. This corrects the books; $48 is still owed to
-- him in cash.
--
-- Scoped to the one employee and the one period, and it reprices from hours rather
-- than hardcoding $600, so it cannot silently diverge from the hours on the row.

update payroll
set hourly_rate = 25.00,
    gross_pay = round((coalesce(regular_hours, 0) + coalesce(overtime_hours, 0) * 1.5) * 25.00, 2),
    total_employer_cost = round((coalesce(regular_hours, 0) + coalesce(overtime_hours, 0) * 1.5) * 25.00, 2)
                          + coalesce(taxes, 0) + coalesce(benefits, 0)
where employee_id = '76ef189a-ac3f-4796-bdb4-f08f98bcd699'
  and payroll_period_start = date '2026-11-07'
  and hourly_rate = 23.00;
