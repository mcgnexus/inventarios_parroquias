-- Tabla base para inventario
-- Ejecutar en el SQL editor de Supabase (proyecto actual)

-- Extensión para gen_random_uuid (si no existe)
create extension if not exists pgcrypto;

-- Crear tabla items (mínima, ampliable)
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  parish_id uuid not null references public.parishes(id) on delete restrict,
  inventory_number text not null,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índice único: número de inventario único por parroquia
create unique index if not exists items_unique_inventory_per_parish
  on public.items (parish_id, inventory_number);

-- Trigger para updated_at (opcional)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_items_updated_at on public.items;
create trigger trg_items_updated_at
before update on public.items
for each row execute procedure public.set_updated_at();