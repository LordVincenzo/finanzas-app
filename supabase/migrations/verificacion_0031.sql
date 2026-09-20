-- =====================================================================
-- VERIFICACIÓN 0031 — extracto_por_cuenta
--
-- Se ejecuta DESPUÉS de 0031, en Supabase → SQL Editor. Es UNA SOLA
-- consulta: seleccionas todo, le das a Run, y sale una tabla con todo.
--
-- POR QUÉ UNA SOLA. El SQL Editor enseña el resultado de la ÚLTIMA
-- sentencia. Un archivo con seis `select` deja cinco resultados que no
-- ves, y acabas creyendo que la comprobación salió bien porque la que
-- se ve dice OK.
--
-- Y POR QUÉ NO HAY `auth.uid()` AQUÍ. El SQL Editor corre como el rol
-- `postgres`: no aplica RLS y `auth.uid()` es null. Un filtro
-- `owner_id = auth.uid()` no devuelve NADA en esta pantalla, aunque
-- funcione perfectamente desde la app. Por eso, en vez de filtrar por
-- dueño, la consulta lo ENSEÑA: así se distinguen tus cuentas de las
-- de tu pareja, que desde aquí se ven todas.
--
-- Las filas 1 a 5 tienen que decir OK.
-- Las filas 6 son avisos sobre TUS DATOS, no fallos de la vista: una
-- cuenta de dinero en negativo o una deuda a favor significan que hay
-- un movimiento con el origen y el destino cambiados. Si no sale
-- ninguna, mejor.
-- =====================================================================

select 1 as n,
       'La vista existe' as revision,
       null::text as de_quien,
       case when exists (
         select 1 from information_schema.views
         where table_schema = 'public' and table_name = 'extracto_por_cuenta'
       ) then 'OK' else 'MAL: no se creo, vuelve a correr 0031' end as resultado

union all
-- Sin security_invoker la vista leería SIN RLS, y desde la app cada
-- quien vería las cuentas del otro.
select 2,
       'Lee con tu sesion (security_invoker)',
       null,
       case when (
         select 'security_invoker=on' = any(c.reloptions)
         from pg_class c
         join pg_namespace ns on ns.oid = c.relnamespace
         where ns.nspname = 'public' and c.relname = 'extracto_por_cuenta'
       ) then 'OK' else 'MAL: la veria tu pareja entera' end

union all
-- LA QUE IMPORTA: con lo que empezó + lo que entró − lo que salió tiene
-- que ser con lo que terminó, en todas las cuentas y todos los meses.
-- Las dos puntas se calculan con sumas distintas; si no cuadran, el
-- extracto miente.
select 3,
       'Las puntas cuadran',
       null,
       case when (
         select count(*) from extracto_por_cuenta
         where saldo_inicial + entro - salio <> saldo_final
       ) = 0 then 'OK' else 'MAL: ' || (
         select count(*)::text from extracto_por_cuenta
         where saldo_inicial + entro - salio <> saldo_final
       ) || ' filas descuadradas' end

union all
-- El cierre del mes en curso tiene que ser el saldo de HOY, que es lo
-- que enseña el resto de la app. Si no coinciden hay dos verdades
-- sobre el mismo dinero.
select 4,
       'Cierra igual que el resto de la app',
       null,
       coalesce((
         select 'MAL: ' || string_agg(distinct e.cuenta, ', ')
         from extracto_por_cuenta e
         join cuentas_disponible d on d.account_id = e.cuenta_id
         where e.mes = to_char((now() at time zone 'America/Bogota'), 'YYYY-MM')
           and e.saldo_final <> d.saldo
       ), 'OK')

union all
-- Las categorías no tienen saldo, tienen total. Ninguna debe colarse.
select 5,
       'Solo cuentas de verdad',
       null,
       case when (
         select count(*) from extracto_por_cuenta
         where clase not in ('asset', 'liability')
       ) = 0 then 'OK' else 'MAL: se colaron categorias' end

union all
-- Avisos sobre los datos, no sobre la vista.
select 6,
       case when e.clase = 'asset'
            then 'AVISO: cuenta de dinero en NEGATIVO'
            else 'AVISO: deuda A FAVOR (en positivo)' end,
       p.display_name,
       e.cuenta || ' = ' || e.saldo_final::text
from extracto_por_cuenta e
join profiles p on p.id = e.owner_id
where e.mes = to_char((now() at time zone 'America/Bogota'), 'YYYY-MM')
  and ((e.clase = 'asset'     and e.saldo_final < 0)
    or (e.clase = 'liability' and e.saldo_final > 0))

order by n, de_quien, resultado;
