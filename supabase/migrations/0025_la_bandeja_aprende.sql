-- =====================================================================
-- MIGRACIÓN 0025 — LA BANDEJA APRENDE
--
-- PROBLEMA: confirmar un movimiento de la bandeja sigue pidiendo «sale
-- de…» y «entra en…» cada vez. Con una transferencia al día eso son dos
-- selectores al día, para siempre, y la respuesta es casi siempre la
-- misma. Una bandeja que hay que rellenar entera no ahorra nada frente
-- a abrir el formulario.
--
-- LA PISTA QUE SE ESTABA DESPERDICIANDO: ya sabemos de qué app vino.
-- Una notificación de Nequi es la cuenta Nequi. Siempre. Eso no hay que
-- preguntarlo ni una vez, y menos dos veces al día.
--
-- Así que se aprenden dos cosas al confirmar:
--
--   fuente   -> cuenta      "lo de Nequi sale de mi cuenta Nequi"
--   comercio -> categoría   "ÉXITO es Mercado"
--
-- Y para el caso de la transferencia entre cuentas propias, que es el
-- que más se repite, los DOS lados salen de las dos notificaciones: Nu
-- dice que salió, Nequi dice que entró. Cero selectores.
--
-- POR QUÉ NO HACE FALTA UNA PANTALLA PARA CORREGIR LO APRENDIDO. Las
-- reglas se sobreescriben al confirmar: si un día eliges otra cuenta,
-- esa pasa a ser la regla. Una regla equivocada se arregla usándola
-- bien una vez, que es donde ya estás mirando. Una pantalla de «gestión
-- de reglas» sería un sitio más que mantener para algo que se corrige
-- solo.
--
-- LO QUE SE PROPONE NO SE DECIDE. Todo sigue siendo un valor por
-- defecto en un selector que se puede cambiar antes de confirmar. Nada
-- entra al ledger sin que alguien lo mire: eso es lo que esta bandeja
-- es, y aprender no lo cambia.
--
-- Contenido:
--   1. normalizar_clave()
--   2. ingest_reglas + RLS
--   3. cuenta_para_fuente() / categoria_para_comercio()
--   4. recibir_ingesta() rellena la propuesta
--   5. confirmar_ingesta() aprende
--   6. La vista propone también la cuenta del otro lado
-- =====================================================================


-- =====================================================================
-- 1. NORMALIZAR
--
-- "ÉXITO", "Éxito  " y "exito" son el mismo comercio. Sin normalizar,
-- cada variante sería una regla distinta y no se aprendería nunca.
--
-- Con translate() y no con unaccent: unaccent es una extensión, y una
-- extensión es algo más que tiene que estar instalado en cada entorno
-- para que una función básica no se caiga.
--
-- IMMUTABLE porque no mira ninguna tabla ni la hora: así puede usarse
-- en un índice si algún día hace falta.
-- =====================================================================

create or replace function public.normalizar_clave(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(
      translate(
        lower(trim(coalesce(p_texto, ''))),
        'áéíóúüñàèìòùâêîôûäëïöç',
        'aeiouunaeiouaeiouaeioc'
      ),
      '\s+', ' ', 'g'
    ),
    ''
  );
$$;


-- =====================================================================
-- 2. LO APRENDIDO
--
-- Una fila por clave: la última vez manda. `veces` no se usa para
-- decidir —la última respuesta gana siempre— pero deja ver de un
-- vistazo qué reglas están vivas y cuáles fueron un accidente.
--
-- cuenta_id y categoria_id son los dos nullables: una regla de fuente
-- solo llena la cuenta, una de comercio solo la categoría. Si la cuenta
-- se borra, la regla se queda sin destino (set null) y simplemente deja
-- de proponer, en vez de desaparecer entera.
-- =====================================================================

create type ingest_regla_tipo as enum (
  'fuente',     -- la app que mandó la notificación -> qué cuenta es
  'comercio'    -- a quién se le pagó -> qué categoría es
);

create table ingest_reglas (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references profiles(id) on delete cascade,
  tipo           ingest_regla_tipo not null,
  clave          text not null check (length(clave) between 1 and 200),
  cuenta_id      uuid references accounts(id) on delete set null,
  categoria_id   uuid references accounts(id) on delete set null,
  veces          int  not null default 1,
  actualizada_en timestamptz not null default now(),

  unique (owner_id, tipo, clave),

  -- Una regla que no propone nada no es una regla.
  constraint chk_regla_propone check (
    cuenta_id is not null or categoria_id is not null
  )
);

alter table ingest_reglas enable row level security;

create policy "reglas propias" on ingest_reglas
  for all
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));


-- =====================================================================
-- 3. QUÉ PROPONER
-- =====================================================================

/**
 * La cuenta que corresponde a una fuente ("nequi", "nu"...).
 *
 * Dos intentos, en este orden:
 *
 *   1. Lo aprendido. Es lo que la persona eligió la última vez, así que
 *      manda sobre cualquier deducción.
 *
 *   2. El nombre de la cuenta. La mayoría llama "Nequi" a su cuenta de
 *      Nequi, así que la primera notificación ya puede venir rellena.
 *
 * El segundo intento va por PALABRA COMPLETA, no por subcadena. Con
 * subcadena, la fuente "nu" encajaría dentro de "Manuel" y propondría
 * una cuenta ajena al banco — y una cuenta equivocada propuesta como
 * valor por defecto es de las cosas que se confirman sin mirar. Vale
 * mucho más no proponer nada que proponer mal.
 */
create or replace function public.cuenta_para_fuente(
  p_owner uuid, p_fuente text
)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_clave text := public.normalizar_clave(p_fuente);
  v_id    uuid;
begin
  if p_owner is null or v_clave is null then
    return null;
  end if;

  select r.cuenta_id into v_id
  from public.ingest_reglas r
  where r.owner_id = p_owner
    and r.tipo = 'fuente'
    and r.clave = v_clave
    and r.cuenta_id is not null;

  if v_id is not null then
    return v_id;
  end if;

  select a.id into v_id
  from public.accounts a
  where a.owner_id = p_owner
    and a.is_active
    -- Solo cuentas de verdad: una categoría no es de dónde sale el
    -- dinero.
    and a.class in ('asset', 'liability')
    and public.normalizar_clave(a.name) ~
        ('(^|[^a-z0-9])' || v_clave || '([^a-z0-9]|$)')
  -- Si encajan varias, la de nombre más corto: "Nu" antes que
  -- "Nu - tarjeta vieja".
  order by length(a.name), a.created_at
  limit 1;

  return v_id;
end;
$$;


/**
 * La categoría que corresponde a un comercio ("EXITO", "UBER"...).
 *
 * Aquí no hay deducción por el nombre: nada dice que un comercio
 * llamado "ÉXITO" tenga que ir a una categoría llamada "Éxito". Solo
 * responde cuando se ha aprendido de verdad — la segunda vez que
 * aparece ese comercio.
 */
create or replace function public.categoria_para_comercio(
  p_owner uuid, p_comercio text
)
returns uuid
language sql
stable
set search_path = ''
as $$
  select r.categoria_id
  from public.ingest_reglas r
  where r.owner_id = p_owner
    and r.tipo = 'comercio'
    and r.clave = public.normalizar_clave(p_comercio)
    and r.categoria_id is not null
  limit 1;
$$;


-- =====================================================================
-- 4. RECIBIR: guardar ya la propuesta
--
-- Se rellena al entrar y no al mostrar, porque así queda escrito qué se
-- propuso y cuándo. Si una regla cambia mañana, lo que ya estaba en la
-- bandeja no se mueve bajo los pies de quien lo estaba mirando.
--
-- Se vuelve a declarar entera —no se puede alterar el cuerpo de una
-- función a trozos— y es idéntica a la de 0024 salvo por el bloque de
-- la propuesta.
-- =====================================================================

create or replace function public.recibir_ingesta(
  p_token     text,
  p_fuente    text,
  p_texto     text,
  p_recibido  timestamptz default now(),
  p_monto     bigint default null,
  p_comercio  text default null,
  p_direccion ingest_direccion default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner  uuid;
  v_hash   text;
  v_fuente text;
  v_huella text;
  v_id     uuid;
  v_pareja uuid;
begin
  if p_token is null or length(p_token) < 32 then
    raise exception 'Token invalido';
  end if;

  v_hash := encode(sha256(convert_to(p_token, 'UTF8')), 'hex');

  select t.owner_id into v_owner
  from public.ingest_tokens t
  where t.token_hash = v_hash and t.revoked_at is null;

  if v_owner is null then
    raise exception 'Token invalido';
  end if;

  if length(trim(coalesce(p_texto, ''))) = 0 then
    raise exception 'El mensaje viene vacio';
  end if;

  update public.ingest_tokens set last_used_at = now() where token_hash = v_hash;

  v_fuente := lower(trim(coalesce(p_fuente, '?')));

  v_huella := encode(sha256(convert_to(
    v_fuente || '|' || trim(p_texto) || '|' ||
    to_char(coalesce(p_recibido, now()) at time zone 'America/Bogota',
            'YYYY-MM-DD HH24:MI'),
    'UTF8')), 'hex');

  insert into public.ingest_messages
    (owner_id, fuente, texto, recibido_en, huella, monto, comercio, direccion,
     cuenta_id, categoria_id)
  values
    (v_owner, v_fuente, trim(p_texto), coalesce(p_recibido, now()), v_huella,
     case when p_monto > 0 then p_monto else null end,
     nullif(trim(coalesce(p_comercio, '')), ''),
     p_direccion,
     -- LA PROPUESTA. Que sean nulas es normal y no es un fallo: la
     -- primera vez que aparece un comercio todavía no hay nada que
     -- saber de él.
     public.cuenta_para_fuente(v_owner, v_fuente),
     public.categoria_para_comercio(v_owner, p_comercio))
  on conflict (owner_id, huella) do nothing
  returning id into v_id;

  if v_id is null then
    return null;   -- ya lo teniamos: reenvio de Android
  end if;

  -- ---- ¿Tiene pareja? ----------------------------------------------
  if p_direccion is not null and p_monto > 0 then
    select m.id into v_pareja
    from public.ingest_messages m
    where m.owner_id = v_owner
      and m.id <> v_id
      and m.estado = 'pendiente'
      and m.pareja_id is null
      and m.monto = p_monto
      and m.direccion is not null
      and m.direccion <> p_direccion          -- sentidos contrarios
      and m.fuente <> v_fuente                -- apps distintas
      and abs(extract(epoch from
            (m.recibido_en - coalesce(p_recibido, now()))))
          <= extract(epoch from public.ventana_pareja_ingesta())
    order by abs(extract(epoch from
              (m.recibido_en - coalesce(p_recibido, now()))))
    limit 1;

    if v_pareja is not null then
      update public.ingest_messages set pareja_id = v_pareja where id = v_id;
      update public.ingest_messages set pareja_id = v_id    where id = v_pareja;
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.recibir_ingesta(
  text, text, text, timestamptz, bigint, text, ingest_direccion) from public;
grant execute on function public.recibir_ingesta(
  text, text, text, timestamptz, bigint, text, ingest_direccion) to anon, authenticated;


-- =====================================================================
-- 5. CONFIRMAR: y aprender de ello
--
-- CUÁL DE LAS DOS CUENTAS ES "la del banco" depende de la dirección que
-- leyó el lector, no del tipo de movimiento:
--
--   salida  -> la del banco es el origen
--   entrada -> la del banco es el destino
--
-- Sin dirección no se aprende nada de la fuente. Se podría deducir del
-- tipo (un gasto sale de una cuenta, un ingreso entra a una), pero en
-- una transferencia las dos son cuentas y elegir mal enseñaría que
-- "Nequi" es la cuenta de Nu — un error que luego se propone solo cada
-- día. Mejor no aprender que aprender al revés.
--
-- La categoría se aprende solo si la contraparte es de verdad una
-- categoría (clase expense/income). En una transferencia la contraparte
-- es otra cuenta, y "ÉXITO es mi cuenta de Nu" no tiene sentido.
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
  v_uid       uuid := (select auth.uid());
  v_estado    ingest_estado;
  v_fecha     timestamptz;
  v_fuente    text;
  v_comercio  text;
  v_direccion ingest_direccion;
  v_tx        uuid;
  v_cuenta    uuid;
  v_contra    uuid;
  v_clase     account_class;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select m.estado, m.recibido_en, m.fuente, m.comercio, m.direccion
    into v_estado, v_fecha, v_fuente, v_comercio, v_direccion
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

  -- ---- Aprender -----------------------------------------------------
  -- Va después de crear el movimiento y nunca antes: si crear_movimiento
  -- rechaza algo, no se aprende de un movimiento que no existió.

  if v_direccion = 'salida' then
    v_cuenta := p_cuenta_origen;  v_contra := p_cuenta_destino;
  elsif v_direccion = 'entrada' then
    v_cuenta := p_cuenta_destino; v_contra := p_cuenta_origen;
  else
    v_cuenta := null;             v_contra := null;
  end if;

  if v_cuenta is not null then
    -- Solo si es una cuenta de verdad. Si alguien marcó la categoría
    -- donde iba la cuenta, aprender eso convertiría un descuido en una
    -- propuesta diaria.
    select a.class into v_clase from accounts a
    where a.id = v_cuenta and a.owner_id = v_uid;

    if v_clase in ('asset', 'liability') then
      insert into ingest_reglas (owner_id, tipo, clave, cuenta_id)
      values (v_uid, 'fuente', public.normalizar_clave(v_fuente), v_cuenta)
      on conflict (owner_id, tipo, clave) do update
        set cuenta_id      = excluded.cuenta_id,
            veces          = ingest_reglas.veces + 1,
            actualizada_en = now();
    end if;
  end if;

  if v_contra is not null and public.normalizar_clave(v_comercio) is not null then
    select a.class into v_clase from accounts a
    where a.id = v_contra and a.owner_id = v_uid;

    if v_clase in ('expense', 'income') then
      insert into ingest_reglas (owner_id, tipo, clave, categoria_id)
      values (v_uid, 'comercio', public.normalizar_clave(v_comercio), v_contra)
      on conflict (owner_id, tipo, clave) do update
        set categoria_id   = excluded.categoria_id,
            veces          = ingest_reglas.veces + 1,
            actualizada_en = now();
    end if;
  end if;

  return v_tx;
end;
$$;

revoke all on function public.confirmar_ingesta(
  uuid, transaction_type, bigint, uuid, uuid, text) from public;
grant execute on function public.confirmar_ingesta(
  uuid, transaction_type, bigint, uuid, uuid, text) to authenticated;


-- =====================================================================
-- 6. LA VISTA: también la cuenta del otro lado
--
-- Es lo que cierra el caso más repetido. Una transferencia entre
-- cuentas propias llega como dos avisos: Nu dice "enviaste", Nequi dice
-- "te enviaron". Con la cuenta de cada fuente, los dos lados están
-- resueltos y confirmar es un solo toque.
-- =====================================================================

drop view if exists bandeja_pendiente;

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
  m.pareja_id,
  par.fuente    as pareja_fuente,
  par.texto     as pareja_texto,
  par.direccion as pareja_direccion,
  -- La cuenta del otro aviso. Se resuelve aquí y no al recibir porque
  -- la pareja puede aparecer DESPUÉS de que este mensaje ya estuviera
  -- guardado: la segunda notificación es la que empareja a las dos.
  par.cuenta_id as pareja_cuenta_id
from ingest_messages m
left join ingest_messages par
  on par.id = m.pareja_id and par.estado = 'pendiente'
where m.estado = 'pendiente'
order by m.recibido_en desc;
