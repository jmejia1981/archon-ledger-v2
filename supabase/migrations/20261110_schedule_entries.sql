-- Schedule: plan which crew go to which project each day, approve the week, and
-- have those days become labor hours. Applied 2026-11-10.
--
-- A schedule row is a plan; a labor_entries row is the record of work. Approval
-- creates the labor row and stores its id here, so the link is explicit and a
-- second approval cannot duplicate the hours.
--
-- Payroll reads labor entries by week with no status filter, so approved days reach
-- the payroll page immediately. They become cost only when payroll is actually run
-- for that week — the P&L takes labour from the payroll table, and the dashboard
-- flags hours still waiting.
--
-- Single-tenant conventions, matching 20260805_insurance_policies.sql: RLS on with
-- blanket access for the authenticated role. There is no tenancy column to scope by.

begin;

create table if not exists schedule_entries (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  employee_id uuid not null references employees(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  planned_hours numeric(5,2) not null default 8,
  notes text,
  status text not null default 'scheduled',
  -- Set on approval. Its presence is what marks the day as already converted.
  labor_entry_id uuid references labor_entries(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table schedule_entries drop constraint if exists schedule_entries_status_check;
alter table schedule_entries add constraint schedule_entries_status_check
  check (status in ('scheduled', 'approved'));

-- A person can split a day between sites, but cannot be booked onto the same site
-- twice in one day.
--
-- NULLS NOT DISTINCT rather than coalesce over project_id. Both make unassigned
-- days collide, but an expression index cannot satisfy ON CONFLICT (date,
-- employee_id, project_id): that clause needs an index on exactly those columns, so
-- the page's upsert failed with "no unique or exclusion constraint matching the ON
-- CONFLICT specification". Requires Postgres 15 or later; this database is 17.
create unique index if not exists schedule_entries_unique_assignment
  on schedule_entries (date, employee_id, project_id) nulls not distinct;

create index if not exists idx_schedule_entries_date on schedule_entries(date);
create index if not exists idx_schedule_entries_status on schedule_entries(status);

alter table schedule_entries enable row level security;

drop policy if exists schedule_entries_authenticated_all on schedule_entries;
create policy schedule_entries_authenticated_all on schedule_entries
  for all to authenticated using (true) with check (true);

commit;

-- Verified end to end against live data: 3 crew x 5 days scheduled as 15 rows and
-- 120 hours; re-running the same assignment added nothing; approval produced 15
-- linked labor entries with none unlinked; payroll then reported 40 hours each for
-- the three at their own rates.
--
-- The index was then re-tested with the qualified ON CONFLICT the page actually
-- issues, which the first version could not match: a repeated assignment adds
-- nothing, two overhead days with a null project collapse to one, and a day split
-- between two sites still yields two rows. Test rows were removed afterwards.
