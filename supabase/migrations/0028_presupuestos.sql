-- =====================================================================
-- MIGRACIÓN 0028 — PRESUPUESTOS POR CATEGORÍA
--
-- QUÉ FALTABA. La app ya dice cuánto gastaste y si es más o menos que
-- el mes pasado. Lo que no dice es cuánto PENSABAS gastar. Comparar con
-- agosto responde "¿voy como siempre?"; un presupuesto responde "¿voy
-- como quería?", que no es lo mismo — llevar tres meses gastando de más
-- de forma estable sale igual de verde en la comparación.
--
-- UN TOPE POR CATEGORÍA, Y SE REPITE SOLO. No hay una fila por mes: la
-- fila dice "Alimentación: 600.000 al mes" y vale para todos los meses
-- desde que se puso. Eso importa más de lo que parece: un presupuesto
-- que hay que volver a escribir cada mes es un presupuesto que se
-- abandona en febrero, y el abandono es el modo de fallo número uno de
-- esta funcionalidad en todas las apps que la tienen.
--
-- Cambiar el tope cambia el de todos los meses, incluidos los pasados.
-- Es una simplificación consciente: guardar el histórico de topes
-- permitiría decir "en marzo tu tope era otro", que es una pregunta que
-- nadie hace, a cambio de una tabla con fechas de vigencia y de que
-- todas las consultas tengan que resolver cuál aplicaba. Si algún día
-- hace falta, se añade `desde` y las filas viejas se quedan con la
-- fecha de creación.
--
-- SOLO GASTOS. Un tope sobre un ingreso no significa nada.
--
-- NO SE VALIDA CONTRA LOS INGRESOS a propósito. Se puede presupuestar
-- más de lo que entra, y decirlo es útil —la pantalla lo avisa— pero
-- impedirlo no: el mes que uno se muda o cambia de trabajo, la app no
-- puede saber mejor que tú lo que va a pasar.
--
-- Contenido:
--   1. Tabla y RLS
--   2. poner_presupuesto() / quitar_presupuesto()
--   3. Vista presupuestos_del_mes
-- =====================================================================


-- =====================================================================
-- 1. LA TABLA
-- =====================================================================

create table if not exists budgets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  -- La categoría es una cuenta de clase expense, como en todo el resto
  -- del modelo. Si se borra la categoría, su tope se va con ella.
  categoria_id uuid not null references accounts(id) on delete cascade,
  monto        bigint not null check (monto > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Un tope por categoría y persona: dos topes para lo mismo no
  -- significan nada.
  unique (owner_id, categoria_id)
);

create index if not exists idx_budgets_owner on budgets (owner_id);

alter table budgets enable row level security;

drop policy if exists "presupuestos propios" on budgets;

create policy "presupuestos propios" on budgets
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));


-- =====================================================================
-- 2. PONER Y QUITAR
--
-- Por RPC como todo lo demás: la pantalla no escribe en tablas.
--
-- poner_presupuesto comprueba que la categoría sea TUYA y de clase
-- expense. Sin eso se podría poner un tope a una cuenta de banco, que
-- no significa nada, o a una categoría ajena, que además filtraría su
-- existencia.
-- =====================================================================

create or replace function public.poner_presupuesto(
  p_categoria uuid,
  p_monto     bigint
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_clase account_class;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El tope tiene que ser mayor que cero';
  end if;

  select a.class into v_clase
  from accounts a
  where a.id = p_categoria and a.owner_id = v_uid;

  if not found then
    raise exception 'Esa categoria no existe o no es tuya';
  end if;

  if v_clase <> 'expense' then
    raise exception 'Solo se le puede poner tope a una categoria de gasto';
  end if;

  insert into budgets (owner_id, categoria_id, monto)
  values (v_uid, p_categoria, p_monto)
  on conflict (owner_id, categoria_id) do update
    set monto = excluded.monto,
        updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.quitar_presupuesto(p_categoria uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from budgets
  where owner_id = (select auth.uid())
    and categoria_id = p_categoria;

  if not found then
    raise exception 'Esa categoria no tiene tope';
  end if;
end;
$$;

revoke all on function public.poner_presupuesto(uuid, bigint) from public;
grant execute on function public.poner_presupuesto(uuid, bigint) to authenticated;

revoke all on function public.quitar_presupuesto(uuid) from public;
grant execute on function public.quitar_presupuesto(uuid) to authenticated;


-- =====================================================================
-- 3. CÓMO VA EL MES
--
-- Una fila por tope, con lo gastado en ESE mes. LEFT JOIN y no INNER:
-- una categoría con tope y sin gastos todavía tiene que salir con cero,
-- que es justo el caso bueno y el que desaparecería con un INNER.
--
-- `mes` sale de generate_series sobre los meses que tienen gasto, más
-- el mes actual — así la vista responde para cualquier mes que la
-- pantalla pida sin tener que recibir parámetros.
--
-- Se reusa categorias_mensuales (0020) en vez de volver a agregar
-- movimientos: esa vista ya decide qué líneas cuentan como gasto de una
-- categoría, y esa decisión no puede vivir en dos sitios.
-- =====================================================================

drop view if exists presupuestos_del_mes;

create view presupuestos_del_mes
with (security_invoker = on) as
select
  b.owner_id,
  m.mes,
  b.categoria_id,
  a.name as categoria,
  b.monto as tope,
  coalesce(c.monto, 0)::bigint as gastado,
  (b.monto - coalesce(c.monto, 0))::bigint as restante,
  -- Puede pasar de 100: saber CUÁNTO te pasaste es el dato.
  round(coalesce(c.monto, 0) * 100.0 / b.monto)::int as porcentaje
from budgets b
join accounts a on a.id = b.categoria_id
-- Los meses sobre los que tiene sentido preguntar: aquellos con algún
-- gasto, y el actual aunque todavía no haya nada.
cross join lateral (
  select distinct mes from categorias_mensuales cm where cm.owner_id = b.owner_id
  union
  select to_char(timezone('America/Bogota', now()), 'YYYY-MM')
) m(mes)
left join categorias_mensuales c
  on c.owner_id = b.owner_id
 and c.categoria_id = b.categoria_id
 and c.mes = m.mes;

grant select on presupuestos_del_mes to authenticated;
