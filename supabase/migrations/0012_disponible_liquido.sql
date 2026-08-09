-- =====================================================================
-- CORRECCIÓN 0012 — separar dinero líquido de cuentas por cobrar
--
-- CREATE OR REPLACE VIEW no deja reordenar ni renombrar columnas,
-- solo añadirlas al final. Como cambia la estructura, hay que borrar
-- la vista primero. No se pierde ningún dato: una vista es solo una
-- consulta guardada.
-- =====================================================================

drop view if exists cuentas_disponible;

create view cuentas_disponible
with (security_invoker = on) as
select
  a.id as account_id,
  a.owner_id,
  a.name,
  a.type,
  coalesce(saldo.total, 0)::bigint    as saldo,
  coalesce(asignado.total, 0)::bigint as asignado,
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
where a.class = 'asset'
  -- Solo dinero que puedes mover hoy. Las cuentas por cobrar
  -- son tuyas, pero no las puedes gastar.
  and a.type in ('checking','savings','cash','digital_wallet','investment','other');


drop view if exists patrimonio_detalle;

create view patrimonio_detalle
with (security_invoker = on) as
select
  a.owner_id,
  coalesce(sum(e.amount) filter (
    where a.type in ('checking','cash','digital_wallet')), 0)::bigint as liquido,
  coalesce(sum(e.amount) filter (where a.type = 'savings'), 0)::bigint as ahorros,
  coalesce(sum(e.amount) filter (where a.type = 'investment'), 0)::bigint as inversiones,
  coalesce(sum(e.amount) filter (
    where a.type in ('receivable','partner_receivable')), 0)::bigint as por_cobrar,
  coalesce(sum(e.amount) filter (where a.class = 'liability'), 0)::bigint as deudas,
  coalesce(sum(e.amount) filter (
    where a.class in ('asset','liability')), 0)::bigint as patrimonio
from accounts a
left join transaction_entries e on e.account_id = a.id
group by a.owner_id;