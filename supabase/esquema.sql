-- ============================================================================
--  MOSTRADOR — esquema completo
--  Pegar entero en Supabase → SQL Editor → Run. Se puede correr más de una vez.
-- ============================================================================
--
--  La idea central de seguridad:
--    · La tabla `productos` (que tiene los COSTOS) solo la puede leer el dueño.
--    · Quien solo consulta lee la vista `productos_mostrador`, que directamente
--      no tiene la columna de costo. No es que se la ocultamos: no existe en lo
--      que le mandamos.
--
-- ============================================================================


-- ── 0. EXTENSIONES ──────────────────────────────────────────────────────────
-- unaccent hace que "azucar" encuentre "Azúcar". La usa el buscador.
create extension if not exists unaccent;


-- ── 1. PERFILES ─────────────────────────────────────────────────────────────
-- Supabase guarda las cuentas en auth.users. Acá guardamos lo nuestro: quién es
-- dueño y quién tiene el acceso vigente.

create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  nombre     text        not null,
  dueno      boolean     not null default false,
  activo     boolean     not null default true,
  creado_en  timestamptz not null default now()
);

comment on table public.perfiles is
  'Un renglón por persona con acceso. dueno = puede ver costos y tocar precios.';


-- ── 2. PRODUCTOS ────────────────────────────────────────────────────────────

create table if not exists public.productos (
  id                     bigint generated always as identity primary key,
  nombre                 text          not null,
  marca                  text,
  presentacion           text,
  ean                    text          unique,
  rubro                  text,
  proveedor              text,
  precio_costo           numeric(12,2) not null default 0,
  precio_venta           numeric(12,2) not null default 0,
  precio_actualizado_en  timestamptz   not null default now(),
  activo                 boolean       not null default true,
  creado_en              timestamptz   not null default now(),

  constraint precios_no_negativos check (precio_costo >= 0 and precio_venta >= 0)
);

-- El buscador va por nombre y por código: los dos necesitan índice.
create index if not exists productos_ean_idx    on public.productos (ean);
create index if not exists productos_activo_idx on public.productos (activo);
create index if not exists productos_busqueda_idx
  on public.productos using gin (
    to_tsvector('spanish', coalesce(nombre,'') || ' ' ||
                           coalesce(marca,'')  || ' ' ||
                           coalesce(presentacion,''))
  );


-- ── 3. HISTORIAL DE PRECIOS ─────────────────────────────────────────────────
-- No se escribe a mano: lo llena un disparador cada vez que cambia un precio.
-- Así el historial no depende de que la aplicación se acuerde de guardarlo.

create table if not exists public.precios_historial (
  id             bigint generated always as identity primary key,
  producto_id    bigint      not null references public.productos (id) on delete cascade,
  precio_costo   numeric(12,2),
  precio_venta   numeric(12,2),
  vigente_desde  timestamptz not null default now(),
  cambiado_por   uuid        references auth.users (id) on delete set null
);

create index if not exists historial_producto_idx
  on public.precios_historial (producto_id, vigente_desde desc);

create or replace function public.registrar_cambio_de_precio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.precio_costo is not distinct from old.precio_costo
     and new.precio_venta is not distinct from old.precio_venta then
    return new;                       -- no cambió ningún precio: no anotamos nada
  end if;

  new.precio_actualizado_en := now();

  insert into public.precios_historial (producto_id, precio_costo, precio_venta, cambiado_por)
  values (new.id, new.precio_costo, new.precio_venta, auth.uid());

  return new;
end;
$$;

drop trigger if exists productos_precio_cambio on public.productos;
create trigger productos_precio_cambio
  after insert or update of precio_costo, precio_venta on public.productos
  for each row execute function public.registrar_cambio_de_precio();


-- ── 4. QUIÉN ES QUIÉN ───────────────────────────────────────────────────────
-- Funciones con security definer: leen perfiles sin quedar atrapadas por las
-- propias políticas de perfiles (si no, se muerden la cola).

create or replace function public.es_dueno()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.dueno and p.activo from public.perfiles p where p.id = auth.uid()),
    false)
$$;

create or replace function public.tiene_acceso()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.activo from public.perfiles p where p.id = auth.uid()),
    false)
$$;


-- ── 5. LA VISTA DEL MOSTRADOR ───────────────────────────────────────────────
-- Sin precio_costo, sin proveedor: lo que no está en la vista no viaja al
-- navegador de quien consulta, por más que abra las herramientas del navegador.

drop view if exists public.productos_mostrador;
create view public.productos_mostrador as
  select id, nombre, marca, presentacion, ean, rubro,
         precio_venta, precio_actualizado_en
    from public.productos
   where activo
     and public.tiene_acceso();

-- La vista corre con los permisos de quien la creó, así que no la frena el
-- candado de `productos`. Por eso hay que ser explícitos con quién la puede leer.
revoke all on public.productos_mostrador from anon;
grant  select on public.productos_mostrador to authenticated;


-- ── 6. CANDADOS (row level security) ────────────────────────────────────────

alter table public.perfiles          enable row level security;
alter table public.productos         enable row level security;
alter table public.precios_historial enable row level security;

-- perfiles ------------------------------------------------------------------
drop policy if exists perfiles_ver_lo_mio on public.perfiles;
create policy perfiles_ver_lo_mio on public.perfiles
  for select to authenticated
  using (id = auth.uid() or public.es_dueno());

drop policy if exists perfiles_alta on public.perfiles;
create policy perfiles_alta on public.perfiles
  for insert to authenticated
  with check (public.es_dueno());
  -- Solo el dueño da de alta a alguien. NO hay excepción de "primer arranque":
  -- probamos una y resultó un agujero. La subconsulta que la implementaba corría
  -- bajo las mismas políticas, así que quien todavía no tenía perfil veía la
  -- tabla vacía, la condición le daba verdadera, y podía crearse un perfil con
  -- dueno = true. Cualquiera que se registrara quedaba de dueño.
  -- El primer perfil se crea a mano desde el editor SQL, que no pasa por acá.

drop policy if exists perfiles_editar on public.perfiles;
create policy perfiles_editar on public.perfiles
  for update to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- productos -----------------------------------------------------------------
-- Nadie que no sea dueño toca esta tabla, ni para leerla.
drop policy if exists productos_solo_dueno on public.productos;
create policy productos_solo_dueno on public.productos
  for all to authenticated
  using (public.es_dueno())
  with check (public.es_dueno());

-- historial -----------------------------------------------------------------
drop policy if exists historial_solo_dueno on public.precios_historial;
create policy historial_solo_dueno on public.precios_historial
  for select to authenticated
  using (public.es_dueno());


-- ── 7. BÚSQUEDA ─────────────────────────────────────────────────────────────
-- Una función para buscar sin que importen tildes ni mayúsculas, que devuelve
-- lo mismo que la vista del mostrador (o sea: nunca costos).

create or replace function public.buscar_productos(texto text)
returns setof public.productos_mostrador
language sql
stable
security definer
set search_path = public
as $$
  select id, nombre, marca, presentacion, ean, rubro,
         precio_venta, precio_actualizado_en
    from public.productos
   where activo
     and public.tiene_acceso()
     and (
       ean = texto
       or unaccent(lower(coalesce(nombre,'') || ' ' ||
                         coalesce(marca,'')  || ' ' ||
                         coalesce(presentacion,'') || ' ' ||
                         coalesce(rubro,'')))
           like '%' || unaccent(lower(texto)) || '%'
     )
   order by nombre
   limit 50
$$;

grant execute on function public.buscar_productos(text) to authenticated;


-- El dueño necesita los costos, así que tiene su propia función. Va por acá y
-- no armando el filtro en el navegador: si el texto buscado se interpola en la
-- consulta, una coma o un paréntesis la rompen (o algo peor).
create or replace function public.buscar_productos_dueno(texto text)
returns setof public.productos
language sql
stable
security definer
set search_path = public
as $$
  select *
    from public.productos
   where activo
     and public.es_dueno()
     and (
       ean = texto
       or unaccent(lower(coalesce(nombre,'') || ' ' ||
                         coalesce(marca,'')  || ' ' ||
                         coalesce(presentacion,'') || ' ' ||
                         coalesce(rubro,'') || ' ' ||
                         coalesce(proveedor,'')))
           like '%' || unaccent(lower(texto)) || '%'
     )
   order by nombre
   limit 50
$$;

grant execute on function public.buscar_productos_dueno(text) to authenticated;


-- ── 8. AUMENTO POR PORCENTAJE (para más adelante) ───────────────────────────
-- Queda escrita ahora porque es dos líneas y evita hacerlo producto por
-- producto cuando llegue el momento. Devuelve cuántos cambió.

create or replace function public.aumentar_precios(
  filtro_proveedor text,
  filtro_rubro     text,
  porcentaje       numeric
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  tocados integer;
begin
  if not public.es_dueno() then
    raise exception 'Solo el dueño puede cambiar precios';
  end if;

  update public.productos
     set precio_venta = round(precio_venta * (1 + porcentaje / 100.0), 2)
   where activo
     and (filtro_proveedor is null or proveedor = filtro_proveedor)
     and (filtro_rubro     is null or rubro     = filtro_rubro);

  get diagnostics tocados = row_count;
  return tocados;
end;
$$;

grant execute on function public.aumentar_precios(text, text, numeric) to authenticated;


-- ============================================================================
--  Después de correr esto:
--   1. Authentication → Providers → Email: apagá "Confirm email"
--   2. Authentication → Users → Add user: creá tu cuenta
--   3. Volvé acá y corré, con TU id de usuario:
--
--      insert into public.perfiles (id, nombre, dueno)
--      values ('pegá-acá-tu-uuid', 'Alex', true);
--
--   Ese insert es el único paso manual de todo el sistema.
-- ============================================================================
