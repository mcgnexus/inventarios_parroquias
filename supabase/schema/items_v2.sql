-- Ampliación de esquema para tabla public.items
-- Ejecutar en el SQL editor de Supabase del proyecto

-- Asegurar extensión para uuid si fuera necesaria
create extension if not exists pgcrypto;

-- Añadir columnas necesarias para catálogo canónico
alter table if exists public.items
  add column if not exists user_id uuid references auth.users(id) on delete restrict,
  add column if not exists parish_name text,
  add column if not exists image_url text,
  add column if not exists published_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists data jsonb;

-- Constraint de estado permitido
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_status_check'
  ) then
    alter table public.items
      add constraint items_status_check
      check (status in ('draft','published','approved'));
  end if;
end $$;

-- Constraint: aprobado requiere imagen
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'items_approved_requires_image'
  ) then
    alter table public.items
      add constraint items_approved_requires_image
      check (status != 'approved' or (image_url is not null and length(image_url) > 0));
  end if;
end $$;

-- Índices recomendados
create index if not exists idx_items_status on public.items (status);
create index if not exists idx_items_user on public.items (user_id);
create index if not exists idx_items_parish on public.items (parish_id);
create index if not exists idx_items_published on public.items (published_at);
create index if not exists idx_items_approved on public.items (approved_at);
create index if not exists idx_items_categoria on public.items ((data->>'categoria'));
create index if not exists idx_items_tipo on public.items ((data->>'tipo_objeto'));

-- Nota: El trigger de updated_at ya está definido en items.sql