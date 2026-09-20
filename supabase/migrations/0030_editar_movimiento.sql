-- =====================================================================
-- MIGRACIÓN 0030 — EDITAR UN MOVIMIENTO
--
-- PROBLEMA: no se podía. Solo borrar y volver a crear. Si confirmabas
-- algo de la bandeja con la categoría equivocada, o el lector leía mal
-- el monto, había que borrarlo y escribirlo entero otra vez.
--
-- Y eso empeoró con la bandeja que propone sola: ahora se confirma de
-- un toque, así que se acierta más rápido y también se falla más
-- rápido. Una app donde corregir cuesta más que equivocarse acaba
-- llena de datos que nadie arregla.
--
-- POR QUÉ NO ES "BORRAR Y CREAR" POR DENTRO. Cambiaría el id de la
-- transacción, y hay cuatro tablas que apuntan a él: ingest_messages
-- —para saber qué mensaje de la bandeja generó qué movimiento—,
-- loan_payments, shared_expenses y couple_settlements. Todas con
-- ON DELETE SET NULL, así que el enlace se perdería en silencio y
-- nadie se enteraría hasta meses después. Se actualiza en su sitio.
--
-- LA VALIDACIÓN NO SE DUPLICA. Son sesenta líneas de reglas contables
-- —qué clase de cuenta puede ser origen de un gasto, que las monedas
-- coincidan, que origen y destino no sean la misma— y copiarlas sería
-- pedir que las dos copias se separen. Salen de crear_movimiento a su
-- propia función, y las dos la llaman.
--
-- QUÉ NO SE PUEDE EDITAR, y por qué:
--
--   opening      una apertura se corrige con un ajuste de saldo, que es
--                lo que deja rastro de la corrección
--   adjustment   un ajuste ya ES una corrección; editarlo sería
--                reescribir la historia en vez de añadirle una línea
--   las que son parte de otra cosa  un gasto compartido, un abono a un
--                préstamo o una liquidación tienen DOS transacciones
--                espejo o una fila que las explica. Editar solo una
--                dejaría los dos ledgers en desacuerdo, que es
--                exactamente el bug que arregló la 0021. Se borran y se
--                rehacen desde su propia pantalla.
--
-- Contenido:
--   1. validar_movimiento()
--   2. crear_movimiento() reescrita para usarla
--   3. editar_movimiento()
-- =====================================================================


-- =====================================================================
-- 1. LAS REGLAS, EN UN SOLO SITIO
--
-- Lanza excepción si algo no cuadra. No devuelve nada: el que llama no
-- tiene que mirar un resultado, si vuelve es que está bien.
-- =====================================================================

create or replace function public.validar_movimiento(
  p_tipo           transaction_type,
  p_monto          bigint,
  p_cuenta_origen  uuid,
  p_cuenta_destino uuid,
  p_descripcion    text
)
returns void
language plpgsql
stable
set search_path = public
as $$
declare
  o_class   account_class;  o_currency char(3);  o_active boolean;
  d_class   account_class;  d_currency char(3);  d_active boolean;
begin
  if p_tipo not in ('expense', 'income', 'transfer') then
    raise exception 'Tipo % no se registra con esta funcion', p_tipo;
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  if p_cuenta_origen is null or p_cuenta_destino is null then
    raise exception 'Faltan cuentas: todo movimiento tiene origen y destino';
  end if;

  if p_cuenta_origen = p_cuenta_destino then
    raise exception 'El origen y el destino no pueden ser la misma cuenta';
  end if;

  if length(trim(coalesce(p_descripcion, ''))) = 0 then
    raise exception 'Escribe una descripcion';
  end if;

  -- Si el RLS no deja ver una cuenta, no existe para este usuario y la
  -- consulta devuelve NULL.
  select a.class, a.currency, a.is_active
    into o_class, o_currency, o_active
  from accounts a where a.id = p_cuenta_origen;

  select a.class, a.currency, a.is_active
    into d_class, d_currency, d_active
  from accounts a where a.id = p_cuenta_destino;

  if o_class is null or d_class is null then
    raise exception 'Alguna de las cuentas no existe o no tienes acceso';
  end if;

  if not o_active or not d_active then
    raise exception 'No puedes usar una cuenta inactiva';
  end if;

  if o_currency <> d_currency then
    raise exception 'No puedes mezclar monedas en un mismo movimiento';
  end if;

  /* Coherencia contable: cada tipo exige clases concretas. Esto es lo
     que impide, por ejemplo, "transferir" a una categoría de gasto y
     falsear el patrimonio. */
  if p_tipo = 'expense' then
    if o_class not in ('asset', 'liability') then
      raise exception 'Un gasto debe salir de una cuenta de dinero';
    end if;
    if d_class <> 'expense' then
      raise exception 'Un gasto debe ir contra una categoria de gasto';
    end if;

  elsif p_tipo = 'income' then
    if o_class <> 'income' then
      raise exception 'Un ingreso debe venir de una categoria de ingreso';
    end if;
    if d_class not in ('asset', 'liability') then
      raise exception 'Un ingreso debe entrar a una cuenta de dinero';
    end if;

  elsif p_tipo = 'transfer' then
    if o_class not in ('asset', 'liability')
       or d_class not in ('asset', 'liability') then
      raise exception 'Una transferencia solo mueve dinero entre cuentas reales';
    end if;
  end if;
end;
$$;


-- =====================================================================
-- 2. CREAR, AHORA SIN LAS REGLAS DENTRO
--
-- Mismo comportamiento exacto que la de 0004: lo único que cambia es de
-- dónde salen las comprobaciones.
-- =====================================================================

create or replace function public.crear_movimiento(
  p_tipo           transaction_type,
  p_monto          bigint,
  p_cuenta_origen  uuid,
  p_cuenta_destino uuid,
  p_descripcion    text,
  p_ocurrido_en    timestamptz default now(),
  p_notas          text default null,
  p_visibilidad    visibility default 'private'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_couple uuid;
  v_tx     uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  perform public.validar_movimiento(
    p_tipo, p_monto, p_cuenta_origen, p_cuenta_destino, p_descripcion);

  if p_visibilidad = 'joint' then
    v_couple := public.current_couple_id();
    if v_couple is null then
      raise exception 'No tienes una pareja vinculada';
    end if;
  end if;

  insert into transactions
    (owner_id, couple_id, type, description, notes,
     occurred_at, created_by, visibility)
  values
    (v_uid, v_couple, p_tipo, trim(p_descripcion),
     nullif(trim(coalesce(p_notas, '')), ''),
     coalesce(p_ocurrido_en, now()), v_uid, p_visibilidad)
  returning id into v_tx;

  -- Siempre las mismas dos líneas. La diferencia entre gasto, ingreso y
  -- transferencia está solo en QUÉ cuentas participan.
  insert into transaction_entries (transaction_id, account_id, amount)
  values
    (v_tx, p_cuenta_origen,  -p_monto),
    (v_tx, p_cuenta_destino,  p_monto);

  return v_tx;
end;
$$;


-- =====================================================================
-- 3. EDITAR
--
-- Se actualizan la cabecera y las dos líneas, conservando el id.
--
-- EL TRIGGER DE CUADRE ES DEFERRED (ver 0001), así que dentro de una
-- misma transacción se pueden borrar las líneas y volver a insertarlas:
-- la comprobación de "suma cero" corre al final, no entre medias. Sin
-- eso, el DELETE dejaría el movimiento descuadrado un instante y el
-- trigger lo rechazaría.
-- =====================================================================

create or replace function public.editar_movimiento(
  p_tx             uuid,
  p_tipo           transaction_type,
  p_monto          bigint,
  p_cuenta_origen  uuid,
  p_cuenta_destino uuid,
  p_descripcion    text,
  p_ocurrido_en    timestamptz,
  p_notas          text default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_tipo transaction_type;
  v_dueno uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select t.type, t.owner_id into v_tipo, v_dueno
  from transactions t where t.id = p_tx;

  if v_tipo is null then
    raise exception 'El movimiento no existe o no tienes acceso';
  end if;

  /* Solo el dueño. El RLS ya lo impediría al escribir, pero fallar aquí
     con una frase clara es mejor que fallar abajo con una de Postgres. */
  if v_dueno <> v_uid then
    raise exception 'Ese movimiento no es tuyo';
  end if;

  if v_tipo = 'opening' then
    raise exception
      'Una apertura no se edita. Usa un ajuste de saldo, que deja rastro de la correccion.';
  end if;

  if v_tipo = 'adjustment' then
    raise exception
      'Un ajuste ya es una correccion. Registra otro ajuste en vez de reescribir este.';
  end if;

  /* Los que son parte de otra cosa. Cada uno tiene una transacción
     espejo o una fila que lo explica, y editar solo este lado dejaría
     los dos ledgers en desacuerdo — que es justo el bug que arregló la
     0021. Se borran y se rehacen desde su propia pantalla, que es donde
     se sabe rehacer las dos mitades. */
  if exists (select 1 from loan_payments lp where lp.transaction_id = p_tx) then
    raise exception 'Es un abono a un prestamo. Borralo desde el prestamo.';
  end if;

  if exists (
    select 1 from shared_expenses se
    where se.payer_tx_id = p_tx or se.other_tx_id = p_tx
  ) then
    raise exception 'Es un gasto compartido. Borralo desde Pareja.';
  end if;

  if exists (
    select 1 from couple_settlements cs
    where cs.from_tx_id = p_tx or cs.to_tx_id = p_tx
  ) then
    raise exception 'Es una liquidacion. Borrala desde Pareja.';
  end if;

  perform public.validar_movimiento(
    p_tipo, p_monto, p_cuenta_origen, p_cuenta_destino, p_descripcion);

  /* updated_at no se toca aquí: lo pone trg_transactions_updated_at.
     Y occurred_on tampoco: trg_transactions_occurred_on lo recalcula al
     cambiar occurred_at, que es lo que mantiene el día contable en
     Bogotá cuando se mueve la fecha de un movimiento a las 11 de la
     noche. Escribirlos a mano sería una segunda copia de esa regla. */
  update transactions
     set type        = p_tipo,
         description = trim(p_descripcion),
         notes       = nullif(trim(coalesce(p_notas, '')), ''),
         occurred_at = coalesce(p_ocurrido_en, occurred_at)
   where id = p_tx;

  delete from transaction_entries where transaction_id = p_tx;

  insert into transaction_entries (transaction_id, account_id, amount)
  values
    (p_tx, p_cuenta_origen,  -p_monto),
    (p_tx, p_cuenta_destino,  p_monto);
end;
$$;

revoke all on function public.validar_movimiento(
  transaction_type, bigint, uuid, uuid, text) from public;
grant execute on function public.validar_movimiento(
  transaction_type, bigint, uuid, uuid, text) to authenticated;

revoke all on function public.editar_movimiento(
  uuid, transaction_type, bigint, uuid, uuid, text, timestamptz, text) from public;
grant execute on function public.editar_movimiento(
  uuid, transaction_type, bigint, uuid, uuid, text, timestamptz, text) to authenticated;
