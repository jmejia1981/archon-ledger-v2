-- Data migration, applied 2026-11-12. Recorded here for the audit trail.
--
-- Work was recorded against jobsites with no trip logged to them. The distance was
-- recoverable — across 85 trips each project has exactly one mileage, one start and
-- one destination — but the number of days driven is nowhere in the data: a weekly
-- labour block states one date and the week's total hours.
--
-- Days are therefore derived as the highest individual's hours divided by 8, capped
-- at 5, with Sundays excluded. Owner approved that rule. It is an inference, so every
-- created row carries a note saying so; these are deductions and an auditor should be
-- able to tell which trips were observed and which were reconstructed.
--
-- Excluded, with the owner's agreement: three "Overhead" weeks, which name no
-- destination, and two Garden State Plaza projects with no prior trip to take a
-- distance from. Those five periods remain on the mileage page's gap panel.
--
-- Each trip is priced at the IRS rate for its own date — 72.5 cents before 1 July,
-- 76 after — so periods spanning the change are not flattened to one rate.
--
-- Snapshot before the change: mileage_entries_backup_20261112 (85 rows, $1,973.64).

begin;

with gaps as (
  select coalesce(l.week_start_date::date, l.date) ws,
         coalesce(l.week_end_date::date, l.date) we,
         l.project_id,
         max(l.regular_hours + coalesce(l.overtime_hours, 0)) max_emp_hours
  from labor_entries l
  group by 1, 2, 3
), scored as (
  select g.*, p.project_name,
         least(greatest(ceil(g.max_emp_hours / 8.0), 1), 5)::int days,
         (select m2.miles_driven      from mileage_entries m2 where m2.project_id = g.project_id order by m2.date desc limit 1) miles,
         (select m2.employee_id       from mileage_entries m2 where m2.project_id = g.project_id order by m2.date desc limit 1) emp,
         (select m2.starting_location from mileage_entries m2 where m2.project_id = g.project_id order by m2.date desc limit 1) start_loc,
         (select m2.destination       from mileage_entries m2 where m2.project_id = g.project_id order by m2.date desc limit 1) dest
  from gaps g
  left join projects p on p.id = g.project_id
  where not exists (
    select 1 from mileage_entries m
     where m.project_id is not distinct from g.project_id
       and m.date between g.ws and g.we
  )
), expanded as (
  select s.*, (s.ws + (gs.i || ' days')::interval)::date trip_date
  from scored s, generate_series(0, 6) gs(i)
  where s.miles is not null
    and s.project_name not ilike '%overhead%'
    and extract(dow from (s.ws + (gs.i || ' days')::interval)::date) <> 0
    and gs.i < s.days + (case when extract(dow from s.ws) = 6 then 1 else 0 end)
)
insert into mileage_entries (employee_id, project_id, date, starting_location, destination, miles_driven, reimbursement_rate, notes)
select emp, project_id, trip_date, start_loc, dest, miles,
       case when trip_date >= '2026-07-01' then 0.760 else 0.725 end,
       'Derived 2026-11-12 from labor with no trip logged. Days = highest individual hours / 8, capped at 5, Sundays excluded. Distance from this project''s prior trips.'
from expanded;

-- Labour periods overlap: 548 W 22nd St - Roof carried week starts on 24, 29 and 31
-- August, because some labour rows were filed with a non-Saturday week_start_date.
-- Each produced its own trips, so four project-days ended up claimed twice — $85.12
-- of mileage that was never driven. One trip per project-day is kept, preferring a
-- real logged trip over a derived one, so nothing observed is ever the row removed.
delete from mileage_entries m
where m.id in (
  select id from (
    select id, row_number() over (
      partition by date, project_id
      order by (case when notes like 'Derived 2026-11-12%' then 1 else 0 end), created_at, id
    ) rn
    from mileage_entries
  ) x where rn > 1
);

commit;

-- Result: 64 derived trips kept, 149 trips in total, $3,514.77. All 85 original rows
-- intact, no project-day claimed twice, rates split 42 at 0.725 and 107 at 0.760.
