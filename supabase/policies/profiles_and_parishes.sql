-- Activa RLS en tablas
alter table profiles enable row level security;
alter table parishes enable row level security;

-- Perfiles: permitir a cada usuario gestionar su propia fila
create policy "insert_own_profile"
on profiles
for insert
with check (auth.uid() = id);

create policy "update_own_profile"
on profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "select_own_profile"
on profiles
for select
using (auth.uid() = id);

-- Parroquias: lectura (elige una de las dos)
-- Opción A: lectura abierta
create policy "read_all_parishes"
on parishes
for select
using (true);

-- Opción B: lectura solo para usuarios autenticados
-- create policy "read_parishes_authenticated"
-- on parishes
-- for select
-- using (auth.uid() is not null);