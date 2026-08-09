-- =====================================================================
-- MIGRACIÓN 0008 — METAS DE AHORRO
--
-- IDEA CENTRAL: una meta NO tiene dinero propio.
-- Tiene ASIGNACIONES sobre dinero que ya existe en tus cuentas.
--
--   Nu tiene $1.000.000
--     └── la meta "Viaje" reclama $500.000
--
--   Patrimonio: $1.000.000  (NO $1.500.000)
--   Saldo de Nu: $1.000.000 (no cambia)
--   Progreso de Viaje: $500.000
--   Disponible sin asignar: $500.000
--
-- Por eso savings_contributions es una tabla APARTE del ledger.
-- No genera transacciones ni lineas. Es imposible que altere el
-- patrimonio, porque el patrimonio solo mira transaction_entries.
--
-- Contenido:
--   1. savings_goals
--   2. savings_contributions
--   3. RLS
--   4. RPCs: crear_meta, aportar_meta, eliminar_aporte, archivar_meta
--   5. Vistas de resumen
-- =====================================================================


-- =====================================================================
-- 1. METAS
-- =====================================================================

create table savings_goals (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  couple_id     uuid references couples(id) on delete restrict,
  name          text not null check (length(trim(name)) between 1 and 80),
  description   text,
  target_amount bigint not null check (target_amount > 0),
  target_date   date,
  currency      char(3) not null default 'COP',
  visibility    visibility not null default 'private',
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint chk_goal_joint check (
    (visibility = 'joint' and couple_id is not null) or
    (visibility <> 'joint' and couple_id is null)
  )
);

create index idx_goals_owner  on savings_goals (owner_id) where not is_archived;
create index idx_goals_couple on savings_goals (couple_id) where couple_id is not null;

create trigger trg_goals_updated_at
  before update on savings_goals
  for each row execute function set_updated_at();


-- =====================================================================
-- 2. APORTES
--
-- account_id indica de que cuenta sale el dinero asignado. Sirve para
-- calcular cuanto queda "libre" en cada cuenta, y para impedir que
-- asignes mas dinero del que realmente tienes.
--
-- El monto puede ser NEGATIVO: asi se retira dinero de una meta sin
-- borrar el historial de aportes.
-- =====================================================================

create table savings_contributions (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references savings_goals(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete restrict,
  account_id  uuid not null references accounts(id) on delete restrict,
  amount      bigint not null check (amount <> 0),
  note        text,
  occurred_on date not null default (now() at time zone 'America/Bogota')::date,
  created_at  timestamptz not null default now()
);

create index idx_contrib_goal    on savings_contributions (goal_id);
create index idx_contrib_profile on savings_contributions (profile_id);
create index idx_contrib_account on savings_contributions (account_id);


-- =====================================================================
-- 3. RLS
-- Mismo patron que accounts y transactions.
-- =====================================================================

alter table savings_goals         enable row level security;
alter table savings_contributions enable row level security;

create policy "metas visibles para mi"
  on savings_goals for select
  using (
    owner_id = (select auth.uid())
    or (visibility = 'shared_view' and public.is_partner_of(owner_id))
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

create policy "crear metas propias"
  on savings_goals for insert
  with check (
    owner_id = (select auth.uid())
    and (visibility <> 'joint' or couple_id = public.current_couple_id())
  );

create policy "editar metas propias o conjuntas"
  on savings_goals for update
  using (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  )
  with check (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

create policy "borrar metas propias"
  on savings_goals for delete
  using (owner_id = (select auth.uid()));


-- Los aportes heredan la visibilidad de su meta.
create policy "aportes de metas visibles"
  on savings_contributions for select
  using (
    exists (select 1 from savings_goals g where g.id = savings_contributions.goal_id)
  );

-- Solo puedo aportar en mi nombre, desde una cuenta mia, a una meta
-- que sea mia o conjunta.
create policy "aportar a mis metas"
  on savings_contributions for insert
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from accounts a
      where a.id = savings_contributions.account_id
        and a.owner_id = (select auth.uid())
    )
    and exists (
      select 1 from savings_goals g
      where g.id = savings_contributions.goal_id
        and (
          g.owner_id = (select auth.uid())
          or (g.visibility = 'joint' and g.couple_id = public.current_couple_id())
        )
    )
  );

create policy "borrar mis aportes"
  on savings_contributions for delete
  using (profile_id = (select auth.uid()));


-- =====================================================================
-- 4. RPCs
-- =====================================================================

create or replace function public.crear_meta(
  p_nombre      text,
  p_objetivo    bigint,
  p_fecha       date default null,
  p_descripcion text default null,
  p_visibilidad visibility default 'private'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_couple uuid;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_objetivo is null or p_objetivo <= 0 then
    raise exception 'La meta debe ser mayor que cero';
  end if;

  if length(trim(coalesce(p_nombre, ''))) = 0 then
    raise exception 'Escribe un nombre para la meta';
  end if;

  if p_visibilidad = 'joint' then
    v_couple := public.current_couple_id();
    if v_couple is null then
      raise exception 'No tienes una pareja vinculada';
    end if;
  end if;

  insert into savings_goals
    (owner_id, couple_id, name, description, target_amount, target_date, visibility)
  values
    (v_uid, v_couple, trim(p_nombre),
     nullif(trim(coalesce(p_descripcion, '')), ''),
     p_objetivo, p_fecha, p_visibilidad)
  returning id into v_id;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- APORTAR
--
-- La validacion importante: no puedes asignar a metas mas dinero del
-- que hay en la cuenta. Si Nu tiene $2.000.000 y ya asignaste
-- $1.800.000 a otras metas, solo puedes asignar $200.000 mas.
--
-- Esto NO crea ninguna transaccion. El saldo de Nu no cambia y el
-- patrimonio tampoco.
-- ---------------------------------------------------------------------
create or replace function public.aportar_meta(
  p_meta   uuid,
  p_cuenta uuid,
  p_monto  bigint,
  p_nota   text default null,
  p_fecha  date default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_class     account_class;
  v_owner     uuid;
  v_saldo     bigint;
  v_asignado  bigint;
  v_libre     bigint;
  v_en_meta   bigint;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_monto is null or p_monto = 0 then
    raise exception 'El aporte no puede ser cero';
  end if;

  select a.class, a.owner_id into v_class, v_owner
  from accounts a where a.id = p_cuenta;

  if v_owner is null then
    raise exception 'La cuenta no existe o no tienes acceso';
  end if;

  if v_owner <> v_uid then
    raise exception 'Solo puedes asignar dinero de tus propias cuentas';
  end if;

  if v_class <> 'asset' then
    raise exception 'Solo puedes asignar dinero desde cuentas de dinero';
  end if;

  -- Aporte positivo: comprobamos que haya dinero libre en esa cuenta.
  if p_monto > 0 then
    select coalesce(sum(e.amount), 0) into v_saldo
    from transaction_entries e where e.account_id = p_cuenta;

    select coalesce(sum(c.amount), 0) into v_asignado
    from savings_contributions c where c.account_id = p_cuenta;

    v_libre := v_saldo - v_asignado;

    if p_monto > v_libre then
      raise exception
        'Solo tienes % sin asignar en esa cuenta', v_libre;
    end if;
  end if;

  -- Aporte negativo (retirar): no puede dejar la meta en negativo.
  if p_monto < 0 then
    select coalesce(sum(c.amount), 0) into v_en_meta
    from savings_contributions c where c.goal_id = p_meta;

    if v_en_meta + p_monto < 0 then
      raise exception 'La meta solo tiene % acumulado', v_en_meta;
    end if;
  end if;

  insert into savings_contributions
    (goal_id, profile_id, account_id, amount, note, occurred_on)
  values
    (p_meta, v_uid, p_cuenta, p_monto,
     nullif(trim(coalesce(p_nota, '')), ''),
     coalesce(p_fecha, (now() at time zone 'America/Bogota')::date))
  returning id into v_id;

  return v_id;
end;
$$;


create or replace function public.eliminar_aporte(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from savings_contributions
   where id = p_id and profile_id = (select auth.uid());

  if not found then
    raise exception 'El aporte no existe o no es tuyo';
  end if;
end;
$$;


create or replace function public.archivar_meta(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update savings_goals set is_archived = true where id = p_id;
  if not found then
    raise exception 'La meta no existe o no tienes permiso';
  end if;
end;
$$;


-- =====================================================================
-- 5. VISTAS
-- =====================================================================

-- Progreso de cada meta.
create or replace view metas_resumen
with (security_invoker = on) as
select
  g.id,
  g.owner_id,
  g.couple_id,
  g.name,
  g.description,
  g.target_amount,
  g.target_date,
  g.visibility,
  g.is_archived,
  g.created_at,
  coalesce(sum(c.amount), 0)::bigint as acumulado,
  least(
    100,
    floor(coalesce(sum(c.amount), 0) * 100.0 / nullif(g.target_amount, 0))
  )::int as progreso
from savings_goals g
left join savings_contributions c on c.goal_id = g.id
group by g.id;


-- Cuanto ha puesto cada persona en cada meta. Para metas compartidas.
create or replace view metas_aportes_por_persona
with (security_invoker = on) as
select
  c.goal_id,
  c.profile_id,
  p.display_name,
  sum(c.amount)::bigint as total
from savings_contributions c
join profiles p on p.id = c.profile_id
group by c.goal_id, c.profile_id, p.display_name;


-- Dinero libre por cuenta: saldo real menos lo comprometido en metas.
create or replace view cuentas_disponible
with (security_invoker = on) as
select
  a.id as account_id,
  a.owner_id,
  a.name,
  coalesce(saldo.total, 0)::bigint     as saldo,
  coalesce(asignado.total, 0)::bigint  as asignado,
  (coalesce(saldo.total, 0) - coalesce(asignado.total, 0))::bigint as disponible
from accounts a
left join lateral (
  select sum(e.amount) as total from transaction_entries e
  where e.account_id = a.id
) saldo on true
left join lateral (
  select sum(c.amount) as total from savings_contributions c
  where c.account_id = a.id
) asignado on true
where a.class = 'asset';
