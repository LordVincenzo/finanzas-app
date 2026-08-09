-- =====================================================================
-- MIGRACIÓN 0010 — GASTOS COMPARTIDOS Y BALANCE ENTRE PAREJA
--
-- PROBLEMA: si solo el pagador registra el gasto, su ledger queda
-- correcto pero el de la otra persona no se entera de que debe dinero.
-- Sus patrimonios dejarían de ser comparables.
--
-- SOLUCIÓN: un gasto compartido escribe DOS transacciones espejo,
-- una en cada ledger. Cena de $120.000 pagada por Briand, 50/50:
--
--   Ledger de Briand              Ledger de Andrea
--   Nu                -120.000    Alimentación        +60.000
--   Alimentación       +60.000    Balance con Briand  -60.000
--   Balance con Andrea +60.000
--   (suma 0)                      (suma 0)
--
--   Patrimonio de Briand: -60.000   Patrimonio de Andrea: -60.000
--   Briand tiene +60.000 por cobrar; Andrea, -60.000 por pagar.
--
-- La cuenta "Balance con <pareja>" es de tipo partner_receivable:
--   positivo -> te deben        negativo -> debes
--
-- Contenido:
--   1. ensure_partner_account()
--   2. categoria_de()
--   3. shared_expenses / shared_expense_splits
--   4. RLS
--   5. crear_gasto_compartido()
--   6. liquidar_con_pareja()
--   7. eliminar_gasto_compartido()
--   8. Vista gastos_compartidos_detalle
-- =====================================================================


-- =====================================================================
-- 1. Cuenta de balance con la pareja (una por persona)
-- =====================================================================

alter table accounts
  add column if not exists is_partner_balance boolean not null default false;

create unique index if not exists uq_partner_balance_per_owner
  on accounts (owner_id)
  where is_partner_balance;


create or replace function public.ensure_partner_account(
  p_owner  uuid,
  p_nombre text
)
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
  where a.owner_id = p_owner and a.is_partner_balance
  limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into public.accounts
    (owner_id, name, class, type, is_system, is_partner_balance, sort_order)
  values
    (p_owner, 'Balance con ' || p_nombre, 'asset', 'partner_receivable',
     true, true, 900)
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================
-- 2. Encontrar la categoría equivalente en el otro usuario
-- Cada persona tiene sus propias categorías. Buscamos por nombre;
-- si no existe, usamos "Otros".
-- =====================================================================

create or replace function public.categoria_de(p_owner uuid, p_nombre text)
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
  where a.owner_id = p_owner
    and a.class = 'expense'
    and lower(a.name) = lower(trim(p_nombre))
  limit 1;

  if v_id is not null then return v_id; end if;

  select a.id into v_id
  from public.accounts a
  where a.owner_id = p_owner and a.class = 'expense'
    and lower(a.name) = 'otros'
  limit 1;

  if v_id is not null then return v_id; end if;

  -- Ni siquiera tiene "Otros": la creamos.
  insert into public.accounts (owner_id, name, class, type, is_system)
  values (p_owner, 'Otros', 'expense', 'expense_category', true)
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================
-- 3. TABLAS
-- =====================================================================

create table shared_expenses (
  id            uuid primary key default gen_random_uuid(),
  couple_id     uuid not null references couples(id) on delete cascade,
  payer_id      uuid not null references profiles(id) on delete restrict,
  description   text not null check (length(trim(description)) between 1 and 200),
  category_name text,
  total_amount  bigint not null check (total_amount > 0),
  occurred_on   date not null,
  notes         text,
  -- Las dos transacciones espejo que generó este gasto.
  payer_tx_id   uuid references transactions(id) on delete set null,
  other_tx_id   uuid references transactions(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_shared_couple on shared_expenses (couple_id, occurred_on desc);


create table shared_expense_splits (
  id                uuid primary key default gen_random_uuid(),
  shared_expense_id uuid not null references shared_expenses(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete restrict,
  amount            bigint not null check (amount >= 0),
  unique (shared_expense_id, profile_id)
);


create table couple_settlements (
  id             uuid primary key default gen_random_uuid(),
  couple_id      uuid not null references couples(id) on delete cascade,
  from_profile   uuid not null references profiles(id) on delete restrict,
  to_profile     uuid not null references profiles(id) on delete restrict,
  amount         bigint not null check (amount > 0),
  occurred_on    date not null,
  note           text,
  from_tx_id     uuid references transactions(id) on delete set null,
  to_tx_id       uuid references transactions(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_settlements_couple on couple_settlements (couple_id, occurred_on desc);


-- =====================================================================
-- 4. RLS — visible para ambos miembros de la pareja
-- =====================================================================

alter table shared_expenses       enable row level security;
alter table shared_expense_splits enable row level security;
alter table couple_settlements    enable row level security;

create policy "gastos compartidos de mi pareja"
  on shared_expenses for select
  using (couple_id = public.current_couple_id());

create policy "borrar gastos compartidos que pague yo"
  on shared_expenses for delete
  using (couple_id = public.current_couple_id() and payer_id = (select auth.uid()));

create policy "repartos visibles"
  on shared_expense_splits for select
  using (exists (
    select 1 from shared_expenses e where e.id = shared_expense_splits.shared_expense_id
  ));

create policy "liquidaciones de mi pareja"
  on couple_settlements for select
  using (couple_id = public.current_couple_id());


-- =====================================================================
-- 5. CREAR GASTO COMPARTIDO
--
-- SECURITY DEFINER porque tiene que escribir en el ledger de la otra
-- persona. Las validaciones son estrictas:
--   - ambos deben ser miembros ACTIVOS de la misma pareja
--   - el reparto debe sumar exactamente el total
--   - la cuenta de pago debe ser del pagador
-- Solo puede crear las líneas del reparto, nada más.
-- =====================================================================

create or replace function public.crear_gasto_compartido(
  p_total       bigint,
  p_cuenta      uuid,          -- de dónde salió el dinero (del pagador)
  p_categoria   uuid,          -- categoría del pagador
  p_descripcion text,
  p_mi_parte    bigint,        -- cuánto me corresponde a mí
  p_fecha       date default null,
  p_notas       text default null
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
  v_parte2   bigint;
  v_fecha    date;
  v_cat_nom  text;
  v_cta_own  uuid;
  v_cta_cls  public.account_class;
  v_cat_own  uuid;
  v_cat_cls  public.account_class;
  v_bal_mio  uuid;
  v_bal_otro uuid;
  v_cat_otro uuid;
  v_nom_mio  text;
  v_nom_otro text;
  v_tx1      uuid;
  v_tx2      uuid;
  v_gasto    uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_total is null or p_total <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  if p_mi_parte is null or p_mi_parte < 0 or p_mi_parte > p_total then
    raise exception 'Tu parte debe estar entre 0 y el total';
  end if;

  v_parte2 := p_total - p_mi_parte;
  v_fecha  := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);

  -- ---- Pareja activa ------------------------------------------------
  v_couple := public.current_couple_id();
  if v_couple is null then
    raise exception 'No tienes una pareja vinculada';
  end if;

  select cm.profile_id into v_otro
  from public.couple_members cm
  where cm.couple_id = v_couple
    and cm.status = 'active'
    and cm.profile_id <> v_uid
  limit 1;

  if v_otro is null then
    raise exception 'Tu pareja todavia no ha aceptado la invitacion';
  end if;

  -- ---- La cuenta y la categoría deben ser mías -----------------------
  select a.owner_id, a.class into v_cta_own, v_cta_cls
  from public.accounts a where a.id = p_cuenta;

  if v_cta_own is distinct from v_uid then
    raise exception 'La cuenta de pago debe ser tuya';
  end if;
  if v_cta_cls <> 'asset' then
    raise exception 'El gasto debe salir de una cuenta de dinero';
  end if;

  select a.owner_id, a.class, a.name
    into v_cat_own, v_cat_cls, v_cat_nom
  from public.accounts a where a.id = p_categoria;

  if v_cat_own is distinct from v_uid or v_cat_cls <> 'expense' then
    raise exception 'Selecciona una categoria de gasto tuya';
  end if;

  -- ---- Cuentas de balance -------------------------------------------
  select display_name into v_nom_mio  from public.profiles where id = v_uid;
  select display_name into v_nom_otro from public.profiles where id = v_otro;

  v_bal_mio  := public.ensure_partner_account(v_uid,  v_nom_otro);
  v_bal_otro := public.ensure_partner_account(v_otro, v_nom_mio);
  v_cat_otro := public.categoria_de(v_otro, v_cat_nom);

  -- ---- Transacción del pagador --------------------------------------
  insert into public.transactions
    (owner_id, couple_id, type, description, notes,
     occurred_at, created_by, visibility)
  values
    (v_uid, v_couple, 'expense', trim(p_descripcion),
     nullif(trim(coalesce(p_notas, '')), ''),
     (v_fecha::timestamp at time zone 'America/Bogota'), v_uid, 'joint')
  returning id into v_tx1;

  insert into public.transaction_entries (transaction_id, account_id, amount)
  values (v_tx1, p_cuenta, -p_total);

  if p_mi_parte > 0 then
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx1, p_categoria, p_mi_parte);
  end if;

  if v_parte2 > 0 then
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx1, v_bal_mio, v_parte2);
  end if;

  -- ---- Transacción espejo de la otra persona ------------------------
  if v_parte2 > 0 then
    insert into public.transactions
      (owner_id, couple_id, type, description, notes,
       occurred_at, created_by, visibility)
    values
      (v_otro, v_couple, 'expense',
       trim(p_descripcion) || ' (pagó ' || v_nom_mio || ')',
       null, (v_fecha::timestamp at time zone 'America/Bogota'), v_uid, 'joint')
    returning id into v_tx2;

    insert into public.transaction_entries (transaction_id, account_id, amount)
    values
      (v_tx2, v_cat_otro,   v_parte2),
      (v_tx2, v_bal_otro,  -v_parte2);
  end if;

  -- ---- Metadatos ----------------------------------------------------
  insert into public.shared_expenses
    (couple_id, payer_id, description, category_name, total_amount,
     occurred_on, notes, payer_tx_id, other_tx_id)
  values
    (v_couple, v_uid, trim(p_descripcion), v_cat_nom, p_total,
     v_fecha, nullif(trim(coalesce(p_notas, '')), ''), v_tx1, v_tx2)
  returning id into v_gasto;

  insert into public.shared_expense_splits (shared_expense_id, profile_id, amount)
  values (v_gasto, v_uid, p_mi_parte), (v_gasto, v_otro, v_parte2);

  return v_gasto;
end;
$$;


-- =====================================================================
-- 6. LIQUIDAR
--
-- Alguien paga lo que debe. También escribe en los dos ledgers,
-- para que ambos balances vuelvan a cuadrar.
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

  v_bal_mio  := public.ensure_partner_account(v_uid,  v_nom_otro);
  v_bal_otro := public.ensure_partner_account(v_otro, v_nom_mio);

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
  -- No sabemos a qué cuenta suya entró o salió el dinero, así que
  -- movemos solo su balance contra su cuenta de patrimonio inicial.
  -- Ella podrá ajustar el saldo real de su cuenta cuando quiera.
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
    -- ella recibe: su balance baja (le deben menos)
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx2, v_bal_otro, -p_monto),
           (v_tx2, public.ensure_opening_account(v_otro), p_monto);
  else
    insert into public.transaction_entries (transaction_id, account_id, amount)
    values (v_tx2, v_bal_otro, p_monto),
           (v_tx2, public.ensure_opening_account(v_otro), -p_monto);
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
-- 7. DESHACER UN GASTO COMPARTIDO
-- Borra las dos transacciones espejo. Los saldos se recalculan solos.
-- =====================================================================

create or replace function public.eliminar_gasto_compartido(p_id uuid)
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
  select e.payer_tx_id, e.other_tx_id into v_tx1, v_tx2
  from public.shared_expenses e
  where e.id = p_id
    and e.payer_id = v_uid
    and e.couple_id = public.current_couple_id();

  if not found then
    raise exception 'El gasto no existe o no lo pagaste tu';
  end if;

  delete from public.shared_expenses where id = p_id;
  if v_tx1 is not null then delete from public.transactions where id = v_tx1; end if;
  if v_tx2 is not null then delete from public.transactions where id = v_tx2; end if;
end;
$$;


-- =====================================================================
-- 8. VISTA
-- =====================================================================

create or replace view gastos_compartidos_detalle
with (security_invoker = on) as
select
  e.id,
  e.couple_id,
  e.payer_id,
  p.display_name as payer_name,
  e.description,
  e.category_name,
  e.total_amount,
  e.occurred_on,
  e.notes,
  e.created_at
from shared_expenses e
join profiles p on p.id = e.payer_id;
