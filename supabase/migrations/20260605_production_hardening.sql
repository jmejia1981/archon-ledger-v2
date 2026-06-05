-- Production hardening migration for Archon Ledger.
-- Review, then run in the Supabase SQL Editor. This migration reconciles the
-- current app schema, adds organization ownership, enables RLS, and makes
-- receipt storage private/user-scoped.

create extension if not exists pgcrypto;

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'manager', 'bookkeeper', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Archon Construction')
on conflict (id) do nothing;

insert into organization_memberships (organization_id, user_id, role)
select '00000000-0000-0000-0000-000000000001'::uuid, u.id, 'owner'
from auth.users u
where not exists (select 1 from organization_memberships m where m.user_id = u.id);

create or replace function current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select organization_id from organization_memberships where user_id = auth.uid() order by created_at limit 1
$$;

create or replace function current_org_role()
returns text language sql stable security definer set search_path = public as $$
  select role from organization_memberships where user_id = auth.uid() and organization_id = current_org_id() limit 1
$$;

create or replace function can_write_financials()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_org_role() in ('owner', 'admin', 'manager', 'bookkeeper'), false)
$$;

create or replace function can_admin_org()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(current_org_role() in ('owner', 'admin'), false)
$$;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  name text not null,
  company_name text,
  primary_contact text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  client_type text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  name text,
  first_name text,
  last_name text,
  department text,
  role text,
  employment_type text,
  hourly_rate numeric(10,2),
  overtime_rate numeric(10,2),
  email text,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  project_name text not null,
  project_number text,
  client_id uuid references clients(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'on-hold')),
  contract_amount numeric(12,2) default 0,
  contract_budget numeric(12,2) default 0,
  approved_change_orders numeric(12,2) default 0,
  revised_contract_value numeric(12,2),
  project_address text,
  project_street text,
  project_city text,
  project_state text,
  project_zip text,
  external_project_manager text,
  description text,
  start_date date,
  estimated_completion_date date,
  actual_completion_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, project_number)
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  date date not null default current_date,
  vendor text,
  project_id uuid references projects(id) on delete set null,
  category_group text,
  category text,
  subcategory text,
  tax_category text,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  payment_status text default 'unpaid',
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  description text,
  notes text,
  receipt_url text,
  receipt_path text,
  is_monthly boolean not null default false,
  monthly_end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists labor_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  employee_id uuid references employees(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  date date not null default current_date,
  regular_hours numeric(8,2) default 0 check (regular_hours >= 0),
  overtime_hours numeric(8,2) default 0 check (overtime_hours >= 0),
  week_start_date date,
  week_end_date date,
  task_description text,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mileage_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  employee_id uuid references employees(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  date date not null default current_date,
  starting_location text,
  destination text,
  miles_driven numeric(8,2) not null default 0 check (miles_driven >= 0),
  reimbursement_rate numeric(5,2) default 0.65,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  invoice_number text not null,
  client_id uuid references clients(id) on delete set null,
  client_name text,
  project_id uuid references projects(id) on delete set null,
  invoice_date date not null default current_date,
  due_date date,
  payment_terms text,
  invoice_amount numeric(12,2) not null default 0 check (invoice_amount >= 0),
  tax numeric(12,2) default 0 check (tax >= 0),
  retainage numeric(12,2) default 0 check (retainage >= 0),
  amount_paid numeric(12,2) default 0 check (amount_paid >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'partial', 'paid', 'overdue')),
  pdf_url text,
  notes text,
  is_recurring boolean not null default false,
  recurring_frequency text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create table if not exists line_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  invoice_id uuid references invoices(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1 check (quantity >= 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  amount numeric(12,2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  invoice_id uuid references invoices(id) on delete cascade,
  invoice_number text,
  client_name text,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text,
  payment_date date not null default current_date,
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  name text not null,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  ein text,
  is_1099_required boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists vendor_bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  bill_number text,
  vendor text not null,
  vendor_id uuid references vendors(id) on delete set null,
  project_id uuid references projects(id) on delete set null,
  issue_date date,
  due_date date not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  category text,
  tax_category text,
  description text,
  notes text,
  is_1099_vendor boolean not null default false,
  vendor_tax_id text,
  status text default 'unpaid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  payroll_period_start date not null,
  payroll_period_end date not null,
  employee_id uuid references employees(id) on delete set null,
  regular_hours numeric(8,2) default 0,
  overtime_hours numeric(8,2) default 0,
  gross_pay numeric(12,2) default 0,
  taxes numeric(12,2) default 0,
  benefits numeric(12,2) default 0,
  reimbursements numeric(12,2) default 0,
  total_employer_cost numeric(12,2) default 0,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  name text not null,
  category text,
  purchase_date date,
  purchase_price numeric(12,2) default 0,
  current_value numeric(12,2) default 0,
  depreciation_method text,
  useful_life_years numeric(6,2),
  serial_number text,
  status text default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists company_settings (
  id integer primary key default 1,
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  name text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  website text,
  license_number text,
  tax_id text,
  invoice_prefix text default 'INV',
  mileage_rate numeric(5,2) default 0.65,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  proposal_number text,
  client_id uuid references clients(id) on delete set null,
  client_name text,
  client_email text,
  project_id uuid references projects(id) on delete set null,
  project_name text,
  project_address text,
  project_city text,
  project_state text,
  project_zip text,
  proposal_date date default current_date,
  valid_until date,
  total_amount numeric(12,2) not null default 0,
  tax numeric(12,2) default 0,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, proposal_number)
);

create table if not exists proposal_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  proposal_id uuid references proposals(id) on delete cascade,
  description text not null,
  quantity numeric(10,2) default 1,
  unit_price numeric(12,2) default 0,
  amount numeric(12,2) default 0,
  created_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  created_at timestamptz not null default now(),
  title text not null,
  message text not null,
  type text default 'info' check (type in ('info', 'warning', 'error', 'success')),
  is_read boolean default false,
  read_at timestamptz,
  related_type text,
  related_id uuid,
  user_id uuid references auth.users(id) on delete cascade
);

-- Add missing columns for older installs and attach existing rows to the default org.
do $$
declare t text;
begin
  foreach t in array array['clients','employees','projects','expenses','labor_entries','mileage_entries','invoices','line_items','payments','vendors','vendor_bills','payroll','fixed_assets','company_settings','proposals','proposal_items','notifications'] loop
    execute format('alter table if exists %I add column if not exists organization_id uuid references organizations(id) on delete cascade default current_org_id()', t);
    execute format('update %I set organization_id = %L where organization_id is null', t, '00000000-0000-0000-0000-000000000001');
    execute format('alter table if exists %I alter column organization_id set not null', t);
  end loop;
end $$;

alter table projects add column if not exists project_number text;
alter table projects add column if not exists contract_budget numeric(12,2) default 0;
alter table projects add column if not exists revised_contract_value numeric(12,2);
alter table projects add column if not exists project_address text;
alter table projects add column if not exists project_street text;
alter table projects add column if not exists project_city text;
alter table projects add column if not exists project_state text;
alter table projects add column if not exists project_zip text;
alter table projects add column if not exists external_project_manager text;
alter table projects add column if not exists description text;
alter table expenses add column if not exists tax_category text;
alter table expenses add column if not exists approval_status text default 'pending';
alter table expenses add column if not exists receipt_path text;
alter table expenses add column if not exists is_monthly boolean default false;
alter table expenses add column if not exists monthly_end_date date;
alter table labor_entries add column if not exists week_start_date date;
alter table labor_entries add column if not exists week_end_date date;
alter table invoices add column if not exists is_recurring boolean default false;
alter table invoices add column if not exists recurring_frequency text;
alter table payments add column if not exists status text default 'completed';
alter table payments add column if not exists invoice_number text;
alter table payments add column if not exists client_name text;
create or replace function record_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_notes text default null
)
returns payments language plpgsql security definer set search_path = public as $$
declare
  v_invoice invoices%rowtype;
  v_payment payments%rowtype;
  v_new_paid numeric;
  v_total_due numeric;
begin
  if not can_write_financials() then raise exception 'Not authorized to record payments'; end if;

  select * into v_invoice from invoices
  where id = p_invoice_id and organization_id = current_org_id()
  for update;

  if not found then raise exception 'Invoice not found'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;

  v_total_due := coalesce(v_invoice.invoice_amount, 0) + coalesce(v_invoice.tax, 0) - coalesce(v_invoice.retainage, 0);
  v_new_paid := coalesce(v_invoice.amount_paid, 0) + p_amount;
  if v_new_paid > v_total_due then raise exception 'Payment exceeds outstanding balance'; end if;

  insert into payments (organization_id, invoice_id, invoice_number, client_name, amount, payment_date, payment_method, notes, status)
  values (v_invoice.organization_id, v_invoice.id, v_invoice.invoice_number, v_invoice.client_name, p_amount, p_payment_date, p_payment_method, p_notes, 'completed')
  returning * into v_payment;

  update invoices
  set amount_paid = v_new_paid,
      status = case when v_new_paid >= v_total_due then 'paid' else 'partial' end,
      updated_at = now()
  where id = v_invoice.id;

  return v_payment;
end;
$$;

create or replace function next_project_number()
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not can_write_financials() then raise exception 'Not authorized'; end if;
  select coalesce(max(nullif(regexp_replace(project_number, '\D', '', 'g'), '')::integer), 99) + 1 into n
  from projects where organization_id = current_org_id();
  return n::text;
end;
$$;

create or replace function next_invoice_number()
returns text language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not can_write_financials() then raise exception 'Not authorized'; end if;
  select coalesce(max(nullif(regexp_replace(invoice_number, '\D', '', 'g'), '')::integer), 2) + 1 into n
  from invoices where organization_id = current_org_id();
  return 'INV-' || lpad(n::text, 3, '0');
end;
$$;

alter table organizations enable row level security;
alter table organization_memberships enable row level security;

drop policy if exists org_members_can_read_orgs on organizations;
create policy org_members_can_read_orgs on organizations for select
using (exists (select 1 from organization_memberships m where m.organization_id = id and m.user_id = auth.uid()));

drop policy if exists members_can_read_own_memberships on organization_memberships;
create policy members_can_read_own_memberships on organization_memberships for select
using (user_id = auth.uid() or can_admin_org());

drop policy if exists admins_manage_memberships on organization_memberships;
create policy admins_manage_memberships on organization_memberships for all
using (can_admin_org()) with check (can_admin_org());

do $$
declare t text;
begin
  foreach t in array array['clients','employees','projects','expenses','labor_entries','mileage_entries','invoices','line_items','payments','vendors','vendor_bills','payroll','fixed_assets','company_settings','proposals','proposal_items'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_select_org_members', t);
    execute format('drop policy if exists %I on %I', t || '_insert_writers', t);
    execute format('drop policy if exists %I on %I', t || '_update_writers', t);
    execute format('drop policy if exists %I on %I', t || '_delete_admins', t);
    execute format('create policy %I on %I for select using (organization_id in (select organization_id from organization_memberships where user_id = auth.uid()))', t || '_select_org_members', t);
    execute format('create policy %I on %I for insert with check (organization_id = current_org_id() and can_write_financials())', t || '_insert_writers', t);
    execute format('create policy %I on %I for update using (organization_id = current_org_id() and can_write_financials()) with check (organization_id = current_org_id() and can_write_financials())', t || '_update_writers', t);
    execute format('create policy %I on %I for delete using (organization_id = current_org_id() and can_admin_org())', t || '_delete_admins', t);
  end loop;
end $$;

alter table notifications enable row level security;
drop policy if exists notifications_select_own on notifications;
drop policy if exists notifications_update_own on notifications;
drop policy if exists notifications_insert_admins on notifications;
create policy notifications_select_own on notifications for select using (user_id = auth.uid() and organization_id = current_org_id());
create policy notifications_update_own on notifications for update using (user_id = auth.uid() and organization_id = current_org_id()) with check (user_id = auth.uid() and organization_id = current_org_id());
create policy notifications_insert_admins on notifications for insert with check (organization_id = current_org_id() and can_admin_org());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_user_select on storage.objects;
drop policy if exists receipts_user_insert on storage.objects;
drop policy if exists receipts_user_update on storage.objects;
drop policy if exists receipts_user_delete on storage.objects;
create policy receipts_user_select on storage.objects for select using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy receipts_user_insert on storage.objects for insert with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy receipts_user_update on storage.objects for update using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]) with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
create policy receipts_user_delete on storage.objects for delete using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create index if not exists idx_memberships_user on organization_memberships(user_id);
create index if not exists idx_clients_org on clients(organization_id);
create index if not exists idx_projects_org_status on projects(organization_id, status);
create index if not exists idx_projects_client on projects(client_id);
create index if not exists idx_expenses_org_date on expenses(organization_id, date desc);
create index if not exists idx_expenses_project on expenses(project_id);
create index if not exists idx_labor_org_project on labor_entries(organization_id, project_id);
create index if not exists idx_mileage_org_project on mileage_entries(organization_id, project_id);
create index if not exists idx_invoices_org_status on invoices(organization_id, status);
create index if not exists idx_invoices_project on invoices(project_id);
create index if not exists idx_invoices_client on invoices(client_id);
create index if not exists idx_line_items_invoice on line_items(invoice_id);
create index if not exists idx_payments_invoice on payments(invoice_id);
create index if not exists idx_vendor_bills_org_due on vendor_bills(organization_id, due_date);
create index if not exists idx_notifications_user on notifications(user_id, is_read, created_at desc);
-- Legacy schema compatibility for installs created from DATABASE_SCHEMA.sql.
alter table projects add column if not exists project_name text;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'name') then execute 'update projects set project_name = coalesce(project_name, name) where project_name is null'; end if; end $$;
alter table projects add column if not exists contract_amount numeric(12,2) default 0;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'projects' and column_name = 'budget') then execute 'update projects set contract_budget = coalesce(contract_budget, budget, contract_amount, 0)'; end if; end $$;

alter table invoices add column if not exists invoice_number text;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'number') then execute 'update invoices set invoice_number = coalesce(invoice_number, number) where invoice_number is null'; end if; end $$;
alter table invoices add column if not exists invoice_amount numeric(12,2) default 0;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'invoices' and column_name = 'amount') then execute 'update invoices set invoice_amount = coalesce(invoice_amount, amount, 0)'; end if; end $$;
alter table invoices add column if not exists amount_paid numeric(12,2) default 0;
alter table invoices add column if not exists tax numeric(12,2) default 0;
alter table invoices add column if not exists retainage numeric(12,2) default 0;
alter table invoices add column if not exists payment_terms text;
alter table invoices add column if not exists client_id uuid references clients(id) on delete set null;
alter table invoices add column if not exists project_id uuid references projects(id) on delete set null;
alter table invoices add column if not exists invoice_date date default current_date;
alter table invoices add column if not exists pdf_url text;
alter table invoices add column if not exists notes text;

alter table labor_entries add column if not exists regular_hours numeric(8,2) default 0;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'labor_entries' and column_name = 'hours') then execute 'update labor_entries set regular_hours = coalesce(regular_hours, hours, 0)'; end if; end $$;
alter table labor_entries add column if not exists overtime_hours numeric(8,2) default 0;
alter table labor_entries add column if not exists employee_id uuid references employees(id) on delete set null;

alter table mileage_entries add column if not exists miles_driven numeric(8,2) default 0;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mileage_entries' and column_name = 'miles') then execute 'update mileage_entries set miles_driven = coalesce(miles_driven, miles, 0)'; end if; end $$;
alter table mileage_entries add column if not exists reimbursement_rate numeric(5,2) default 0.65;
do $$ begin if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'mileage_entries' and column_name = 'rate') then execute 'update mileage_entries set reimbursement_rate = coalesce(reimbursement_rate, rate, 0.65)'; end if; end $$;
alter table mileage_entries add column if not exists employee_id uuid references employees(id) on delete set null;

alter table expenses add column if not exists category_group text;
alter table expenses add column if not exists subcategory text;
alter table expenses add column if not exists payment_status text default 'unpaid';
alter table expenses add column if not exists description text;
alter table expenses add column if not exists receipt_url text;
alter table expenses add column if not exists vendor text;