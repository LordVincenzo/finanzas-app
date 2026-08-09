-- =====================================================================
-- CORRECCIÓN 0007 — saldo de las cuentas compartidas
--
-- Problema: al compartir una cuenta, la pareja veía el nombre pero
-- el saldo salía en 0, porque no puede leer transaction_entries
-- (las transacciones siguen siendo privadas).
--
-- Decisión: compartir una cuenta muestra su SALDO, pero NO los
-- movimientos que lo componen. Ver cuánto tienes no es ver en qué
-- lo gastas.
--
-- La función es SECURITY DEFINER (se salta el RLS) pero comprueba
-- explícitamente que quien pregunta tenga derecho a ver esa cuenta.
-- =====================================================================

create or replace function public.saldo_cuenta_visible(p_cuenta uuid)
returns bigint
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_owner      uuid;
  v_visibility text;
  v_couple     uuid;
begin
  if v_uid is null then
    return 0;
  end if;

  select a.owner_id, a.visibility::text, a.couple_id
    into v_owner, v_visibility, v_couple
  from public.accounts a
  where a.id = p_cuenta;

  if v_owner is null then
    return 0;
  end if;

  -- Comprobamos el permiso a mano, replicando la política de accounts.
  if not (
       v_owner = v_uid
    or (v_visibility = 'shared_view' and public.is_partner_of(v_owner))
    or (v_visibility = 'joint' and v_couple = public.current_couple_id())
  ) then
    raise exception 'No tienes acceso a esa cuenta';
  end if;

  return coalesce(
    (select sum(e.amount) from public.transaction_entries e
      where e.account_id = p_cuenta), 0
  );
end;
$$;