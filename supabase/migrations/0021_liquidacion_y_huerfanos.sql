-- =====================================================================
-- MIGRACIÓN 0021 — LA LIQUIDACIÓN NO DEBE TORCER EL PATRIMONIO DEL OTRO
--                  (+ dos huérfanos que quedaron sueltos)
--
-- Contenido:
--   0. GUARDAS: aborta si 0013/0014 cambiaron lo que aquí se reemplaza
--   1. is_pending_location + ensure_pending_account()
--   2. liquidar_con_pareja()    -> el espejo deja de usar el opening
--   3. eliminar_pago_prestamo() -> el estado se DERIVA, no se alterna
--   4. eliminar_liquidacion()   -> no existía; el error mandaba a la nada
--
--
-- PROBLEMA 1 — EL PATRIMONIO DE QUIEN NO REGISTRA LA LIQUIDACIÓN
--
-- liquidar_con_pareja() escribe en los dos ledgers, y en el del otro
-- movía su balance contra su cuenta de "Patrimonio inicial":
--
--     insert into transaction_entries values
--       (v_tx2, v_bal_otro, -p_monto),
--       (v_tx2, public.ensure_opening_account(v_otro), p_monto);
--
-- Esa cuenta es de clase 'income', y patrimonio_detalle solo suma
-- 'asset' y 'liability'. O sea: la contrapartida NO existe para el
-- patrimonio.
--
--   Marina te debe 60.000 y te paga. Ella lo registra.
--
--     Marina (registra)            Tú (recibes)
--     Nu            -60.000        Balance   +60.000 -> 0
--     Balance       +60.000 -> 0   Patrimonio inicial +60.000
--     Patrimonio: igual   OK       Patrimonio: -60.000   MAL
--
-- Recibiste 60.000 en efectivo y tu patrimonio BAJA 60.000. Y al
-- contrario si la registras tú con p_yo_pago = false: el patrimonio de
-- Marina SUBE 60.000 aunque acabe de pagar. Se arregla solo cuando la
-- otra persona hace un ajuste de saldo a mano, pero nada en su pantalla
-- se lo dice. El aviso que existe ("El saldo de su cuenta lo ajusta
-- ella") está en el formulario de quien registra, no de quien tiene que
-- actuar.
--
-- SOLUCIÓN: una cuenta de sistema de clase 'asset', "Pendiente de
-- ubicar". El espejo mueve el balance contra ella en vez de contra el
-- opening:
--
--     Balance            +60.000 -> 0
--     Pendiente de ubicar +60.000
--     Patrimonio: igual   OK
--
-- Y además del patrimonio, cuadra el disponible: el dinero entró de
-- verdad, solo no sabemos a qué cuenta. La suma total sigue siendo
-- correcta desde el primer segundo.
--
-- El cabo suelto queda VISIBLE (una cuenta con saldo y un nombre que se
-- explica solo) y se cierra con una operación que ya existe: una
-- transferencia de "Pendiente de ubicar" a Nu. No hace falta ninguna
-- función nueva ni ningún ajuste de saldo.
--
-- ¿Por qué no dejar el espejo pendiente de confirmación en vez de
-- adivinar? Porque entonces los dos verían balances distintos: "están a
-- mano" para uno y "debes 60.000" para el otro, hasta que confirme. Que
-- los dos ledgers no se contradigan nunca es justo lo que construyó la
-- 0010; un cabo suelto visible es mucho menos grave que dos verdades.
--
-- LIMITACIÓN CONOCIDA: si se borra una liquidación después de que la
-- otra persona ya ubicó el dinero, su "Pendiente de ubicar" se queda en
-- negativo. Es visible y se arregla con otra transferencia, así que no
-- merece la maquinaria de impedirlo.
--
--
-- PROBLEMA 2 — eliminar_pago_prestamo() REVIVE PRÉSTAMOS CANCELADOS
--
-- La versión de 0009 termina así, sin mirar nada:
--
--     update loans    set status = 'active'  where id = v_loan;
--     update accounts set is_active = true   where id = v_recv;
--
-- Dos fallos. Un préstamo 'cancelled' vuelve a 'active' al borrar un
-- abono. Y uno con varios abonos que sigue cubierto tras borrar uno
-- también pasa a 'active', cuando debería seguir 'paid'.
--
-- El arreglo va en la dirección del resto del proyecto: el estado se
-- DERIVA de la suma de los abonos, no se alterna a mano. Es la misma
-- idea que "una cuota NUNCA guarda pagada / no pagada" de 0009.
--
--
-- PROBLEMA 3 — NO HAY FORMA DE BORRAR UNA LIQUIDACIÓN
--
-- eliminar_movimiento() (0015) la rechaza con este mensaje:
--
--     'Esta es una liquidacion con tu pareja. Borrala desde Pareja.'
--
-- Pero eliminar_liquidacion() no existe, ni hay botón en Pareja, en
-- ninguna de las dos interfaces. Una liquidación mal registrada no se
-- podía borrar de ninguna manera: el mensaje manda a un sitio que no
-- está. Los gastos compartidos sí tienen su eliminar_gasto_compartido
-- desde 0010; las liquidaciones se quedaron sin el suyo.
-- =====================================================================


-- =====================================================================
-- 0. GUARDAS
--
-- Las migraciones 0013 y 0014 están aplicadas en la base pero NO en el
-- repositorio (0015 cita "la migración 0014" y eliminar_prestamo() se
-- llama desde la app sin estar definida en ningún archivo). Mientras eso
-- no se recupere, un CREATE OR REPLACE a ciegas sobre estas funciones
-- podría revertir en silencio un arreglo que no podemos leer.
--
-- Así que primero se comprueba que son las versiones que creemos. Si no
-- lo son, esta migración NO se aplica y dice por qué. Preferimos
-- abortar ruidosamente antes que perder un arreglo sin enterarnos.
-- =====================================================================

do $$
declare
  v_def text;
begin
  -- ---- liquidar_con_pareja debe ser la de 0010 ----------------------
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'liquidar_con_pareja';

  if v_def is null then
    raise exception
      'ABORTADA: no existe liquidar_con_pareja(). ¿Falta aplicar 0010?';
  end if;

  if position('ensure_pending_account' in v_def) > 0 then
    -- Ya está aplicada. Todo lo de abajo es idempotente (add column if
    -- not exists, create index if not exists, create or replace), así
    -- que volver a ejecutarla no rompe nada.
    raise notice 'liquidar_con_pareja() ya esta en la version de 0021';
  elsif position('ensure_opening_account' in v_def) = 0 then
    raise exception
      'ABORTADA: liquidar_con_pareja() no usa ensure_opening_account ni '
      'ensure_pending_account, asi que no es la version de 0010 ni la de '
      '0021 — alguien la cambio (¿0013 o 0014?). Recupera esas migraciones '
      'y revisa esta a mano antes de aplicarla.';
  end if;

  -- ---- eliminar_pago_prestamo debe ser la de 0009 -------------------
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'eliminar_pago_prestamo';

  if v_def is null then
    raise exception
      'ABORTADA: no existe eliminar_pago_prestamo(). ¿Falta aplicar 0009?';
  end if;

  -- La version de 0009 no declara v_estado ni menciona 'cancelled'; la
  -- corregida de aqui hace las dos cosas. v_estado es el marcador fiable
  -- porque es codigo, no un comentario.
  if position('v_estado' in v_def) > 0 then
    raise notice 'eliminar_pago_prestamo() ya esta en la version de 0021';
  elsif position('cancelled' in v_def) > 0 then
    raise exception
      'ABORTADA: eliminar_pago_prestamo() menciona cancelled pero no es la '
      'version de 0021 — alguien la cambio (¿0013 o 0014?). Recupera esas '
      'migraciones y revisa esta a mano antes de aplicarla.';
  end if;

  raise notice 'GUARDAS OK -> se puede aplicar (volver a ejecutarla es inocuo)';
end;
$$;


-- =====================================================================
-- 1. CUENTA "PENDIENTE DE UBICAR"
--
-- Mismo patrón que is_opening (0003) y is_partner_balance (0010): una
-- columna booleana y un índice único, en vez de añadir un valor al enum
-- account_type. ALTER TYPE ADD VALUE tiene restricciones dentro de
-- transacciones y no merece el riesgo.
-- =====================================================================

alter table accounts
  add column if not exists is_pending_location boolean not null default false;

create unique index if not exists uq_pending_account_per_owner
  on accounts (owner_id)
  where is_pending_location;


-- A diferencia de la cuenta de apertura, esta SÍ es is_active = true:
-- tiene que poder ser el origen o el destino de una transferencia, y
-- crear_movimiento() rechaza las cuentas inactivas.
--
-- type = 'other' a propósito, no un tipo excluido: así entra en
-- cuentas_disponible y el total del disponible sigue cuadrando mientras
-- el dinero está sin ubicar. Si se excluyera, el total mentiría por el
-- importe de la liquidación hasta que alguien la resolviera.
create or replace function public.ensure_pending_account(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id      uuid;
  v_base    text := 'Pendiente de ubicar';
  v_nombre  text;
  v_intento int := 1;
begin
  select a.id into v_id
  from public.accounts a
  where a.owner_id = p_owner and a.is_pending_location
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  -- uq_account_name_per_owner es un índice único sobre (owner_id,
  -- lower(name)) WHERE is_active. Como esta cuenta sí nace activa (tiene
  -- que poder ser destino de una transferencia), el índice la alcanza: si
  -- la persona ya tenía una cuenta suya llamada "Pendiente de ubicar",
  -- el insert reventaría y se llevaría por delante la liquidación
  -- entera, con un error de índice que no dice nada.
  --
  -- Mismo desempate que usa crear_prestamo con "Por cobrar: X".
  -- ensure_opening_account no necesita esto porque crea su cuenta con
  -- is_active = false, y el índice es parcial.
  v_nombre := v_base;
  while exists (
    select 1 from public.accounts
    where owner_id = p_owner and lower(name) = lower(v_nombre) and is_active
  ) loop
    v_intento := v_intento + 1;
    v_nombre  := v_base || ' (' || v_intento || ')';
  end loop;

  insert into public.accounts
    (owner_id, name, class, type, is_system, is_pending_location,
     is_active, sort_order)
  values
    (p_owner, v_nombre, 'asset', 'other',
     true, true, true, 901)
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================
-- 2. LIQUIDAR — igual que en 0010 salvo la contrapartida del espejo
-- =====================================================================

create or replace function public.liquidar_con_pareja(
  p_monto  bigint,
  p_cuenta uuid,             -- mi cuenta (de donde sale o a donde entra)
  p_yo_pago boolean,         -- true: yo pago | false: me pagan
  p_fecha  date default null,
  p_nota   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_couple   uuid;
  v_otro     uuid;
  v_fecha    date;
  v_cta_own  uuid;
  v_cta_cls  public.account_class;
  v_bal_mio  uuid;
  v_bal_otro uuid;
  v_pend_otro uuid;
  v_nom_mio  text;
  v_nom_otro text;
  v_tx1      uuid;
  v_tx2      uuid;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  v_couple := public.current_couple_id();
  if v_couple is null then
    raise exception 'No tienes una pareja vinculada';
  end if;

  select cm.profile_id into v_otro
  from public.couple_members cm
  where cm.couple_id = v_couple and cm.status = 'active'
    and cm.profile_id <> v_uid
  limit 1;

  if v_otro is null then
    raise exception 'No hay otra persona en la pareja';
  end if;

  select a.owner_id, a.class into v_cta_own, v_cta_cls
  from public.accounts a where a.id = p_cuenta;

  if v_cta_own is distinct from v_uid or v_cta_cls <> 'asset' then
    raise exception 'Selecciona una cuenta de dinero tuya';
  end if;

  v_fecha := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);

  select display_name into v_nom_mio  from public.profiles where id = v_uid;
  select display_name into v_nom_otro from public.profiles where id = v_otro;

  v_bal_mio   := public.ensure_partner_account(v_uid,  v_nom_otro);
  v_bal_otro  := public.ensure_partner_account(v_otro, v_nom_mio);
  v_pend_otro := public.ensure_pending_account(v_otro);

  -- ---- Mi lado -------------------------------------------------------
  insert into public.transactions
    (owner_id, couple_id, type, description, notes,
     occurred_at, created_by, visibility)
  values
    (v_uid, v_couple, 'settlement',
     case when p_yo_pago then 'Pago a ' || v_nom_otro
          else 'Cobro a ' || v_nom_otro end,
     nullif(trim(coalesce(p_nota, '')), ''),
     (v_fecha::timestamp at time zone 'America/Bogota'), v_uid, 'joint')
  returning id into v_tx1;

  if p_yo_pago then
    -- sale dinero de mi cuenta, mi balance sube (debo menos)
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx1, p_cuenta, -p_monto), (v_tx1, v_bal_mio, p_monto);
  else
    -- entra dinero, mi balance baja (me deben menos)
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx1, v_bal_mio, -p_monto), (v_tx1, p_cuenta, p_monto);
  end if;

  -- ---- Su lado -------------------------------------------------------
  -- No sabemos a qué cuenta suya entró o salió el dinero. La
  -- contrapartida va a su cuenta "Pendiente de ubicar", que SÍ es de
  -- clase asset: así su patrimonio no se mueve (correcto: cobrar o
  -- pagar una deuda no cambia lo que tienes) y el cabo suelto queda a
  -- la vista, con saldo, para que lo mueva a la cuenta real con una
  -- transferencia normal.
  --
  -- Antes esto iba contra su cuenta de apertura, que es de clase
  -- 'income' y no cuenta como patrimonio: el dinero se evaporaba del
  -- patrimonio de quien no registró la liquidación.
  insert into public.transactions
    (owner_id, couple_id, type, description, notes,
     occurred_at, created_by, visibility)
  values
    (v_otro, v_couple, 'settlement',
     case when p_yo_pago then 'Cobro a ' || v_nom_mio
          else 'Pago a ' || v_nom_mio end,
     null, (v_fecha::timestamp at time zone 'America/Bogota'), v_uid, 'joint')
  returning id into v_tx2;

  if p_yo_pago then
    -- ella recibe: su balance baja (le deben menos), el dinero entra
    -- a "Pendiente de ubicar" hasta que diga a qué cuenta fue
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx2, v_bal_otro, -p_monto),
           (v_tx2, v_pend_otro, p_monto);
  else
    -- ella paga: su balance sube (debe menos), el dinero sale de
    -- "Pendiente de ubicar", que queda en negativo hasta que diga de
    -- qué cuenta salió
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx2, v_bal_otro, p_monto),
           (v_tx2, v_pend_otro, -p_monto);
  end if;

  insert into public.couple_settlements
    (couple_id, from_profile, to_profile, amount, occurred_on, note,
     from_tx_id, to_tx_id)
  values
    (v_couple,
     case when p_yo_pago then v_uid  else v_otro end,
     case when p_yo_pago then v_otro else v_uid  end,
     p_monto, v_fecha, nullif(trim(coalesce(p_nota, '')), ''),
     v_tx1, v_tx2)
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================
-- 3. BORRAR UN ABONO — el estado del préstamo se deriva
-- =====================================================================

create or replace function public.eliminar_pago_prestamo(p_pago uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_loan      uuid;
  v_tx        uuid;
  v_recv      uuid;
  v_principal bigint;
  v_estado    text;
  v_pagado    bigint;
begin
  select pg.loan_id, pg.transaction_id into v_loan, v_tx
  from loan_payments pg
  join loans l on l.id = pg.loan_id
  where pg.id = p_pago and l.owner_id = (select auth.uid());

  if v_loan is null then
    raise exception 'El abono no existe o no tienes acceso';
  end if;

  delete from loan_payments where id = p_pago;

  -- Borrar la transacción revierte el dinero en el ledger.
  if v_tx is not null then
    delete from transactions where id = v_tx;
  end if;

  select l.principal, l.status, l.receivable_account_id
    into v_principal, v_estado, v_recv
  from loans l where l.id = v_loan;

  -- Un préstamo cancelado sigue cancelado. Quitar un abono no lo revive:
  -- cancelar es una decisión de la persona, no algo que se deduzca de
  -- los pagos.
  if v_estado = 'cancelled' then
    return;
  end if;

  -- El estado se DERIVA de lo abonado, no se alterna. Antes esto ponía
  -- 'active' a secas, así que un préstamo con varios abonos que seguía
  -- cubierto tras borrar uno pasaba a activo igualmente.
  select coalesce(sum(pg.amount), 0) into v_pagado
  from loan_payments pg where pg.loan_id = v_loan;

  if v_pagado >= v_principal then
    update loans    set status    = 'paid'  where id = v_loan;
    update accounts set is_active = false   where id = v_recv;
  else
    update loans    set status    = 'active' where id = v_loan;
    update accounts set is_active = true     where id = v_recv;
  end if;
end;
$$;


-- =====================================================================
-- 4. BORRAR UNA LIQUIDACIÓN
--
-- Simétrico a eliminar_gasto_compartido() de 0010: borra las dos
-- transacciones espejo y la fila de metadatos. Los saldos se recalculan
-- solos, porque se derivan.
--
-- ¿Quién puede borrarla? CUALQUIERA de los dos miembros activos, no
-- solo quien pagó. Un gasto compartido lo borra el pagador porque él es
-- quien sabe si el gasto existió; una liquidación la puede haber
-- registrado cualquiera de los dos (p_yo_pago cubre las dos
-- direcciones), así que restringirla a from_profile dejaría a quien
-- registró "me pagaron" sin poder deshacer su propio error.
--
-- SECURITY DEFINER porque tiene que borrar en el ledger de la otra
-- persona, igual que eliminar_gasto_compartido. La autorización se
-- comprueba a mano y de forma explícita.
-- =====================================================================

create or replace function public.eliminar_liquidacion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx1 uuid;
  v_tx2 uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select s.from_tx_id, s.to_tx_id into v_tx1, v_tx2
  from public.couple_settlements s
  where s.id = p_id
    and s.couple_id = public.current_couple_id()
    and (s.from_profile = v_uid or s.to_profile = v_uid);

  if not found then
    raise exception 'La liquidacion no existe o no es de tu pareja';
  end if;

  delete from public.couple_settlements where id = p_id;
  if v_tx1 is not null then delete from public.transactions where id = v_tx1; end if;
  if v_tx2 is not null then delete from public.transactions where id = v_tx2; end if;
end;
$$;


-- Mismo endurecimiento que 0015 y 0018: nadie anónimo la ejecuta.
revoke all on function public.eliminar_liquidacion(uuid) from public;
grant execute on function public.eliminar_liquidacion(uuid) to authenticated;

revoke all on function public.ensure_pending_account(uuid) from public;
grant execute on function public.ensure_pending_account(uuid) to authenticated;
