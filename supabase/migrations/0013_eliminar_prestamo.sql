-- =====================================================================
-- CORRECCIÓN 0013 — eliminar préstamos registrados por error
--
-- Problema: cancelar_prestamo() solo cambiaba el estado y dejaba el
-- dinero en el ledger. El patrimonio seguía contando dinero que ya
-- nadie debía. Dos fuentes de verdad contando cosas distintas.
--
-- Solución: eliminar_prestamo() borra todo rastro. Es lo que se
-- necesita cuando registras algo por error.
--
-- "Perdonar una deuda" es otra cosa distinta y se resolverá cuando
-- haga falta: ahí el dinero sí debe convertirse en un gasto real.
--
-- ---------------------------------------------------------------------
-- NOTA DE RECUPERACIÓN (añadida después): este archivo se perdió del
-- repositorio y se reconstruyó leyendo la función viva en la base con
-- pg_get_functiondef(). El cuerpo es literalmente el que está aplicado.
-- La migración 0014 reemplaza esta función entera, así que este archivo
-- solo importa para reconstruir la base desde cero en orden.
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

  -- Transacciones de los abonos
  delete from transactions
   where id in (select transaction_id from loan_payments
                where loan_id = p_prestamo and transaction_id is not null);

  delete from loan_payments     where loan_id = p_prestamo;
  delete from loan_installments where loan_id = p_prestamo;

  -- Transacción del desembolso
  delete from transactions
   where id in (
     select distinct e.transaction_id
     from transaction_entries e
     where e.account_id = v_recv
   );

  delete from loans    where id = p_prestamo;
  delete from accounts where id = v_recv;
end;
$$;
