-- =====================================================================
-- MIGRACIÓN 0015 — BLINDAR eliminar_movimiento()
--
-- PROBLEMA: la función se escribió en 0004, antes de que existieran los
-- préstamos (0009), los gastos compartidos y las liquidaciones (0010).
-- Solo bloqueaba el tipo 'opening' y borraba la transacción sin mirar
-- nada más. Eso abría tres fallos silenciosos:
--
--   1. GASTO COMPARTIDO. crear_gasto_compartido() escribe dos
--      transacciones espejo, una en cada ledger. Borrar la del pagador
--      desde Movimientos dejaba viva la de la pareja: su patrimonio
--      seguía reducido y su balance seguía diciendo que debe dinero,
--      mientras el del pagador ya no reflejaba nada por cobrar.
--      Los dos ledgers siguen sumando 0 por separado, así que el
--      trigger check_transaction_balanced no puede detectarlo.
--      Además, payer_tx_id tiene ON DELETE SET NULL: la fila de
--      shared_expenses sobrevivía con el enlace roto.
--
--   2. LIQUIDACIÓN. liquidar_con_pareja() escribe igualmente dos
--      transacciones espejo. Mismo desenlace.
--
--   3. PRÉSTAMO. Borrar la transacción de un préstamo dejaba el
--      registro del préstamo, sus cuotas y su cuenta por cobrar
--      apuntando a una transacción inexistente. Es el mismo tipo de
--      huérfano que corrigió la migración 0014, por otra puerta.
--
--   4. Sin comprobar owner_id, pasar el id de una transacción 'joint'
--      de la pareja superaba todas las validaciones; el DELETE no
--      borraba nada por RLS, pero la función devolvía éxito. La app
--      informaba de un borrado que nunca ocurrió.
--
-- SOLUCIÓN: lista blanca en vez de lista negra. Solo se borran los
-- cuatro tipos que crea crear_movimiento(). Cualquier otro pertenece a
-- un registro mayor y tiene su propia función de borrado, que sí
-- deshace todas las piezas a la vez.
--
-- Por qué lista blanca: enumerar lo prohibido obliga a acordarse de
-- volver aquí cada vez que se añada un tipo de transacción. Enumerar
-- lo permitido falla del lado seguro: un tipo nuevo queda bloqueado
-- hasta que alguien decida explícitamente que se puede borrar.
--
-- SECURITY DEFINER: el guardián necesita ver shared_expenses aunque el
-- vínculo de pareja se haya deshecho. Un validador que solo ve lo que
-- el RLS le deja ver no puede garantizar nada. A cambio, la
-- autorización se comprueba a mano y de forma explícita: owner_id
-- tiene que ser el usuario de la sesión, y el DELETE va por id.
-- =====================================================================

create or replace function public.eliminar_movimiento(p_tx uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_tipo  public.transaction_type;
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select t.type, t.owner_id
    into v_tipo, v_owner
  from public.transactions t
  where t.id = p_tx;

  if not found then
    raise exception 'El movimiento no existe';
  end if;

  -- Antes faltaba: sin esto, borrar una transaccion ajena devolvia
  -- exito sin borrar nada.
  if v_owner is distinct from v_uid then
    raise exception 'Solo puedes borrar tus propios movimientos';
  end if;

  if v_tipo = 'opening' then
    raise exception
      'No se puede borrar una apertura. Usa un ajuste de saldo para corregirla.';
  end if;

  -- Lista blanca: exactamente los tipos que produce crear_movimiento()
  -- y ajustar_saldo(). Todo lo demas se borra desde su pantalla.
  if v_tipo not in ('expense', 'income', 'transfer', 'adjustment') then
    raise exception
      'Este movimiento forma parte de un prestamo o una liquidacion. Borralo desde su propia pantalla para que se deshaga completo.';
  end if;

  -- Un gasto compartido es de tipo 'expense', asi que pasa la lista
  -- blanca. Hay que preguntarselo a shared_expenses directamente.
  if exists (
    select 1 from public.shared_expenses e
    where e.payer_tx_id = p_tx or e.other_tx_id = p_tx
  ) then
    raise exception
      'Este es un gasto compartido. Borralo desde Pareja para que se deshaga tambien en el ledger de tu pareja.';
  end if;

  -- Cinturon y tirantes: si en el futuro una liquidacion cambiara de
  -- tipo, este chequeo la seguiria atrapando.
  if exists (
    select 1 from public.couple_settlements s
    where s.from_tx_id = p_tx or s.to_tx_id = p_tx
  ) then
    raise exception
      'Esta es una liquidacion con tu pareja. Borrala desde Pareja.';
  end if;

  delete from public.transactions where id = p_tx;
end;
$$;

revoke all on function public.eliminar_movimiento(uuid) from public;
grant execute on function public.eliminar_movimiento(uuid) to authenticated;
