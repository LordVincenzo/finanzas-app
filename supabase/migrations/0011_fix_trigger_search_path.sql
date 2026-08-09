-- =====================================================================
-- CORRECCIÓN 0011 — el trigger de integridad debe ver todas las líneas
--
-- Problema: check_transaction_balanced hace JOIN con accounts, y al
-- ejecutarse con los permisos del usuario, el RLS ocultaba las cuentas
-- de la pareja en la transacción espejo. El trigger veía 0 líneas y
-- rechazaba movimientos perfectamente válidos.
--
-- Un validador de integridad no puede depender de quién mira: debe
-- ver la fila completa. Por eso SECURITY DEFINER.
--
-- Esto NO relaja la seguridad: la función solo LEE, solo para contar
-- y sumar, y nunca devuelve datos al usuario. Su única salida posible
-- es dejar pasar la operación o abortarla.
-- =====================================================================

create or replace function public.check_transaction_balanced()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id      uuid;
  v_sum        bigint;
  v_count      int;
  v_currencies int;
begin
  v_tx_id := coalesce(new.transaction_id, old.transaction_id);

  if not exists (select 1 from transactions where id = v_tx_id) then
    return null;
  end if;

  select count(*), coalesce(sum(e.amount), 0), count(distinct a.currency)
    into v_count, v_sum, v_currencies
  from transaction_entries e
  join accounts a on a.id = e.account_id
  where e.transaction_id = v_tx_id;

  if v_count < 2 then
    raise exception
      'Movimiento % invalido: necesita al menos 2 lineas (tiene %)', v_tx_id, v_count;
  end if;

  if v_sum <> 0 then
    raise exception
      'Movimiento % invalido: las lineas suman % y deben sumar 0. '
      'Esto significaria crear o destruir dinero.', v_tx_id, v_sum;
  end if;

  if v_currencies > 1 then
    raise exception
      'Movimiento % invalido: mezcla monedas distintas', v_tx_id;
  end if;

  return null;
end;
$$;