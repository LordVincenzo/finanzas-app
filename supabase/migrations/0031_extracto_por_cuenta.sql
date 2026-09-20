-- =====================================================================
-- MIGRACIÓN 0031 — extracto_por_cuenta
--
-- QUÉ LE FALTABA AL EXTRACTO. Un extracto de banco no es una lista de
-- movimientos: es un saldo que empieza, lo que entró, lo que salió y un
-- saldo que termina. Nuestro extracto solo tenía la lista — 73 filas
-- seguidas, cuatro hojas de papel, y al final uno no sabe si terminó el
-- mes con más o con menos en cada cuenta.
--
-- POR QUÉ UNA VISTA NUEVA Y NO cuentas_disponible. Esa vista sabe el
-- saldo de HOY. Aquí hace falta el saldo al cierre de un mes cualquiera
-- — agosto visto en septiembre — y eso no lo guarda nadie: igual que
-- patrimonio_mensual (0020), hay que reconstruirlo sumando las líneas
-- ocurridas hasta esa fecha. Es el mismo caso y la misma solución.
--
-- LA REGLA DEL SIGNO NO SE REPITE AQUÍ. No hay ningún `case when es
-- deuda`: se suman las líneas tal como están en el ledger, así que una
-- tarjeta de crédito sale en negativo sola, como manda 0001. Solo entran
-- las clases `asset` y `liability`: las categorías (expense/income) no
-- tienen saldo, tienen total, y ese ya lo da categorias_mensuales.
-- =====================================================================

drop view if exists extracto_por_cuenta;

create view extracto_por_cuenta
with (security_invoker = on) as
with meses as (
  select
    to_char(d, 'YYYY-MM')                  as mes,
    d::date                                as primero,
    (d + interval '1 month - 1 day')::date as ultimo
  from generate_series(
    -- Desde el primer movimiento que exista. Si no hay ninguno, el mes
    -- en curso, para que la vista nunca salga vacía por división de
    -- rango y la pantalla pueda decir "no hubo movimientos" ella misma.
    coalesce(
      (select date_trunc('month', min(occurred_on))::timestamp from transactions),
      date_trunc('month', (now() at time zone 'America/Bogota'))
    ),
    date_trunc('month', (now() at time zone 'America/Bogota')),
    interval '1 month'
  ) as d
)
select
  a.owner_id,
  m.mes,
  a.id                  as cuenta_id,
  a.name                as cuenta,
  a.type                as tipo,
  a.class               as clase,
  a.is_pending_location as es_pendiente_ubicar,

  -- Con lo que se empezó el mes: todo lo ocurrido ANTES del día 1.
  coalesce(sum(e.amount) filter (
    where t.occurred_on < m.primero
  ), 0)::bigint as saldo_inicial,

  -- Lo que entró y lo que salió, dentro del mes. `salio` se devuelve en
  -- positivo —"salieron 692.600"— porque la pantalla ya sabe pintarlo
  -- en rojo; un negativo ahí obligaría a cada sitio a acordarse del
  -- signo, y ese es el error que el proyecto lleva evitando desde 0001.
  coalesce(sum(e.amount) filter (
    where t.occurred_on between m.primero and m.ultimo and e.amount > 0
  ), 0)::bigint as entro,
  coalesce(-sum(e.amount) filter (
    where t.occurred_on between m.primero and m.ultimo and e.amount < 0
  ), 0)::bigint as salio,

  -- Con lo que se terminó. No es saldo_inicial + entro - salio por
  -- casualidad: es la misma suma con otra fecha de corte, así que las
  -- dos cuadran siempre aunque una línea caiga justo en el borde.
  coalesce(sum(e.amount) filter (
    where t.occurred_on <= m.ultimo
  ), 0)::bigint as saldo_final
from accounts a
cross join meses m
left join transaction_entries e on e.account_id = a.id
left join transactions t        on t.id = e.transaction_id
where a.class in ('asset', 'liability')
group by a.owner_id, m.mes, a.id, a.name, a.type, a.class, a.is_pending_location;

grant select on extracto_por_cuenta to authenticated;

-- ---------------------------------------------------------------------
-- Que no pase lo de 0027: aquella vista se dio por aplicada, la app
-- pidió una columna que no existía, PostgREST rechazó la consulta
-- entera y la pantalla enseñó ceros sin avisar. Si algo falló aquí, que
-- falle ahora y en voz alta.
-- ---------------------------------------------------------------------
do $$
declare
  v_faltan text;
begin
  select string_agg(c, ', ')
    into v_faltan
  from unnest(array[
    'owner_id','mes','cuenta_id','cuenta','tipo','clase',
    'es_pendiente_ubicar','saldo_inicial','entro','salio','saldo_final'
  ]) as c
  where not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name  = 'extracto_por_cuenta'
      and column_name = c
  );

  if v_faltan is not null then
    raise exception 'LA VISTA NO QUEDO: faltan las columnas %', v_faltan;
  end if;
end $$;

notify pgrst, 'reload schema';
