-- =====================================================================
-- MIGRACIÓN 0001 — FUNDAMENTOS
-- App de finanzas personales y en pareja
--
-- Contenido:
--   1. Tipos (enums)
--   2. Utilidades (updated_at)
--   3. profiles
--   4. couples / couple_members / couple_invitations
--   5. accounts
--   6. transactions / transaction_entries  <- el ledger
--   7. Trigger de partida doble (suma = 0)
--   8. Vistas de saldos
--   9. Alta automática de usuario + categorías por defecto
--  10. RLS activado (políticas en la Fase 6)
--
-- REGLA DE ORO: toda transacción tiene >= 2 líneas que suman exactamente 0.
-- El dinero se guarda como BIGINT en la unidad mínima de la moneda.
-- Para COP la unidad mínima es el peso: 20000 = $20.000
-- =====================================================================


-- =====================================================================
-- 1. TIPOS
-- =====================================================================

-- Naturaleza contable de una cuenta. Determina si suma al patrimonio.
--   asset     -> Nu, Davivienda, efectivo, por cobrar   (SUMA al patrimonio)
--   liability -> tarjetas de crédito, deudas            (RESTA del patrimonio)
--   expense   -> Alimentación, Transporte...            (NO es patrimonio, es flujo)
--   income    -> Salario, Freelance...                  (NO es patrimonio, es flujo)
create type account_class as enum ('asset', 'liability', 'expense', 'income');

-- Subtipo, solo para agrupar y mostrar en la interfaz.
create type account_type as enum (
  'checking',            -- cuenta corriente
  'savings',             -- cuenta de ahorros
  'cash',                -- efectivo
  'investment',          -- inversiones
  'digital_wallet',      -- Nu, Nequi, Daviplata
  'receivable',          -- dinero que me deben (préstamos a terceros)
  'partner_receivable',  -- dinero que me debe mi pareja
  'credit_card',         -- tarjeta de crédito
  'debt',                -- otras deudas
  'expense_category',    -- categoría de gasto
  'income_category',     -- categoría de ingreso
  'other'
);

-- Visibilidad de un recurso frente a la pareja.
--   private     -> solo el dueño
--   shared_view -> el dueño sigue siendo dueño, la pareja puede VER
--   joint       -> pertenece al espacio conjunto de la pareja
create type visibility as enum ('private', 'shared_view', 'joint');

create type transaction_type as enum (
  'opening',       -- saldo inicial de una cuenta
  'expense',       -- gasto
  'income',        -- ingreso
  'transfer',      -- movimiento entre cuentas propias
  'adjustment',    -- corrección de saldo
  'loan_out',      -- prestar dinero
  'loan_repay',    -- me devuelven dinero
  'settlement'     -- liquidación de saldo con la pareja
);

create type membership_status as enum ('active', 'left');
create type invitation_status as enum ('pending', 'accepted', 'rejected', 'expired');


-- =====================================================================
-- 2. UTILIDADES
-- =====================================================================

-- Mantiene updated_at al día automáticamente.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- =====================================================================
-- 3. PROFILES
-- Extiende auth.users (gestionada por Supabase, no la tocamos nunca).
-- Las contraseñas viven allí, cifradas. Nosotros nunca las vemos.
-- =====================================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  avatar_url   text,
  timezone     text not null default 'America/Bogota',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();


-- =====================================================================
-- 4. PAREJA
-- =====================================================================

create table couples (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_couples_updated_at
  before update on couples
  for each row execute function set_updated_at();

create table couple_members (
  couple_id  uuid not null references couples(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status     membership_status not null default 'active',
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  primary key (couple_id, profile_id),
  -- coherencia: si sigue activo no puede tener fecha de salida
  constraint chk_member_left check (
    (status = 'active' and left_at is null) or
    (status = 'left'   and left_at is not null)
  )
);

-- Una persona solo puede estar en UNA pareja activa a la vez.
create unique index uq_one_active_couple
  on couple_members (profile_id)
  where status = 'active';

create table couple_invitations (
  id           uuid primary key default gen_random_uuid(),
  couple_id    uuid not null references couples(id) on delete cascade,
  inviter_id   uuid not null references profiles(id) on delete cascade,
  invitee_email text not null check (position('@' in invitee_email) > 1),
  token        uuid not null default gen_random_uuid(),
  status       invitation_status not null default 'pending',
  expires_at   timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);

-- Guardamos el email en minúsculas para comparar sin sorpresas.
create unique index uq_invitation_pending
  on couple_invitations (couple_id, lower(invitee_email))
  where status = 'pending';

create index idx_invitations_token on couple_invitations (token);


-- =====================================================================
-- 5. ACCOUNTS
-- Incluye cuentas reales Y categorías. Ver decisión de arquitectura:
-- una categoría es una "cuenta de flujo" contra la que se registra el gasto.
-- =====================================================================

create table accounts (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  couple_id    uuid references couples(id) on delete restrict,
  name         text not null check (length(trim(name)) between 1 and 60),
  institution  text,
  class        account_class not null,
  type         account_type  not null,
  currency     char(3) not null default 'COP',
  visibility   visibility not null default 'private',
  is_active    boolean not null default true,
  is_system    boolean not null default false,  -- categorías por defecto: no se borran
  icon         text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Solo las cuentas conjuntas pertenecen a una pareja.
  constraint chk_joint_couple check (
    (visibility = 'joint' and couple_id is not null) or
    (visibility <> 'joint' and couple_id is null)
  ),

  -- El subtipo debe ser coherente con la naturaleza contable.
  constraint chk_class_type check (
    (class = 'expense'   and type = 'expense_category') or
    (class = 'income'    and type = 'income_category')  or
    (class = 'liability' and type in ('credit_card','debt','other')) or
    (class = 'asset'     and type in ('checking','savings','cash','investment',
                                      'digital_wallet','receivable',
                                      'partner_receivable','other'))
  )
);

-- Sin nombres duplicados por usuario (ignorando mayúsculas).
create unique index uq_account_name_per_owner
  on accounts (owner_id, lower(name))
  where is_active;

create index idx_accounts_owner   on accounts (owner_id) where is_active;
create index idx_accounts_couple  on accounts (couple_id) where couple_id is not null;

create trigger trg_accounts_updated_at
  before update on accounts
  for each row execute function set_updated_at();


-- =====================================================================
-- 6. EL LEDGER
-- =====================================================================

create table transactions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,
  couple_id    uuid references couples(id) on delete restrict,
  type         transaction_type not null,
  description  text not null check (length(trim(description)) between 1 and 200),
  notes        text,

  -- occurred_at: el instante exacto, en UTC (para ordenar y mostrar la hora)
  occurred_at  timestamptz not null default now(),
  -- occurred_on: el DÍA CONTABLE en Bogotá. Todos los informes agrupan por aquí.
  -- Se calcula solo (ver trigger más abajo). Nunca lo escribas a mano.
  occurred_on  date not null,

  visibility   visibility not null default 'private',
  created_by   uuid not null references profiles(id) on delete restrict,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- ¿Por qué un trigger y no una columna generada?
-- Convertir UTC -> America/Bogota depende de la base de datos de zonas
-- horarias, que puede actualizarse. Postgres considera esa función STABLE,
-- no IMMUTABLE, y por eso prohíbe usarla en columnas generadas.
-- El trigger consigue el mismo resultado: occurred_on SIEMPRE deriva de
-- occurred_at y es imposible que se desincronicen.
-- ---------------------------------------------------------------------
create or replace function set_occurred_on()
returns trigger
language plpgsql
as $$
begin
  new.occurred_on := (new.occurred_at at time zone 'America/Bogota')::date;
  return new;
end;
$$;

create trigger trg_transactions_occurred_on
  before insert or update of occurred_at on transactions
  for each row execute function set_occurred_on();

create trigger trg_transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();

create index idx_tx_owner_date  on transactions (owner_id, occurred_on desc);
create index idx_tx_couple_date on transactions (couple_id, occurred_on desc)
  where couple_id is not null;


-- Las líneas del movimiento. Aquí vive el dinero.
create table transaction_entries (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  account_id     uuid not null references accounts(id) on delete restrict,

  -- BIGINT, unidad mínima de la moneda. Nunca float, nunca decimal.
  -- Negativo = sale dinero de esa cuenta. Positivo = entra.
  amount         bigint not null check (amount <> 0),

  created_at     timestamptz not null default now()
);

create index idx_entries_tx      on transaction_entries (transaction_id);
create index idx_entries_account on transaction_entries (account_id);

-- Nota sobre ON DELETE:
--   entries -> transactions : CASCADE  (borrar el movimiento borra sus líneas)
--   entries -> accounts     : RESTRICT (no puedes borrar una cuenta con historial;
--                                       se desactiva con is_active = false)


-- =====================================================================
-- 7. LA LEY FÍSICA: partida doble
-- =====================================================================

create or replace function check_transaction_balanced()
returns trigger
language plpgsql
as $$
declare
  v_tx_id      uuid;
  v_sum        bigint;
  v_count      int;
  v_currencies int;
begin
  v_tx_id := coalesce(new.transaction_id, old.transaction_id);

  -- Si la transacción entera fue borrada, no hay nada que validar.
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

-- DEFERRABLE INITIALLY DEFERRED es imprescindible:
-- la comprobación se ejecuta al CERRAR la transacción de base de datos,
-- no tras cada línea. Sin esto, insertar la primera línea siempre fallaría
-- (una sola línea nunca suma 0).
create constraint trigger trg_entries_balanced
  after insert or update or delete on transaction_entries
  deferrable initially deferred
  for each row execute function check_transaction_balanced();


-- =====================================================================
-- 8. VISTAS DE SALDOS
-- Los saldos NO se guardan. Se calculan. Una sola fuente de verdad.
-- security_invoker = on -> la vista respeta el RLS de quien consulta.
-- =====================================================================

create view account_balances
with (security_invoker = on) as
select
  a.id            as account_id,
  a.owner_id,
  a.couple_id,
  a.name,
  a.class,
  a.type,
  a.currency,
  a.visibility,
  a.is_active,
  coalesce(sum(e.amount), 0)::bigint as balance
from accounts a
left join transaction_entries e on e.account_id = a.id
group by a.id;


create view net_worth
with (security_invoker = on) as
select
  a.owner_id,
  a.currency,
  -- Solo asset y liability forman patrimonio. expense/income son flujo.
  coalesce(sum(e.amount) filter (where a.class = 'asset'), 0)::bigint     as assets,
  coalesce(sum(e.amount) filter (where a.class = 'liability'), 0)::bigint as liabilities,
  coalesce(sum(e.amount) filter (where a.class in ('asset','liability')), 0)::bigint
                                                                          as net_worth
from accounts a
left join transaction_entries e on e.account_id = a.id
group by a.owner_id, a.currency;


-- =====================================================================
-- 9. ALTA DE USUARIO + CATEGORÍAS POR DEFECTO
-- =====================================================================

create or replace function seed_default_categories(p_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
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
    insert into accounts (owner_id, name, class, type, is_system, sort_order)
    values (p_owner, v_name, 'expense', 'expense_category', true, v_i);
  end loop;

  v_i := 0;
  foreach v_name in array array[
    'Salario','Freelance','Venta','Rendimientos','Otros ingresos'
  ] loop
    v_i := v_i + 1;
    insert into accounts (owner_id, name, class, type, is_system, sort_order)
    values (p_owner, v_name, 'income', 'income_category', true, v_i);
  end loop;
end;
$$;


-- Cuando Supabase Auth crea un usuario, creamos su perfil y sus categorías.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    )
  );

  perform public.seed_default_categories(new.id);
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();


-- =====================================================================
-- 10. RLS
-- Se activa AHORA. Sin políticas, el comportamiento es "denegar todo":
-- la API pública no devuelve ni una fila. Es el estado seguro por defecto.
-- Las políticas llegan en la migración 0002 (Fase 6).
-- El SQL Editor de Supabase ignora el RLS, así que podremos probar aquí.
-- =====================================================================

alter table profiles            enable row level security;
alter table couples             enable row level security;
alter table couple_members      enable row level security;
alter table couple_invitations  enable row level security;
alter table accounts            enable row level security;
alter table transactions        enable row level security;
alter table transaction_entries enable row level security;
