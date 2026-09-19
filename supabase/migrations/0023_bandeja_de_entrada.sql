-- =====================================================================
-- MIGRACIÓN 0023 — BANDEJA DE ENTRADA
--
-- De dónde sale esto: el celular lee la notificación del banco ("Pagaste
-- $45.000 en ÉXITO") y la manda a la app. Pero un texto de notificación
-- NO puede entrar solo al ledger, por cuatro razones:
--
--   1. No dice de qué cuenta salió. Con dos tarjetas en la misma app, la
--      notificación no las distingue.
--   2. Android reenvía la misma notificación cuando se actualiza. Sin
--      defensa, cada gasto se contaría dos o tres veces.
--   3. Los bancos cambian el texto cuando quieren, y el día que lo
--      cambien las reglas fallarían EN SILENCIO.
--   4. Y la peor: un gasto inventado NO lo detecta
--      check_transaction_balanced. Las dos líneas suman 0 igual. El
--      trigger protege contra crear dinero de la nada, no contra
--      registrar algo que no pasó.
--
-- Por eso esto es una SALA DE ESPERA, no el ledger. Los mensajes caen
-- aquí, la persona los revisa, y solo al confirmar pasan por
-- crear_movimiento() — el mismo RPC de siempre, con su partida doble y
-- su RLS intactos. La regla "toda escritura pasa por RPC" no se toca:
-- ingest_messages no es el ledger, así que escribir aquí no es escribir
-- dinero.
--
-- Contenido:
--   1. ingest_tokens    — la credencial de cada dispositivo
--   2. ingest_messages  — la bandeja
--   3. RLS
--   4. recibir_ingesta()   <- la ÚNICA puerta desde fuera
--   5. confirmar_ingesta() / ignorar_ingesta()
--   6. Vista bandeja_pendiente
-- =====================================================================


-- =====================================================================
-- 1. TOKENS DE DISPOSITIVO
--
-- El celular no tiene sesión de Supabase: manda un POST y ya. Así que
-- necesita una credencial propia, como la de un webhook.
--
-- NO se guarda el token, se guarda su sha256. Si alguien llegara a leer
-- esta tabla no podría usar nada: un hash no se deshace. El token en
-- claro se muestra UNA vez, al crearlo, y quien lo pierda crea otro.
-- Es el mismo trato que hace GitHub con sus tokens.
--
-- sha256() es de Postgres desde la versión 11: no hace falta pgcrypto ni
-- preguntarse en qué esquema lo dejó Supabase.
-- =====================================================================

create table ingest_tokens (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  -- Para reconocerlo en la lista: "Celular de Carlos", "Tablet".
  nombre      text not null check (length(trim(nombre)) between 1 and 60),
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at  timestamptz
);

create index idx_tokens_owner on ingest_tokens (owner_id)
  where revoked_at is null;


-- =====================================================================
-- 2. LA BANDEJA
--
-- `texto` se guarda SIEMPRE y para siempre, aunque el mensaje se
-- confirme o se ignore. Es la red de seguridad: el día que un banco
-- cambie su formato y las reglas empiecen a leer mal, el texto original
-- es lo único que permite darse cuenta y volver a interpretarlo.
--
-- Los campos interpretados (monto, comercio, direccion) son NULOS
-- mientras no haya un lector para esa entidad. Un mensaje sin
-- interpretar sigue siendo útil: se ve el texto crudo y se rellena a
-- mano.
-- =====================================================================

create type ingest_estado as enum (
  'pendiente',    -- esperando que la persona lo mire
  'confirmado',   -- ya generó un movimiento
  'ignorado'      -- no era un movimiento, o no era suyo
);

create type ingest_direccion as enum ('salida', 'entrada');

create table ingest_messages (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles(id) on delete cascade,

  -- De qué app vino: 'nequi', 'nu', 'davivienda', 'daviplata', 'correo'.
  -- Texto libre a propósito: añadir una entidad no debe costar una
  -- migración, solo un lector nuevo en el código.
  fuente       text not null check (length(trim(fuente)) between 1 and 40),
  texto        text not null check (length(texto) between 1 and 4000),
  recibido_en  timestamptz not null,

  -- Lo que el lector consiguió sacar del texto. Todo opcional.
  monto        bigint check (monto is null or monto > 0),
  comercio     text,
  direccion    ingest_direccion,

  -- Lo que la pantalla propone, por lo aprendido en merchant_rules.
  cuenta_id    uuid references accounts(id) on delete set null,
  categoria_id uuid references accounts(id) on delete set null,

  estado       ingest_estado not null default 'pendiente',
  transaction_id uuid references transactions(id) on delete set null,

  /* Una transferencia entre cuentas propias dispara DOS notificaciones
     —"enviaste 100.000" en una app y "recibiste 100.000" en la otra— y
     son un solo movimiento. Confirmar las dos por separado dejaría el
     patrimonio correcto pero inflaría "gastos del mes" e "ingresos del
     mes" en 100.000, que es justo la cifra que se mira.

     Aquí se apunta cuál es su pareja para poder ofrecerlas juntas. La
     detección llega con los lectores; la columna existe desde ya para
     no tener que migrar la tabla después. */
  pareja_id    uuid references ingest_messages(id) on delete set null,

  /* Anti-duplicados. Android reenvía la misma notificación cuando se
     actualiza, así que el mismo gasto puede llegar dos o tres veces.
     La huella se calcula sobre app + texto + el MINUTO de llegada.

     El minuto y no el segundo porque los reenvíos no siempre caen en el
     mismo segundo. A cambio, dos compras idénticas en el mismo minuto
     cuentan como una: es mucho más raro que un reenvío, y esa segunda
     siempre se puede registrar a mano. */
  huella       text not null,

  created_at   timestamptz not null default now()
);

create unique index uq_ingest_huella on ingest_messages (owner_id, huella);
create index idx_ingest_pendientes on ingest_messages (owner_id, recibido_en desc)
  where estado = 'pendiente';


-- =====================================================================
-- 3. RLS
-- Cada quien ve y toca solo lo suyo. Aquí no hay nada compartido con la
-- pareja: una notificación de tu banco es tuya y de nadie más, aunque
-- después el gasto que salga de ella sí se comparta.
-- =====================================================================

alter table ingest_tokens   enable row level security;
alter table ingest_messages enable row level security;

create policy "mis tokens: leer"
  on ingest_tokens for select
  using (owner_id = (select auth.uid()));

create policy "mis tokens: revocar"
  on ingest_tokens for update
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "mis tokens: borrar"
  on ingest_tokens for delete
  using (owner_id = (select auth.uid()));

-- No hay política de INSERT: los tokens solo los crea
-- crear_token_ingesta(), que es SECURITY DEFINER.

create policy "mi bandeja: leer"
  on ingest_messages for select
  using (owner_id = (select auth.uid()));

create policy "mi bandeja: actualizar"
  on ingest_messages for update
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "mi bandeja: borrar"
  on ingest_messages for delete
  using (owner_id = (select auth.uid()));

-- Tampoco hay INSERT: los mensajes solo entran por recibir_ingesta().


-- =====================================================================
-- 4. LA PUERTA
-- =====================================================================

-- Un token de 64 caracteres hexadecimales = 256 bits de azar. Dos UUID
-- v4 pegados, que es aleatoriedad criptográfica del propio Postgres sin
-- depender de pgcrypto.
create or replace function public.crear_token_ingesta(p_nombre text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_token text;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if length(trim(coalesce(p_nombre, ''))) = 0 then
    raise exception 'Ponle un nombre al dispositivo';
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  insert into public.ingest_tokens (owner_id, nombre, token_hash)
  values (
    v_uid,
    trim(p_nombre),
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex')
  );

  -- La ÚNICA vez que el token existe en claro. Después solo queda el
  -- hash, y ni nosotros podemos recuperarlo.
  return v_token;
end;
$$;


create or replace function public.revocar_token_ingesta(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update ingest_tokens
     set revoked_at = now()
   where id = p_id
     and owner_id = (select auth.uid())
     and revoked_at is null;

  if not found then
    raise exception 'El token no existe, no es tuyo o ya estaba revocado';
  end if;
end;
$$;


/*
 * recibir_ingesta() — lo que llama el celular.
 *
 * SECURITY DEFINER y ejecutable por `anon` a propósito: quien llama no
 * tiene sesión de Supabase, solo el token. El token ES la autenticación,
 * igual que el secreto de un webhook.
 *
 * Por qué es seguro aunque `anon` pueda ejecutarla:
 *   - sin un token válido no escribe absolutamente nada;
 *   - con uno válido solo puede insertar en ingest_messages, que no es
 *     el ledger: ni un peso se mueve hasta que la persona confirme;
 *   - el owner_id sale del token, nunca del parámetro, así que un token
 *     no puede escribir en la bandeja de otra persona;
 *   - adivinar un token de 256 bits no es factible.
 *
 * Devuelve el id del mensaje, o NULL si era un duplicado. Que un
 * duplicado no sea un error es deliberado: el celular no debe
 * reintentar ni llenar registros por algo que funcionó como debía.
 */
create or replace function public.recibir_ingesta(
  p_token    text,
  p_fuente   text,
  p_texto    text,
  p_recibido timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner   uuid;
  v_huella  text;
  v_id      uuid;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Token invalido';
  end if;

  select t.owner_id into v_owner
  from public.ingest_tokens t
  where t.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and t.revoked_at is null;

  if v_owner is null then
    raise exception 'Token invalido';
  end if;

  if length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'El mensaje viene vacio';
  end if;

  update public.ingest_tokens
     set last_used_at = now()
   where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  v_huella := encode(sha256(convert_to(
    lower(trim(coalesce(p_fuente, '?'))) || '|' ||
    trim(p_texto) || '|' ||
    to_char(coalesce(p_recibido, now()) at time zone 'America/Bogota',
            'YYYY-MM-DD HH24:MI'),
    'UTF8')), 'hex');

  insert into public.ingest_messages
    (owner_id, fuente, texto, recibido_en, huella)
  values
    (v_owner, lower(trim(coalesce(p_fuente, '?'))), trim(p_texto),
     coalesce(p_recibido, now()), v_huella)
  on conflict (owner_id, huella) do nothing
  returning id into v_id;

  return v_id;   -- NULL = ya lo teniamos
end;
$$;

revoke all on function public.recibir_ingesta(text, text, text, timestamptz) from public;
grant execute on function public.recibir_ingesta(text, text, text, timestamptz)
  to anon, authenticated;

revoke all on function public.crear_token_ingesta(text) from public;
grant execute on function public.crear_token_ingesta(text) to authenticated;

revoke all on function public.revocar_token_ingesta(uuid) from public;
grant execute on function public.revocar_token_ingesta(uuid) to authenticated;


-- =====================================================================
-- 5. CONFIRMAR E IGNORAR
--
-- Confirmar crea el movimiento Y marca el mensaje, en una sola
-- transacción de base de datos. Si fueran dos llamadas separadas y la
-- segunda fallara, quedaría un gasto registrado con el mensaje todavía
-- pendiente — y al confirmarlo otra vez se duplicaría.
--
-- SECURITY INVOKER: se apoya en crear_movimiento(), que ya valida las
-- cuentas, las clases y el RLS. Aquí no se repite ninguna de esas
-- comprobaciones; repetirlas sería tener dos sitios que opinan sobre lo
-- mismo.
-- =====================================================================

create or replace function public.confirmar_ingesta(
  p_id             uuid,
  p_tipo           transaction_type,
  p_monto          bigint,
  p_cuenta_origen  uuid,
  p_cuenta_destino uuid,
  p_descripcion    text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_estado ingest_estado;
  v_fecha  timestamptz;
  v_tx     uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select m.estado, m.recibido_en into v_estado, v_fecha
  from ingest_messages m
  where m.id = p_id and m.owner_id = v_uid;

  if not found then
    raise exception 'Ese mensaje no existe o no es tuyo';
  end if;

  if v_estado <> 'pendiente' then
    raise exception 'Ese mensaje ya fue %', v_estado;
  end if;

  -- El movimiento se fecha cuando LLEGÓ la notificación, no cuando lo
  -- confirmas: si lo revisas por la noche, el gasto sigue siendo del
  -- momento en que ocurrió. Con occurred_on por trigger, un pago de las
  -- 8 PM del 31 no se va al mes siguiente.
  v_tx := public.crear_movimiento(
    p_tipo, p_monto, p_cuenta_origen, p_cuenta_destino,
    p_descripcion, v_fecha, null, 'private'
  );

  update ingest_messages
     set estado = 'confirmado', transaction_id = v_tx
   where id = p_id;

  return v_tx;
end;
$$;


create or replace function public.ignorar_ingesta(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update ingest_messages
     set estado = 'ignorado'
   where id = p_id
     and owner_id = (select auth.uid())
     and estado = 'pendiente';

  if not found then
    raise exception 'Ese mensaje no existe, no es tuyo o ya fue atendido';
  end if;
end;
$$;

revoke all on function public.confirmar_ingesta(uuid, transaction_type, bigint, uuid, uuid, text) from public;
grant execute on function public.confirmar_ingesta(uuid, transaction_type, bigint, uuid, uuid, text) to authenticated;

revoke all on function public.ignorar_ingesta(uuid) from public;
grant execute on function public.ignorar_ingesta(uuid) to authenticated;


-- =====================================================================
-- 6. VISTA
-- Lo pendiente, que es lo único que mira la pantalla a diario.
-- =====================================================================

create view bandeja_pendiente
with (security_invoker = on) as
select
  m.id,
  m.owner_id,
  m.fuente,
  m.texto,
  m.recibido_en,
  m.monto,
  m.comercio,
  m.direccion,
  m.cuenta_id,
  m.categoria_id,
  m.pareja_id
from ingest_messages m
where m.estado = 'pendiente'
order by m.recibido_en desc;
