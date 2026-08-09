-- =====================================================================
-- MIGRACIÓN 0003 — CUENTAS: apertura de saldos
--
-- Problema que resuelve:
--   Toda transacción debe tener >= 2 líneas que sumen 0. Al registrar
--   una cuenta con saldo inicial ($2.430.000 en Nu), ¿cuál es la
--   contrapartida? La respuesta contable es una cuenta de PATRIMONIO
--   INICIAL: representa el dinero que ya tenías antes de usar la app.
--
--   Es una cuenta de sistema, una por usuario, oculta de la interfaz.
--   Es de clase 'income', así que NO cuenta como patrimonio: solo sirve
--   para que las aperturas cuadren a cero.
--
-- Contenido:
--   1. Columna is_opening
--   2. ensure_opening_account()
--   3. Backfill para usuarios existentes
--   4. seed_default_categories actualizado
--   5. RPC crear_cuenta()  <- inserta cuenta + apertura de forma atómica
-- =====================================================================


-- =====================================================================
-- 1. Marcar la cuenta de apertura
-- No añadimos un valor al enum account_type a propósito: ALTER TYPE
-- ADD VALUE tiene restricciones dentro de transacciones y no merece
-- el riesgo. Una columna booleana es más simple y más fácil de filtrar.
-- =====================================================================

alter table accounts
  add column if not exists is_opening boolean not null default false;

-- Como máximo una cuenta de apertura por usuario.
create unique index if not exists uq_opening_account_per_owner
  on accounts (owner_id)
  where is_opening;


-- =====================================================================
-- 2. Obtener (o crear) la cuenta de apertura de un usuario
-- SECURITY DEFINER: la creamos nosotros, no el usuario, y debe existir
-- aunque las políticas de INSERT cambien en el futuro.
-- =====================================================================

create or replace function public.ensure_opening_account(p_owner uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select a.id into v_id
  from public.accounts a
  where a.owner_id = p_owner and a.is_opening
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.accounts
    (owner_id, name, class, type, is_system, is_opening, is_active, sort_order)
  values
    (p_owner, 'Patrimonio inicial', 'income', 'income_category', true, true, false, 999)
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================
-- 3. Usuarios que ya existen: darles su cuenta de apertura
-- =====================================================================

do $$
declare
  v_profile uuid;
begin
  for v_profile in select id from profiles loop
    perform public.ensure_opening_account(v_profile);
  end loop;
end;
$$;


-- =====================================================================
-- 4. Usuarios nuevos: crearla en el alta
-- =====================================================================

create or replace function public.seed_default_categories(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_i    int := 0;
begin
  foreach v_name in array array[
    'Alimentación','Transporte','Vivienda','Servicios','Entretenimiento',
    'Salud','Compras','Educación','Viajes','Suscripciones','Regalos','Otros'
  ] loop
    v_i := v_i + 1;
    insert into public.accounts (owner_id, name, class, type, is_system, sort_order)
    values (p_owner, v_name, 'expense', 'expense_category', true, v_i);
  end loop;

  v_i := 0;
  foreach v_name in array array[
    'Salario','Freelance','Venta','Rendimientos','Otros ingresos'
  ] loop
    v_i := v_i + 1;
    insert into public.accounts (owner_id, name, class, type, is_system, sort_order)
    values (p_owner, v_name, 'income', 'income_category', true, v_i);
  end loop;

  perform public.ensure_opening_account(p_owner);
end;
$$;


-- =====================================================================
-- 5. RPC: crear una cuenta con su saldo inicial
--
-- ¿Por qué una función y no dos INSERT desde la app?
--   a) ATOMICIDAD: si falla la apertura, la cuenta tampoco se crea.
--      Desde el frontend podríamos quedarnos a medias.
--   b) VALIDACIÓN EN SERVIDOR: la clase contable se deduce aquí, no
--      la elige el cliente. Nadie puede enviar una cuenta de gasto
--      disfrazada de activo.
--
-- SECURITY INVOKER (por defecto): se ejecuta con los permisos de quien
-- llama, así que TODAS las políticas RLS siguen aplicándose.
-- =====================================================================

create or replace function public.crear_cuenta(
  p_nombre        text,
  p_tipo          account_type,
  p_institucion   text    default null,
  p_saldo_inicial bigint  default 0,
  p_visibilidad   visibility default 'private'
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_class   account_class;
  v_couple  uuid;
  v_account uuid;
  v_opening uuid;
  v_tx      uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  -- La clase contable la decide el servidor, no el cliente.
  if p_tipo in ('credit_card', 'debt') then
    v_class := 'liability';
  elsif p_tipo in ('checking','savings','cash','investment',
                   'digital_wallet','receivable','partner_receivable','other') then
    v_class := 'asset';
  else
    raise exception 'No puedes crear cuentas de tipo % aqui', p_tipo;
  end if;

  if p_visibilidad = 'joint' then
    v_couple := public.current_couple_id();
    if v_couple is null then
      raise exception 'No tienes una pareja vinculada';
    end if;
  end if;

  insert into accounts
    (owner_id, couple_id, name, institution, class, type, visibility)
  values
    (v_uid, v_couple, trim(p_nombre), nullif(trim(coalesce(p_institucion,'')), ''),
     v_class, p_tipo, p_visibilidad)
  returning id into v_account;

  -- Saldo inicial: transacción de apertura, igual que cualquier otra.
  if coalesce(p_saldo_inicial, 0) <> 0 then
    v_opening := public.ensure_opening_account(v_uid);

    insert into transactions
      (owner_id, couple_id, type, description, created_by, visibility)
    values
      (v_uid, v_couple, 'opening', 'Saldo inicial: ' || trim(p_nombre),
       v_uid, p_visibilidad)
    returning id into v_tx;

    insert into transaction_entries (transaction_id, account_id, amount) values
      (v_tx, v_account,  p_saldo_inicial),
      (v_tx, v_opening, -p_saldo_inicial);
  end if;

  return v_account;
end;
$$;
