-- =====================================================================
-- VERIFICACIÓN 0031 — extracto_por_cuenta
--
-- Se ejecuta DESPUÉS de 0031, en el SQL Editor, con tu sesión. Todo
-- tiene que salir OK. Si algo sale MAL, no subas nada: la pantalla del
-- extracto estaría enseñando saldos que no son.
-- =====================================================================

-- 1) La vista existe y se puede leer.
select 'vista existe' as prueba,
       case when exists (
         select 1 from information_schema.views
         where table_schema = 'public' and table_name = 'extracto_por_cuenta'
       ) then 'OK' else 'MAL' end as resultado;

-- 2) security_invoker encendido. Sin esto la vista leería SIN RLS y
--    cada quien vería las cuentas del otro.
select 'security_invoker' as prueba,
       case when (
         select 'security_invoker=on' = any(c.reloptions)
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = 'extracto_por_cuenta'
       ) then 'OK' else 'MAL' end as resultado;

-- 3) LA PRUEBA QUE IMPORTA: saldo_inicial + entró − salió = saldo_final,
--    en TODAS las filas y todos los meses. Las dos puntas se calculan
--    con sumas distintas (una corta antes del día 1, otra al cierre);
--    si alguna vez no cuadran, el extracto miente.
select 'las puntas cuadran' as prueba,
       case when count(*) = 0 then 'OK'
            else 'MAL: ' || count(*) || ' filas descuadradas' end as resultado
from extracto_por_cuenta
where saldo_inicial + entro - salio <> saldo_final;

-- 4) El cierre del mes en curso tiene que ser el saldo de HOY, que es
--    lo que enseña el resto de la app (cuentas_disponible). Si estos
--    dos números no coinciden, hay dos verdades sobre el mismo dinero.
select 'cierra igual que cuentas_disponible' as prueba,
       case when count(*) = 0 then 'OK'
            else 'MAL: ' || string_agg(cuenta, ', ') end as resultado
from (
  select e.cuenta
  from extracto_por_cuenta e
  join cuentas_disponible d on d.account_id = e.cuenta_id
  where e.mes = to_char((now() at time zone 'America/Bogota'), 'YYYY-MM')
    and e.saldo_final <> d.saldo
) x;

-- 5) Ninguna categoría se coló: solo asset y liability tienen saldo.
select 'solo cuentas de verdad' as prueba,
       case when count(*) = 0 then 'OK'
            else 'MAL: ' || count(*) || ' filas de categoría' end as resultado
from extracto_por_cuenta
where clase not in ('asset', 'liability');

-- 6) Para mirarlo con los ojos: el mes pasado, cuenta por cuenta.
--
--    OJO CON EL FILTRO DE DUEÑO. Sin `owner_id = auth.uid()` salen
--    también las cuentas de tu pareja que están compartidas —RLS te
--    deja verlas— y entonces aparecen dos "Nequi" y dos "Davivienda"
--    como si fueran duplicados tuyos. La pantalla del extracto sí
--    filtra por dueño; esta consulta también debe hacerlo.
select cuenta, saldo_inicial, entro, salio, saldo_final
from extracto_por_cuenta
where owner_id = auth.uid()
  and mes = to_char(
    (now() at time zone 'America/Bogota') - interval '1 month', 'YYYY-MM')
order by cuenta;

-- 7) Señales de que algo se registró al revés. No es un fallo de la
--    vista: es la vista haciendo su trabajo. Una cuenta de dinero en
--    negativo o una deuda en positivo significan que hay un movimiento
--    con el origen y el destino cambiados.
select cuenta, tipo, saldo_final,
       case
         when clase = 'asset'     then 'Cuenta de dinero en NEGATIVO'
         when clase = 'liability' then 'Deuda a FAVOR (en positivo)'
       end as señal
from extracto_por_cuenta
where owner_id = auth.uid()
  and mes = to_char((now() at time zone 'America/Bogota'), 'YYYY-MM')
  and ((clase = 'asset' and saldo_final < 0)
    or (clase = 'liability' and saldo_final > 0))
order by abs(saldo_final) desc;
