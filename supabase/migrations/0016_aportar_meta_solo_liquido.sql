-- =====================================================================
-- MIGRACIÓN 0016 — aportar_meta() debe rechazar el dinero por cobrar
--
-- PROBLEMA: la función se escribió en 0008 y validaba así:
--
--     if v_class <> 'asset' then
--       raise exception 'Solo puedes asignar dinero desde cuentas de dinero';
--
-- Filtra por CLASE, no por TIPO. Y las cuentas por cobrar son de clase
-- 'asset': ensure_partner_account() (0010) las crea literalmente como
-- ('asset', 'partner_receivable'), y crear_prestamo() hace lo mismo con
-- las 'receivable'. El mensaje promete algo que el chequeo no cumple.
--
-- Consecuencia: se podía asignar a una meta de ahorro el dinero que le
-- prestaste a alguien. El aporte contaría en metas_resumen.acumulado,
-- pero desaparecería de cuentas_disponible.asignado, porque desde la
-- migración 0012 esa vista excluye los tipos por cobrar. Dos números
-- que deberían moverse juntos se separarían, sin ningún error visible.
--
-- Es el mismo patrón que eliminar_movimiento(): una función escrita
-- antes de que existiera una distinción que después pasó a importar.
--
-- SOLUCIÓN: en vez de copiar aquí la lista de tipos gastables, se le
-- pregunta a cuentas_disponible. Si la cuenta no aparece en esa vista,
-- no es dinero que puedas gastar hoy y no se puede asignar.
--
-- Por qué no copiar la lista: habría dos definiciones de "dinero
-- gastable" —la de la vista y la de la función— y el día que se añada
-- un tipo de cuenta habría que acordarse de tocar las dos. Este bug
-- nació exactamente así.
--
-- De paso desaparece una tercera copia del mismo cálculo: la función
-- sumaba entries y contributions a mano para averiguar el disponible,
-- que es justo lo que la vista ya devuelve.
--
-- La comprobación solo se aplica a los aportes POSITIVOS. Si alguna vez
-- quedó un aporte hecho desde una cuenta hoy excluida, bloquear también
-- los negativos impediría deshacerlo: prohibir meter no debe implicar
-- prohibir sacar.
-- =====================================================================

create or replace function public.aportar_meta(
  p_meta   uuid,
  p_cuenta uuid,
  p_monto  bigint,
  p_nota   text default null,
  p_fecha  date default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_owner   uuid;
  v_libre   bigint;
  v_en_meta bigint;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_monto is null or p_monto = 0 then
    raise exception 'El aporte no puede ser cero';
  end if;

  select a.owner_id into v_owner
  from accounts a where a.id = p_cuenta;

  if v_owner is null then
    raise exception 'La cuenta no existe o no tienes acceso';
  end if;

  if v_owner <> v_uid then
    raise exception 'Solo puedes asignar dinero de tus propias cuentas';
  end if;

  -- Aporte positivo: la cuenta tiene que ser dinero gastable y tener
  -- saldo sin asignar. Las dos cosas las responde la misma vista.
  if p_monto > 0 then
    select d.disponible into v_libre
    from cuentas_disponible d
    where d.account_id = p_cuenta;

    if not found then
      raise exception
        'Esa cuenta no es dinero que puedas gastar hoy. El dinero prestado no se puede asignar a una meta hasta que te lo devuelvan.';
    end if;

    if p_monto > v_libre then
      raise exception
        'Solo tienes % sin asignar en esa cuenta', v_libre;
    end if;
  end if;

  -- Aporte negativo (retirar): no puede dejar la meta en negativo.
  if p_monto < 0 then
    select coalesce(sum(c.amount), 0) into v_en_meta
    from savings_contributions c where c.goal_id = p_meta;

    if v_en_meta + p_monto < 0 then
      raise exception 'La meta solo tiene % acumulado', v_en_meta;
    end if;
  end if;

  insert into savings_contributions
    (goal_id, profile_id, account_id, amount, note, occurred_on)
  values
    (p_meta, v_uid, p_cuenta, p_monto,
     nullif(trim(coalesce(p_nota, '')), ''),
     coalesce(p_fecha, (now() at time zone 'America/Bogota')::date))
  returning id into v_id;

  return v_id;
end;
$$;