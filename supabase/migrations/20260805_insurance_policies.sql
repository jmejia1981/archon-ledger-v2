-- Insurance policies: certificate storage and renewal tracking.
--
-- NOTE ON SCOPING: 20260605_production_hardening.sql introduces organizations,
-- organization_memberships and current_org_id(), and org-scopes every table. None
-- of that is present in the live database — it was written but never applied. This
-- migration therefore matches what actually exists: a single-tenant schema whose
-- RLS policies grant blanket access to authenticated users (see the "Allow all"
-- and "authenticated full access" policies on fixed_assets, vendors, vendor_bills).
--
-- If the hardening migration is ever applied, this table needs an organization_id
-- column and org-scoped policies to match, and the storage paths below need an
-- organization prefix.

create table if not exists insurance_policies (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null,
  carrier text not null,
  policy_number text,
  effective_date date,
  expiration_date date,
  coverage_limit numeric(14,2) not null default 0,
  premium numeric(14,2) not null default 0,
  notes text,
  -- Storage object key in the `insurance-policies` bucket. A path, not a URL: the
  -- bucket is private, so the app signs a fresh URL for each view and download.
  file_path text,
  file_name text,
  file_size bigint,
  file_type text,
  created_at timestamptz default now()
);

create index if not exists idx_insurance_policies_expiration on insurance_policies(expiration_date);

alter table insurance_policies enable row level security;

drop policy if exists insurance_policies_authenticated_all on insurance_policies;
create policy insurance_policies_authenticated_all on insurance_policies
for all to authenticated using (true) with check (true);

-- Private, unlike the existing `receipts` bucket which is public. Certificates
-- carry policy numbers and coverage detail and should not be readable by anyone
-- holding a bare URL. 20 MB: policy PDFs with endorsements attached run large.
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

-- Access is granted to the authenticated role for the whole bucket. There is no
-- tenancy column to scope against, and a certificate is a company-wide document:
-- whoever uploads it, everyone signed in needs to open it.
drop policy if exists insurance_policies_authenticated_select on storage.objects;
drop policy if exists insurance_policies_authenticated_insert on storage.objects;
drop policy if exists insurance_policies_authenticated_update on storage.objects;
drop policy if exists insurance_policies_authenticated_delete on storage.objects;

create policy insurance_policies_authenticated_select on storage.objects
for select to authenticated using (bucket_id = 'insurance-policies');

create policy insurance_policies_authenticated_insert on storage.objects
for insert to authenticated with check (bucket_id = 'insurance-policies');

create policy insurance_policies_authenticated_update on storage.objects
for update to authenticated using (bucket_id = 'insurance-policies')
with check (bucket_id = 'insurance-policies');

create policy insurance_policies_authenticated_delete on storage.objects
for delete to authenticated using (bucket_id = 'insurance-policies');
