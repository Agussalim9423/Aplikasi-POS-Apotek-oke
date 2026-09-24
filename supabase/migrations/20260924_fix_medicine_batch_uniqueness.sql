-- Fix medicine batch uniqueness
-- Batch numbers may repeat between different medicines.
-- They must be unique only within the same tenant + medicine.

begin;

alter table public.medicine_batches
  drop constraint if exists batch_tenant_key;

drop index if exists public.batch_tenant_key;

create unique index if not exists medicine_batches_tenant_medicine_batch_key
  on public.medicine_batches (tenant_id, medicine_id, batch_number);

commit;
