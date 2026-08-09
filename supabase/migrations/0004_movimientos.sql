-- =====================================================================
-- MIGRACIÓN 0004 — MOVIMIENTOS
--
-- Un único punto de entrada para registrar dinero. Toda la validación
-- vive aquí, en el servidor, no en el formulario.
--
-- Contenido:
--   1. crear_movimiento()  -> gasto, ingreso, transferencia
--   2. ajustar_saldo()     -> corregir el saldo de una cuenta
--   3. eliminar_movimiento()
--   4. Vista movimientos_detalle (para el historial)
--
-- CONVENCIÓN DE SIGNOS (partida doble clásica):
--   Gasto de $20.000 desde Nu:
--     Nu            -20.000
--     Alimentación  +20.000   <- las cuentas de gasto acumulan POSITIVO
--
--   Ingreso de $3.800.000 a Davivienda:
--     Salario     -3.800.000  <- las cuentas de ingreso acumulan NEGATIVO
--     Davivienda  +3.800.000
--
--   Por eso, al informar:
--     gastos del mes  =  suma de líneas en cuentas 'expense'
--     ingresos del mes = -suma de líneas en cuentas 'income'
-- =====================================================================


-- =====================================================================
-- 1. CREAR MOVIMIENTO
--
-- SECURITY INVOKER (por defecto): se ejecuta con los permisos de quien
-- llama, así que el RLS sigue aplicándose sobre cada tabla.
-- =====================================================================

create or replace function public.crear_movimiento(
  p_tipo           transaction_type,
  p_monto          bigint,
  p_cuenta_origen  uuid,        -- de dónde SALE el dinero
  p_cuenta_destino uuid,        -- a dónde ENTRA
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
  v_uid     uuid := (select auth.uid());
  v_couple  uuid;
  v_tx      uuid;
  o_class   account_class;  o_owner uuid;  o_currency char(3);  o_active boolean;
  d_class   account_class;  d_owner uuid;  d_currency char(3);  d_active boolean;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

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

  -- Leemos ambas cuentas. Si el RLS no deja verlas, no existen para
  -- este usuario y la consulta devuelve NULL.
  select a.class, a.owner_id, a.currency, a.is_active
    into o_class, o_owner, o_currency, o_active
  from accounts a where a.id = p_cuenta_origen;

  select a.class, a.owner_id, a.currency, a.is_active
    into d_class, d_owner, d_currency, d_active
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

  -- Coherencia contable: cada tipo exige clases concretas.
  -- Esto es lo que impide, por ejemplo, "transferir" a una categoria
  -- de gasto y falsear el patrimonio.
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

  -- Siempre las mismas dos lineas. La diferencia entre gasto,
  -- ingreso y transferencia esta solo en QUE cuentas participan.
  insert into transaction_entries (transaction_id, account_id, amount) values
    (v_tx, p_cuenta_origen,  -p_monto),
    (v_tx, p_cuenta_destino,  p_monto);

  return v_tx;
end;
$$;


-- =====================================================================
-- 2. AJUSTAR SALDO
--
-- Recibe el saldo REAL de la cuenta (lo que dice tu banco) y registra
-- la diferencia como un movimiento. No edita nada: deja rastro.
-- =====================================================================

create or replace function public.ajustar_saldo(
  p_cuenta     uuid,
  p_saldo_real bigint,
  p_notas      text default null,
  p_ocurrido_en timestamptz default now()
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_class   account_class;
  v_owner   uuid;
  v_actual  bigint;
  v_dif     bigint;
  v_opening uuid;
  v_tx      uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select a.class, a.owner_id into v_class, v_owner
  from accounts a where a.id = p_cuenta;

  if v_class is null then
    raise exception 'La cuenta no existe o no tienes acceso';
  end if;

  if v_owner <> v_uid then
    raise exception 'Solo puedes ajustar tus propias cuentas';
  end if;

  if v_class not in ('asset', 'liability') then
    raise exception 'Solo se ajustan cuentas de dinero';
  end if;

  select coalesce(sum(e.amount), 0) into v_actual
  from transaction_entries e
  where e.account_id = p_cuenta;

  v_dif := p_saldo_real - v_actual;

  if v_dif = 0 then
    raise exception 'El saldo ya coincide: no hay nada que ajustar';
  end if;

  v_opening := public.ensure_opening_account(v_uid);

  insert into transactions
    (owner_id, type, description, notes, occurred_at, created_by)
  values
    (v_uid, 'adjustment', 'Ajuste de saldo',
     nullif(trim(coalesce(p_notas, '')), ''),
     coalesce(p_ocurrido_en, now()), v_uid)
  returning id into v_tx;

  insert into transaction_entries (transaction_id, account_id, amount) values
    (v_tx, p_cuenta,   v_dif),
    (v_tx, v_opening, -v_dif);

  return v_tx;
end;
$$;


-- =====================================================================
-- 3. ELIMINAR MOVIMIENTO
-- No hace falta recalcular nada: los saldos se derivan de las lineas,
-- y las lineas caen en cascada. El sistema se corrige solo.
-- =====================================================================

create or replace function public.eliminar_movimiento(p_tx uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_tipo transaction_type;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select t.type into v_tipo from transactions t where t.id = p_tx;

  if v_tipo is null then
    raise exception 'El movimiento no existe o no tienes acceso';
  end if;

  if v_tipo = 'opening' then
    raise exception
      'No se puede borrar una apertura. Usa un ajuste de saldo para corregirla.';
  end if;

  delete from transactions where id = p_tx;
end;
$$;


-- =====================================================================
-- 4. VISTA PARA EL HISTORIAL
--
-- Aplana cada movimiento en una fila lista para mostrar: cuenta de
-- donde salio, categoria/cuenta a donde entro, y el monto positivo.
-- security_invoker = on -> respeta el RLS de quien consulta.
-- =====================================================================

create or replace view movimientos_detalle
with (security_invoker = on) as
select
  t.id,
  t.owner_id,
  t.couple_id,
  t.type,
  t.description,
  t.notes,
  t.occurred_at,
  t.occurred_on,
  t.visibility,
  t.created_at,
  -- linea negativa = de donde salio el dinero
  origen.account_id   as cuenta_origen_id,
  ao.name             as cuenta_origen,
  ao.class            as clase_origen,
  -- linea positiva = a donde entro
  destino.account_id  as cuenta_destino_id,
  ad.name             as cuenta_destino,
  ad.class            as clase_destino,
  destino.amount      as monto
from transactions t
join lateral (
  select e.account_id, e.amount
  from transaction_entries e
  where e.transaction_id = t.id and e.amount < 0
  order by e.amount asc limit 1
) origen on true
join lateral (
  select e.account_id, e.amount
  from transaction_entries e
  where e.transaction_id = t.id and e.amount > 0
  order by e.amount desc limit 1
) destino on true
join accounts ao on ao.id = origen.account_id
join accounts ad on ad.id = destino.account_id;
