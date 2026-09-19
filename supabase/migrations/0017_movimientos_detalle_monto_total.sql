-- =====================================================================
-- MIGRACIÓN 0017 — movimientos_detalle: separar el gasto del movimiento
--
-- PROBLEMA: la vista tomaba UNA sola línea negativa y UNA sola positiva
-- de cada transacción:
--
--     where e.amount > 0 order by e.amount desc limit 1
--
-- Con dos líneas eso basta. Pero un gasto compartido tiene tres.
-- Cena de $120.000 pagada por mí, al 50%:
--
--     Nu                 -120.000
--     Alimentación        +60.000
--     Balance con Marina  +60.000
--
-- La vista devolvía monto = 60.000: el historial mostraba la MITAD del
-- gasto. Y como las dos líneas positivas empatan, `order by amount desc
-- limit 1` puede devolver cualquiera de las dos, así que la columna
-- cuenta_destino podía decir "Alimentación" o "Balance con Marina" sin
-- ningún criterio estable.
--
-- POR QUÉ NO BASTA CON SUMAR TODAS LAS POSITIVAS: hay dos preguntas
-- distintas y hoy comparten una sola columna.
--
--   El historial pregunta: ¿cuánto dinero se movió?        120.000
--   El dashboard pregunta: ¿cuánto gasté yo de verdad?      60.000
--
-- Los otros 60.000 no son un gasto: son un activo por cobrar. Si se
-- sumaran todas las positivas en una única columna, el historial
-- quedaría bien y el dashboard empezaría a inflar los gastos del mes.
--
-- SOLUCIÓN: dos columnas.
--   monto        líneas que entran a cuentas expense/income.
--                Lo que realmente gastaste o ingresaste. Lo usa Inicio.
--   monto_total  todas las líneas positivas. El movimiento completo.
--                Lo usa el historial de Movimientos.
--
-- En un movimiento normal las dos valen lo mismo, así que nada cambia
-- salvo en los gastos compartidos.
--
-- Además, cuenta_destino deja de depender del empate: se prefiere la
-- línea que va a una categoría de gasto o ingreso sobre la que va a la
-- cuenta de balance con la pareja. El historial dirá "Alimentación",
-- que es la información útil.
--
-- CREATE OR REPLACE VIEW no permite cambiar la estructura, solo añadir
-- columnas al final. Hay que borrarla primero. No se pierde ningún
-- dato: una vista es solo una consulta guardada.
-- =====================================================================

drop view if exists movimientos_detalle;

create view movimientos_detalle
with (security_invoker = on) as
select
  t.id,
  t.owner_id,
  t.couple_id,
  t.type,
  t.description,
  t.notes,
  t.occurred_at,
  t.occurred_on,
  t.visibility,
  t.created_at,
  -- De dónde salió el dinero: la línea negativa mayor.
  origen.account_id   as cuenta_origen_id,
  ao.name             as cuenta_origen,
  ao.class            as clase_origen,
  -- A dónde entró. El desempate prefiere la categoría sobre la cuenta
  -- de balance con la pareja: en un gasto compartido ambas valen lo
  -- mismo, y "Alimentación" dice más que "Balance con Marina".
  destino.account_id  as cuenta_destino_id,
  ad.name             as cuenta_destino,
  ad.class            as clase_destino,
  -- Lo que de verdad gastaste o ingresaste. Para el dashboard.
  coalesce(real.total, destino.amount)::bigint as monto,
  -- Todo el dinero que se movió. Para el historial.
  coalesce(bruto.total, destino.amount)::bigint as monto_total
from transactions t
join lateral (
  select e.account_id, e.amount
  from transaction_entries e
  where e.transaction_id = t.id and e.amount < 0
  order by e.amount asc limit 1
) origen on true
join lateral (
  select e.account_id, e.amount
  from transaction_entries e
  join accounts a on a.id = e.account_id
  where e.transaction_id = t.id and e.amount > 0
  order by
    -- 0 para categorías, 1 para el resto: las categorías ganan el empate.
    case when a.class in ('expense', 'income') then 0 else 1 end,
    e.amount desc
  limit 1
) destino on true
left join lateral (
  select sum(e.amount) as total
  from transaction_entries e
  join accounts a on a.id = e.account_id
  where e.transaction_id = t.id
    and e.amount > 0
    and a.class in ('expense', 'income')
) real on true
left join lateral (
  select sum(e.amount) as total
  from transaction_entries e
  where e.transaction_id = t.id and e.amount > 0
) bruto on true
join accounts ao on ao.id = origen.account_id
join accounts ad on ad.id = destino.account_id;