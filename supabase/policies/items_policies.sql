-- Políticas RLS para public.items
-- Ejecutar en el SQL editor de Supabase

alter table if exists public.items enable row level security;

-- Lectura pública de elementos publicados y aprobados
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'public read published/approved items'
  ) then
    create policy "public read published/approved items"
    on public.items for select
    using (status in ('published','approved'));
  end if;
end $$;

-- Lectura de elementos propios para usuarios autenticados
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'users read own items'
  ) then
    create policy "users read own items"
    on public.items for select
    to authenticated
    using (auth.uid() = user_id);
  end if;
end $$;

-- Inserción de elementos propios
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'users insert own items'
  ) then
    create policy "users insert own items"
    on public.items for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Actualización de elementos propios
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'items' and policyname = 'users update own items'
  ) then
    create policy "users update own items"
    on public.items for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

-- (Opcional) Restringir actualización cuando el estado sea público
-- Se puede añadir un CHECK adicional vía trigger/procedimiento según reglas de negocio.