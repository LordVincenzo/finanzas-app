-- =====================================================================
-- MIGRACIÓN 0027 — EL PATRIMONIO SIN HUECOS
--
-- PROBLEMA: las partes de patrimonio_detalle no suman el total.
--
--   liquido      checking, cash, digital_wallet
--   ahorros      savings
--   inversiones  investment
--   por_cobrar   receivable, partner_receivable
--   deudas       clase liability
--   patrimonio   clase asset + liability
--
-- El tipo `other` es de clase asset, así que entra en `patrimonio` pero
-- no aparece en ninguna casilla. Y ahí es justo donde vive «Pendiente
-- de ubicar», la cuenta de sistema que crea la 0021 cuando tu pareja
-- registra una liquidación: dinero que existe, que cuenta, y que no se
-- ve en ninguna parte del desglose.
--
-- El resultado es un patrimonio que no cuadra con sus partes y nada que
-- lo explique. En una app de finanzas eso no es un detalle de
-- presentación: un número que no cuadra hace dudar de todos los demás.
--
-- SOLUCIÓN: una casilla `otros` que recoge todo lo que es asset y no
-- cae en las anteriores. Está definida por descarte y no por lista, así
-- que un tipo de cuenta nuevo entrará ahí solo en vez de volver a
-- abrir el mismo agujero en silencio.
--
-- Con esto se cumple, y se puede comprobar:
--
--   liquido + ahorros + inversiones + por_cobrar + otros + deudas
--     = patrimonio
--
-- `deudas` sigue siendo negativo —una deuda es un saldo negativo, esa
-- es la regla de la que sale todo lo demás— así que suma, no resta.
-- =====================================================================

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
  -- Por descarte, no por lista: lo que es tuyo y no encaja arriba.
  coalesce(sum(e.amount) filter (
    where a.class = 'asset'
      and a.type not in ('checking','cash','digital_wallet','savings',
                         'investment','receivable','partner_receivable')
  ), 0)::bigint as otros,
  coalesce(sum(e.amount) filter (where a.class = 'liability'), 0)::bigint as deudas,
  coalesce(sum(e.amount) filter (
    where a.class in ('asset','liability')), 0)::bigint as patrimonio
from accounts a
left join transaction_entries e on e.account_id = a.id
group by a.owner_id;
