-- =====================================================================
-- CORRECCIÓN 0014 — eliminar_prestamo dejaba la cuenta huérfana
--
-- El DELETE de accounts fallaba silenciosamente porque Postgres
-- todavía veía referencias desde transaction_entries. Forzamos el
-- orden: primero las líneas, luego las transacciones, luego la cuenta.
--
-- ---------------------------------------------------------------------
-- NOTA DE RECUPERACIÓN (añadida después): este archivo se perdió del
-- repositorio y se reconstruyó leyendo la función viva en la base con
-- pg_get_functiondef(). El cuerpo es literalmente el que está aplicado
-- hoy: es la versión de eliminar_prestamo() que usa la app.
--
-- OJO CON EL DIAGNÓSTICO DE ARRIBA. La cuenta seguía huérfana, pero no
-- por el orden de los DELETE. Ver la migración 0022, que lo corrige.
-- ---------------------------------------------------------------------
-- =====================================================================

create or replace function public.eliminar_prestamo(p_prestamo uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_recv uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select l.receivable_account_id into v_recv
  from loans l
  where l.id = p_prestamo and l.owner_id = v_uid;

  if v_recv is null then
    raise exception 'El prestamo no existe o no es tuyo';
  end if;

  -- 1. Metadatos del préstamo
  delete from loan_payments     where loan_id = p_prestamo;
  delete from loan_installments where loan_id = p_prestamo;
  delete from loans             where id = p_prestamo;

  -- 2. TODAS las transacciones que tocan la cuenta por cobrar.
  --    Al borrarlas, sus líneas caen en cascada.
  delete from transactions t
   where exists (
     select 1 from transaction_entries e
     where e.transaction_id = t.id and e.account_id = v_recv
   );

  -- 3. Ahora sí, la cuenta ya no tiene referencias
  delete from accounts where id = v_recv;
end;
$$;
