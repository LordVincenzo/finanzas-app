-- =====================================================================
-- MIGRACIÓN 0009 — PRÉSTAMOS
--
-- IDEA CENTRAL: el dinero prestado vive en el LEDGER, no aquí.
--   Prestar  = transferencia   Nu -> "Por cobrar: Juan"   (Caso C)
--   Cobrar   = transferencia   "Por cobrar: Juan" -> Nu   (Caso D)
--   El patrimonio no cambia en ninguna de las dos.
--
-- Estas tablas solo guardan los METADATOS: a quién, en cuántas cuotas,
-- con qué fechas. El dinero real ya lo maneja transaction_entries.
--
-- SEGUNDA IDEA: una cuota NUNCA guarda "pagada / no pagada".
-- Lo pagado es la SUMA de sus abonos. Así los pagos parciales
-- funcionan solos: si la cuota es de $400.000 y abonan $200.000,
-- queda $200.000 pendiente sin ningún estado que actualizar.
--
-- Contenido:
--   1. loans / loan_installments / loan_payments
--   2. RLS
--   3. crear_prestamo()
--   4. registrar_pago_prestamo()
--   5. eliminar_pago_prestamo() / cancelar_prestamo()
--   6. Vistas: prestamos_resumen, cuotas_detalle
-- =====================================================================


-- =====================================================================
-- 1. TABLAS
-- =====================================================================

create table loans (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id) on delete cascade,
  couple_id     uuid references couples(id) on delete restrict,
  person_name   text not null check (length(trim(person_name)) between 1 and 80),
  principal     bigint not null check (principal > 0),
  currency      char(3) not null default 'COP',
  loan_date     date not null,
  -- La cuenta "Por cobrar: X" que representa esta deuda en el ledger.
  receivable_account_id uuid not null references accounts(id) on delete restrict,
  notes         text,
  status        text not null default 'active'
                check (status in ('active', 'paid', 'cancelled')),
  visibility    visibility not null default 'private',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint chk_loan_joint check (
    (visibility = 'joint' and couple_id is not null) or
    (visibility <> 'joint' and couple_id is null)
  )
);

create index idx_loans_owner on loans (owner_id) where status = 'active';

create trigger trg_loans_updated_at
  before update on loans
  for each row execute function set_updated_at();


create table loan_installments (
  id       uuid primary key default gen_random_uuid(),
  loan_id  uuid not null references loans(id) on delete cascade,
  number   int  not null check (number > 0),
  due_date date not null,
  amount   bigint not null check (amount > 0),
  unique (loan_id, number)
);

create index idx_installments_loan on loan_installments (loan_id);
create index idx_installments_due  on loan_installments (due_date);


create table loan_payments (
  id             uuid primary key default gen_random_uuid(),
  loan_id        uuid not null references loans(id) on delete cascade,
  -- Un abono puede ir contra una cuota concreta o ser un pago suelto.
  installment_id uuid references loan_installments(id) on delete set null,
  amount         bigint not null check (amount > 0),
  -- La transacción del ledger que movió el dinero de verdad.
  transaction_id uuid references transactions(id) on delete set null,
  occurred_on    date not null,
  note           text,
  created_at     timestamptz not null default now()
);

create index idx_payments_loan        on loan_payments (loan_id);
create index idx_payments_installment on loan_payments (installment_id);


-- =====================================================================
-- 2. RLS
-- =====================================================================

alter table loans             enable row level security;
alter table loan_installments enable row level security;
alter table loan_payments     enable row level security;

create policy "prestamos visibles para mi"
  on loans for select
  using (
    owner_id = (select auth.uid())
    or (visibility = 'shared_view' and public.is_partner_of(owner_id))
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

create policy "crear prestamos propios"
  on loans for insert
  with check (owner_id = (select auth.uid()));

create policy "editar prestamos propios"
  on loans for update
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "borrar prestamos propios"
  on loans for delete
  using (owner_id = (select auth.uid()));


-- Cuotas y abonos heredan la visibilidad del préstamo.
create policy "cuotas de prestamos visibles"
  on loan_installments for select
  using (exists (select 1 from loans l where l.id = loan_installments.loan_id));

create policy "crear cuotas en mis prestamos"
  on loan_installments for insert
  with check (exists (
    select 1 from loans l
    where l.id = loan_installments.loan_id and l.owner_id = (select auth.uid())
  ));

create policy "borrar cuotas de mis prestamos"
  on loan_installments for delete
  using (exists (
    select 1 from loans l
    where l.id = loan_installments.loan_id and l.owner_id = (select auth.uid())
  ));


create policy "abonos de prestamos visibles"
  on loan_payments for select
  using (exists (select 1 from loans l where l.id = loan_payments.loan_id));

create policy "crear abonos en mis prestamos"
  on loan_payments for insert
  with check (exists (
    select 1 from loans l
    where l.id = loan_payments.loan_id and l.owner_id = (select auth.uid())
  ));

create policy "borrar abonos de mis prestamos"
  on loan_payments for delete
  using (exists (
    select 1 from loans l
    where l.id = loan_payments.loan_id and l.owner_id = (select auth.uid())
  ));


-- =====================================================================
-- 3. CREAR PRÉSTAMO
--
-- p_cuotas es un array JSON:
--   [{"fecha": "2026-08-15", "monto": 400000}, ...]
-- La suma DEBE ser igual al monto prestado.
-- Si viene vacío, se crea una única cuota por el total.
-- =====================================================================

create or replace function public.crear_prestamo(
  p_persona       text,
  p_monto         bigint,
  p_cuenta_origen uuid,
  p_fecha         date default null,
  p_cuotas        jsonb default '[]'::jsonb,
  p_notas         text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_class     account_class;
  v_owner     uuid;
  v_nombre    text;
  v_base      text;
  v_recv      uuid;
  v_loan      uuid;
  v_tx        uuid;
  v_fecha     date;
  v_suma      bigint := 0;
  v_cuota     jsonb;
  v_i         int := 0;
  v_intento   int := 1;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto prestado debe ser mayor que cero';
  end if;

  if length(trim(coalesce(p_persona, ''))) = 0 then
    raise exception 'Escribe a quien le prestaste';
  end if;

  v_fecha := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);

  -- La cuenta de origen debe ser tuya y de dinero real.
  select a.class, a.owner_id into v_class, v_owner
  from accounts a where a.id = p_cuenta_origen;

  if v_owner is null then
    raise exception 'La cuenta no existe o no tienes acceso';
  end if;
  if v_owner <> v_uid then
    raise exception 'Solo puedes prestar desde tus propias cuentas';
  end if;
  if v_class <> 'asset' then
    raise exception 'Solo puedes prestar desde una cuenta de dinero';
  end if;

  -- ---- Validamos las cuotas antes de tocar nada --------------------
  if jsonb_array_length(p_cuotas) > 0 then
    for v_cuota in select * from jsonb_array_elements(p_cuotas) loop
      v_suma := v_suma + (v_cuota ->> 'monto')::bigint;
      if (v_cuota ->> 'monto')::bigint <= 0 then
        raise exception 'Cada cuota debe ser mayor que cero';
      end if;
    end loop;

    if v_suma <> p_monto then
      raise exception
        'Las cuotas suman % y el prestamo es de %', v_suma, p_monto;
    end if;
  end if;

  -- ---- Cuenta por cobrar -------------------------------------------
  v_base   := 'Por cobrar: ' || trim(p_persona);
  v_nombre := v_base;

  -- Si ya existe una con ese nombre (otro prestamo a la misma persona),
  -- le añadimos un numero.
  while exists (
    select 1 from accounts
    where owner_id = v_uid and lower(name) = lower(v_nombre) and is_active
  ) loop
    v_intento := v_intento + 1;
    v_nombre  := v_base || ' (' || v_intento || ')';
  end loop;

  insert into accounts (owner_id, name, class, type, is_system)
  values (v_uid, v_nombre, 'asset', 'receivable', true)
  returning id into v_recv;

  -- ---- El movimiento real: Nu -> Por cobrar ------------------------
  -- El patrimonio NO cambia: sale de una cuenta de activo y entra
  -- a otra cuenta de activo.
  insert into transactions
    (owner_id, type, description, notes, occurred_at, created_by)
  values
    (v_uid, 'loan_out', 'Prestamo a ' || trim(p_persona),
     nullif(trim(coalesce(p_notas, '')), ''),
     (v_fecha::timestamp at time zone 'America/Bogota'), v_uid)
  returning id into v_tx;

  insert into transaction_entries (transaction_id, account_id, amount) values
    (v_tx, p_cuenta_origen, -p_monto),
    (v_tx, v_recv,           p_monto);

  -- ---- El préstamo y sus cuotas ------------------------------------
  insert into loans
    (owner_id, person_name, principal, loan_date,
     receivable_account_id, notes)
  values
    (v_uid, trim(p_persona), p_monto, v_fecha,
     v_recv, nullif(trim(coalesce(p_notas, '')), ''))
  returning id into v_loan;

  if jsonb_array_length(p_cuotas) = 0 then
    -- Sin cuotas explícitas: una sola por el total.
    insert into loan_installments (loan_id, number, due_date, amount)
    values (v_loan, 1, v_fecha, p_monto);
  else
    for v_cuota in select * from jsonb_array_elements(p_cuotas) loop
      v_i := v_i + 1;
      insert into loan_installments (loan_id, number, due_date, amount)
      values (v_loan, v_i,
              (v_cuota ->> 'fecha')::date,
              (v_cuota ->> 'monto')::bigint);
    end loop;
  end if;

  return v_loan;
end;
$$;


-- =====================================================================
-- 4. REGISTRAR UN ABONO
--
-- Aquí viven los pagos parciales. El abono NO marca la cuota como
-- pagada: solo se suma a lo abonado. Si la cuota era de $400.000 y
-- abonan $200.000, quedan $200.000 pendientes automáticamente.
-- =====================================================================

create or replace function public.registrar_pago_prestamo(
  p_prestamo uuid,
  p_monto    bigint,
  p_cuenta   uuid,               -- cuenta donde ENTRA el dinero
  p_cuota    uuid default null,  -- cuota a la que se aplica (opcional)
  p_fecha    date default null,
  p_nota     text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_owner     uuid;
  v_recv      uuid;
  v_persona   text;
  v_principal bigint;
  v_pagado    bigint;
  v_class     account_class;
  v_cta_owner uuid;
  v_fecha     date;
  v_tx        uuid;
  v_pago      uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El abono debe ser mayor que cero';
  end if;

  select l.owner_id, l.receivable_account_id, l.person_name, l.principal
    into v_owner, v_recv, v_persona, v_principal
  from loans l where l.id = p_prestamo;

  if v_owner is null then
    raise exception 'El prestamo no existe o no tienes acceso';
  end if;
  if v_owner <> v_uid then
    raise exception 'Solo puedes registrar abonos en tus prestamos';
  end if;

  -- No se puede cobrar más de lo prestado.
  select coalesce(sum(pg.amount), 0) into v_pagado
  from loan_payments pg where pg.loan_id = p_prestamo;

  if v_pagado + p_monto > v_principal then
    raise exception
      'El abono supera el saldo pendiente (quedan %)', v_principal - v_pagado;
  end if;

  -- La cuenta destino debe ser tuya y de dinero.
  select a.class, a.owner_id into v_class, v_cta_owner
  from accounts a where a.id = p_cuenta;

  if v_cta_owner is null then
    raise exception 'La cuenta no existe o no tienes acceso';
  end if;
  if v_cta_owner <> v_uid then
    raise exception 'El dinero debe entrar a una cuenta tuya';
  end if;
  if v_class <> 'asset' then
    raise exception 'El dinero debe entrar a una cuenta de dinero';
  end if;

  -- La cuota, si se indicó, debe pertenecer a este préstamo.
  if p_cuota is not null then
    if not exists (
      select 1 from loan_installments i
      where i.id = p_cuota and i.loan_id = p_prestamo
    ) then
      raise exception 'Esa cuota no pertenece a este prestamo';
    end if;
  end if;

  v_fecha := coalesce(p_fecha, (now() at time zone 'America/Bogota')::date);

  -- ---- El movimiento real: Por cobrar -> Nu ------------------------
  -- Otra vez, el patrimonio no cambia: solo se recoloca.
  insert into transactions
    (owner_id, type, description, notes, occurred_at, created_by)
  values
    (v_uid, 'loan_repay', 'Abono de ' || v_persona,
     nullif(trim(coalesce(p_nota, '')), ''),
     (v_fecha::timestamp at time zone 'America/Bogota'), v_uid)
  returning id into v_tx;

  insert into transaction_entries (transaction_id, account_id, amount) values
    (v_tx, v_recv,   -p_monto),
    (v_tx, p_cuenta,  p_monto);

  insert into loan_payments
    (loan_id, installment_id, amount, transaction_id, occurred_on, note)
  values
    (p_prestamo, p_cuota, p_monto, v_tx, v_fecha,
     nullif(trim(coalesce(p_nota, '')), ''))
  returning id into v_pago;

  -- Si ya se cobró todo, el préstamo queda saldado.
  if v_pagado + p_monto >= v_principal then
    update loans set status = 'paid' where id = p_prestamo;
    -- La cuenta por cobrar queda en cero: la desactivamos.
    update accounts set is_active = false where id = v_recv;
  end if;

  return v_pago;
end;
$$;


-- =====================================================================
-- 5. DESHACER
-- =====================================================================

create or replace function public.eliminar_pago_prestamo(p_pago uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_loan uuid;
  v_tx   uuid;
  v_recv uuid;
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

  -- El préstamo vuelve a estar activo.
  select l.receivable_account_id into v_recv from loans l where l.id = v_loan;
  update loans    set status = 'active'  where id = v_loan;
  update accounts set is_active = true   where id = v_recv;
end;
$$;


create or replace function public.cancelar_prestamo(p_prestamo uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update loans set status = 'cancelled'
   where id = p_prestamo and owner_id = (select auth.uid());

  if not found then
    raise exception 'El prestamo no existe o no tienes acceso';
  end if;
end;
$$;


-- =====================================================================
-- 6. VISTAS
-- =====================================================================

-- Estado de cada cuota. Todo derivado: nada de banderas guardadas.
create or replace view cuotas_detalle
with (security_invoker = on) as
select
  i.id,
  i.loan_id,
  i.number,
  i.due_date,
  i.amount,
  coalesce(sum(pg.amount), 0)::bigint as pagado,
  (i.amount - coalesce(sum(pg.amount), 0))::bigint as pendiente,
  case
    when coalesce(sum(pg.amount), 0) >= i.amount then 'pagada'
    when i.due_date < (now() at time zone 'America/Bogota')::date then 'vencida'
    else 'pendiente'
  end as estado
from loan_installments i
left join loan_payments pg on pg.installment_id = i.id
group by i.id;


-- Resumen de cada préstamo.
create or replace view prestamos_resumen
with (security_invoker = on) as
select
  l.id,
  l.owner_id,
  l.person_name,
  l.principal,
  l.loan_date,
  l.status,
  l.visibility,
  l.notes,
  l.receivable_account_id,
  coalesce(pagos.total, 0)::bigint             as pagado,
  (l.principal - coalesce(pagos.total, 0))::bigint as pendiente,
  coalesce(cuotas.total, 0)::int               as cuotas_total,
  coalesce(cuotas.pagadas, 0)::int             as cuotas_pagadas,
  coalesce(cuotas.vencidas, 0)::int            as cuotas_vencidas,
  cuotas.proxima_fecha,
  cuotas.proximo_monto
from loans l
left join lateral (
  select sum(pg.amount) as total
  from loan_payments pg where pg.loan_id = l.id
) pagos on true
left join lateral (
  select
    count(*) as total,
    count(*) filter (where c.estado = 'pagada')  as pagadas,
    count(*) filter (where c.estado = 'vencida') as vencidas,
    min(c.due_date) filter (where c.estado <> 'pagada')      as proxima_fecha,
    (array_agg(c.pendiente order by c.due_date)
      filter (where c.estado <> 'pagada'))[1]                as proximo_monto
  from cuotas_detalle c where c.loan_id = l.id
) cuotas on true;
