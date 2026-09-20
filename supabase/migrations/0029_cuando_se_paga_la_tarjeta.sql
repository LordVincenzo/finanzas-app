-- =====================================================================
-- MIGRACIÓN 0029 — CUÁNDO SE PAGA LA TARJETA
--
-- PROBLEMA: la app sabe CUÁNTO debes y no CUÁNDO hay que pagarlo. Con
-- dos o tres tarjetas, la fecha límite es justo lo que se olvida, y
-- olvidarla no cuesta un descuadre: cuesta intereses de mora, que en
-- Colombia rondan el 25% anual. Es el único sitio de esta app donde no
-- registrar algo te quita dinero de verdad.
--
-- DOS FECHAS, NO UNA. Una tarjeta tiene corte y límite de pago, y
-- confundirlas es el error clásico:
--
--   corte   el día que cierra el extracto. Lo que compres después ya
--           no entra en ESTE pago, entra en el siguiente.
--   límite  el día que hay que pagar, normalmente 10-20 días después.
--
-- Con solo el límite, la app no puede decir "esto que acabas de comprar
-- lo pagas el mes que viene", que es la pregunta real cuando uno está
-- en la caja decidiendo si usar la tarjeta.
--
-- SON DÍAS DEL MES, NO FECHAS. "Corte el 15, pago el 5" vale para
-- siempre; una fecha concreta habría que volver a escribirla cada mes,
-- y eso se abandona (mismo razonamiento que los topes de la 0028).
--
-- SOLO PARA DEUDAS. A una cuenta de ahorros no se le pone día de corte.
-- Se comprueba contra la clase, no contra el tipo, para que una deuda
-- nueva que se invente mañana lo herede sola.
--
-- NADA DE ESTO MUEVE DINERO. Son dos números al lado de una cuenta y
-- una vista que cuenta días. El pago se sigue registrando como la
-- transferencia que es.
-- =====================================================================

alter table accounts
  add column if not exists dia_corte int
    check (dia_corte is null or dia_corte between 1 and 31),
  add column if not exists dia_pago int
    check (dia_pago is null or dia_pago between 1 and 31);

comment on column accounts.dia_corte is
  'Día del mes en que cierra el extracto de una tarjeta. Solo para clase liability.';
comment on column accounts.dia_pago is
  'Día del mes en que vence el pago. Solo para clase liability.';


-- =====================================================================
-- PONER LAS FECHAS
--
-- Por RPC como todo lo demás. Pasar null en las dos las quita.
-- =====================================================================

create or replace function public.poner_fechas_tarjeta(
  p_cuenta uuid,
  p_corte  int,
  p_pago   int
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_clase account_class;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select a.class into v_clase
  from accounts a
  where a.id = p_cuenta and a.owner_id = v_uid;

  if not found then
    raise exception 'Esa cuenta no existe o no es tuya';
  end if;

  if v_clase <> 'liability' then
    raise exception 'Solo una deuda o tarjeta tiene fecha de pago';
  end if;

  if p_corte is not null and (p_corte < 1 or p_corte > 31) then
    raise exception 'El dia de corte tiene que estar entre 1 y 31';
  end if;
  if p_pago is not null and (p_pago < 1 or p_pago > 31) then
    raise exception 'El dia de pago tiene que estar entre 1 y 31';
  end if;

  update accounts
     set dia_corte = p_corte,
         dia_pago  = p_pago,
         updated_at = now()
   where id = p_cuenta;
end;
$$;

revoke all on function public.poner_fechas_tarjeta(uuid, int, int) from public;
grant execute on function public.poner_fechas_tarjeta(uuid, int, int) to authenticated;


-- =====================================================================
-- CUÁNDO TOCA PAGAR
--
-- Devuelve la próxima fecha de pago y cuántos días faltan.
--
-- SI EL DÍA YA PASÓ ESTE MES, es del mes que viene. Y el día se recorta
-- al último del mes: una tarjeta que vence el 31 vence el 28 en
-- febrero, porque el 31 de febrero no existe y una fecha inválida haría
-- fallar la consulta entera en vez de solo esa fila.
--
-- `deuda` sale de account_balances, que ya suma las entries. Aquí no se
-- vuelve a sumar nada.
-- =====================================================================

drop view if exists tarjetas_por_pagar;

create view tarjetas_por_pagar
with (security_invoker = on) as
with base as (
  select
    a.owner_id,
    a.id as account_id,
    a.name,
    a.type,
    a.dia_corte,
    a.dia_pago,
    coalesce(b.balance, 0)::bigint as saldo,
    timezone('America/Bogota', now())::date as hoy
  from accounts a
  left join account_balances b on b.account_id = a.id
  where a.class = 'liability'
    and a.is_active
    and a.dia_pago is not null
)
select
  owner_id,
  account_id,
  name,
  type,
  dia_corte,
  dia_pago,
  -- La deuda en positivo: "debes 380.000" se lee mejor que "-380.000"
  -- cuando la palabra de al lado ya es "debes".
  (- saldo)::bigint as debes,
  proxima,
  (proxima - hoy)::int as dias
from base,
lateral (
  select
    case
      -- Todavía no ha pasado este mes.
      when dia_pago >= extract(day from hoy)::int
        then make_date(
          extract(year from hoy)::int,
          extract(month from hoy)::int,
          least(dia_pago, extract(day from (
            date_trunc('month', hoy) + interval '1 month - 1 day'))::int)
        )
      -- Ya pasó: toca el mes que viene.
      else make_date(
        extract(year from (hoy + interval '1 month'))::int,
        extract(month from (hoy + interval '1 month'))::int,
        least(dia_pago, extract(day from (
          date_trunc('month', hoy + interval '1 month')
          + interval '1 month - 1 day'))::int)
      )
    end as proxima
) f
where saldo < 0;   -- sin deuda no hay nada que pagar

grant select on tarjetas_por_pagar to authenticated;
