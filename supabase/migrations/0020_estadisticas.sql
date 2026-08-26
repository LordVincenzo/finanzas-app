-- =====================================================================
-- 0020 — vistas de tendencias mensuales, para /estadisticas
--
-- Las dos primeras son agregados de movimientos_detalle (el "cuánto
-- gastaste/ingresaste de verdad" que ya existe desde 0017): si esa
-- lógica cambia algún día, estas vistas cambian solas con ella, en vez
-- de quedar con una copia vieja de la selección de líneas.
--
-- La tercera es distinta: el patrimonio no tiene historial guardado en
-- ningún lado, solo un total de HOY (patrimonio_detalle). Esta vista lo
-- reconstruye para los últimos 12 meses, sumando en cada fin de mes
-- todas las líneas ocurridas hasta esa fecha — la misma regla de
-- patrimonio_detalle (asset + liability), evaluada en 12 fechas de
-- corte en vez de una sola.
-- =====================================================================

drop view if exists movimientos_mensuales;

create view movimientos_mensuales
with (security_invoker = on) as
select
  owner_id,
  to_char(occurred_on, 'YYYY-MM') as mes,
  type,
  sum(monto)::bigint as monto
from movimientos_detalle
where type in ('expense', 'income')
group by owner_id, to_char(occurred_on, 'YYYY-MM'), type;


drop view if exists categorias_mensuales;

create view categorias_mensuales
with (security_invoker = on) as
select
  owner_id,
  to_char(occurred_on, 'YYYY-MM') as mes,
  cuenta_destino_id as categoria_id,
  cuenta_destino as categoria,
  sum(monto)::bigint as monto
from movimientos_detalle
where type = 'expense' and clase_destino = 'expense'
group by owner_id, to_char(occurred_on, 'YYYY-MM'), cuenta_destino_id, cuenta_destino;


drop view if exists patrimonio_mensual;

create view patrimonio_mensual
with (security_invoker = on) as
select
  a.owner_id,
  to_char(meses.fin, 'YYYY-MM') as mes,
  coalesce(sum(e.amount) filter (
    where a.class in ('asset', 'liability') and t.occurred_on <= meses.fin
  ), 0)::bigint as patrimonio
from accounts a
cross join lateral (
  select (date_trunc('month', d) + interval '1 month - 1 day')::date as fin
  from generate_series(
    date_trunc('month', (now() at time zone 'America/Bogota')) - interval '11 months',
    date_trunc('month', (now() at time zone 'America/Bogota')),
    interval '1 month'
  ) as d
) meses
left join transaction_entries e on e.account_id = a.id
left join transactions t on t.id = e.transaction_id
group by a.owner_id, meses.fin
order by a.owner_id, meses.fin;
