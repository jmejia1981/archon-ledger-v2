-- Insurance policies: certificate storage and renewal tracking.
-- Follows the org-scoped conventions established in 20260605_production_hardening.sql.

create table if not exists insurance_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade default current_org_id(),
  policy_type text not null,
  carrier text not null,
  policy_number text,
  effective_date date,
  expiration_date date,
  coverage_limit numeric(14,2) not null default 0,
  premium numeric(14,2) not null default 0,
  notes text,
  -- Storage object in the `insurance-policies` bucket. Path, not URL: the bucket
  -- is private, so the app signs a fresh URL on each view/download.
  file_path text,
  file_name text,
  file_size bigint,
  file_type text,
  created_at timestamptz default now()
);

create index if not exists idx_insurance_policies_org on insurance_policies(organization_id);
create index if not exists idx_insurance_policies_expiration on insurance_policies(organization_id, expiration_date);

alter table insurance_policies enable row level security;

drop policy if exists insurance_policies_select_org_members on insurance_policies;
drop policy if exists insurance_policies_insert_writers on insurance_policies;
drop policy if exists insurance_policies_update_writers on insurance_policies;
drop policy if exists insurance_policies_delete_admins on insurance_policies;

create policy insurance_policies_select_org_members on insurance_policies for select
using (organization_id in (select organization_id from organization_memberships where user_id = auth.uid()));

create policy insurance_policies_insert_writers on insurance_policies for insert
with check (organization_id = current_org_id() and can_write_financials());

create policy insurance_policies_update_writers on insurance_policies for update
using (organization_id = current_org_id() and can_write_financials())
with check (organization_id = current_org_id() and can_write_financials());

create policy insurance_policies_delete_admins on insurance_policies for delete
using (organization_id = current_org_id() and can_admin_org());

-- Private bucket. 20 MB ceiling: policy PDFs with endorsements run large.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'insurance-policies',
  'insurance-policies',
  false,
  20971520,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed <organization_id>/insurance/<file>, NOT <auth.uid()> as the
-- receipts bucket does. A certificate of insurance is a company document: whoever
-- uploads it, every member of the org needs to open it. Keying on the uploader
-- would leave teammates able to see the policy row but not its file.
--
-- Compared as text rather than cast to uuid: a malformed first segment would make
-- the cast raise instead of simply failing the check.
drop policy if exists insurance_policies_org_select on storage.objects;
drop policy if exists insurance_policies_org_insert on storage.objects;
drop policy if exists insurance_policies_org_update on storage.objects;
drop policy if exists insurance_policies_org_delete on storage.objects;

create policy insurance_policies_org_select on storage.objects for select
using (
  bucket_id = 'insurance-policies'
  and (storage.foldername(name))[1] in (
    select organization_id::text from organization_memberships where user_id = auth.uid()
  )
);

create policy insurance_policies_org_insert on storage.objects for insert
with check (
  bucket_id = 'insurance-policies'
  and (storage.foldername(name))[1] = current_org_id()::text
  and can_write_financials()
);

create policy insurance_policies_org_update on storage.objects for update
using (
  bucket_id = 'insurance-policies'
  and (storage.foldername(name))[1] = current_org_id()::text
  and can_write_financials()
)
with check (
  bucket_id = 'insurance-policies'
  and (storage.foldername(name))[1] = current_org_id()::text
  and can_write_financials()
);

create policy insurance_policies_org_delete on storage.objects for delete
using (
  bucket_id = 'insurance-policies'
  and (storage.foldername(name))[1] = current_org_id()::text
  and can_write_financials()
);
