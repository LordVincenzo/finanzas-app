-- =====================================================================
-- MIGRACIÓN 0022 — eliminar_prestamo() ahora SÍ borra la cuenta
--
-- La 0014 se llamaba "eliminar_prestamo dejaba la cuenta huérfana" y
-- culpaba al orden de los DELETE: decía que Postgres seguía viendo
-- referencias desde transaction_entries. Reordenó las sentencias.
--
-- El síntoma seguía igual, porque la causa era otra.
--
--
-- LA CAUSA REAL
--
-- crear_prestamo() (0009) crea la cuenta por cobrar como cuenta de
-- sistema:
--
--     insert into accounts (owner_id, name, class, type, is_system)
--     values (v_uid, v_nombre, 'asset', 'receivable', true);
--                                                     ^^^^
--
-- Y la política de borrado de 0002 exige justo lo contrario:
--
--     create policy "borrar cuentas propias no del sistema"
--       on accounts for delete
--       using (owner_id = (select auth.uid()) and is_system = false);
--                                                 ^^^^^^^^^^^^^^^^^
--
-- eliminar_prestamo() es SECURITY INVOKER, así que corre con los
-- permisos de quien llama y el RLS se aplica. El `delete from accounts`
-- no encuentra ninguna fila que la política le deje tocar, borra CERO
-- filas, y no falla: un DELETE que no borra nada es un DELETE válido.
--
-- Por eso reordenar no cambió nada. Nunca fue el orden.
--
--
-- COMPROBADO EN LA APP, no solo leyendo:
--
--     antes de borrar:  ["Efectivo", "Nu", "Por cobrar: Juan Pérez"]
--     tras borrar:      ["Efectivo", "Nu", "Por cobrar: Juan Pérez"]
--
--
-- QUÉ ROMPE (y qué no)
--
-- NO es un error de dinero. La cuenta queda en saldo 0 porque sus
-- líneas sí se borraron con las transacciones, así que el patrimonio
-- es correcto. Lo que deja son cuentas muertas que:
--   - ensucian el desplegable de filtros de /escritorio/movimientos;
--   - ocupan el nombre en uq_account_name_per_owner, así que volver a
--     prestarle a la misma persona crea "Por cobrar: Juan Pérez (2)".
--
--
-- SOLUCIÓN: SECURITY DEFINER, como el resto de los borrados
--
-- eliminar_movimiento (0015), eliminar_meta (0018) y
-- eliminar_liquidacion (0021) ya son SECURITY DEFINER con la
-- autorización comprobada a mano. Esta es la única que se quedó como
-- INVOKER, y por eso es la única que choca con el RLS.
--
-- La comprobación de dueño ya estaba y no se toca:
--     where l.id = p_prestamo and l.owner_id = v_uid
-- Si el préstamo no es tuyo, v_recv sale NULL y la función aborta antes
-- de borrar nada.
--
-- Y con SECURITY DEFINER pasa a `search_path = ''` con prefijos
-- `public.` explícitos, que es la regla del proyecto para no dejar que
-- nadie manipule el search_path.
-- =====================================================================

create or replace function public.eliminar_prestamo(p_prestamo uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_recv uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  -- La autorización, explícita: si el préstamo no es tuyo no hay fila.
  select l.receivable_account_id into v_recv
  from public.loans l
  where l.id = p_prestamo and l.owner_id = v_uid;

  if v_recv is null then
    raise exception 'El prestamo no existe o no es tuyo';
  end if;

  -- 1. Metadatos del préstamo
  delete from public.loan_payments     where loan_id = p_prestamo;
  delete from public.loan_installments where loan_id = p_prestamo;
  delete from public.loans             where id = p_prestamo;

  -- 2. Las transacciones que tocan la cuenta por cobrar: el desembolso
  --    y los abonos. Sus líneas caen en cascada, así que el dinero
  --    vuelve a las cuentas de origen y el patrimonio se recalcula solo.
  delete from public.transactions t
   where exists (
     select 1 from public.transaction_entries e
     where e.transaction_id = t.id and e.account_id = v_recv
   );

  -- 3. Y ahora la cuenta, que antes se quedaba aquí para siempre.
  delete from public.accounts where id = v_recv;
end;
$$;

revoke all on function public.eliminar_prestamo(uuid) from public;
grant execute on function public.eliminar_prestamo(uuid) to authenticated;


-- =====================================================================
-- LIMPIEZA de las que ya quedaron huérfanas
--
-- Solo cuentas por cobrar de sistema que no tienen NI UNA línea en el
-- ledger NI ningún préstamo apuntándolas. Por construcción eso solo
-- puede ser el residuo de un préstamo borrado: una cuenta viva siempre
-- tiene su transacción de desembolso, y una de un préstamo activo
-- siempre tiene su fila en loans.
-- =====================================================================

do $$
declare
  v_borradas int;
begin
  delete from public.accounts a
   where a.type = 'receivable'
     and a.is_system
     and not exists (
       select 1 from public.transaction_entries e where e.account_id = a.id
     )
     and not exists (
       select 1 from public.loans l where l.receivable_account_id = a.id
     );

  get diagnostics v_borradas = row_count;
  raise notice 'Cuentas por cobrar huerfanas eliminadas: %', v_borradas;
end;
$$;
