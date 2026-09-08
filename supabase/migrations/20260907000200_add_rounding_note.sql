-- Stores the reason/description for manual rounding or adjustment on sales.
alter table public.sales
  add column if not exists rounding_note text;
