-- =====================================================================
-- MIGRACIÓN 0024 — guardar lo interpretado, y juntar las transferencias
--
-- Dos cosas que la 0023 dejó preparadas y ahora se usan:
--
--   1. recibir_ingesta() pasa a aceptar lo que el lector sacó del texto
--      (monto, comercio, dirección), para guardarlo al entrar en vez de
--      reinterpretar el texto en cada pantallazo.
--
--   2. La columna pareja_id empieza a llenarse sola.
--
--
-- POR QUÉ SE INTERPRETA AL ENTRAR Y NO AL MOSTRAR
--
-- El texto crudo se guarda igual y para siempre, así que reinterpretar
-- siempre será posible. Pero guardar el resultado deja ver de un vistazo
-- qué entendió el lector de cada mensaje: si un banco cambia su formato,
-- los mensajes nuevos empiezan a entrar con monto NULL y eso salta a la
-- vista en la bandeja. Interpretando al mostrar, el fallo se vería igual
-- pero no quedaría registrado en ningún sitio.
--
--
-- LA DOBLE NOTIFICACIÓN
--
-- Una transferencia entre cuentas propias dispara DOS avisos:
--
--     Nu:        "Enviaste $45.000 a Juan Pérez desde tu Cuenta Nu."
--     DaviPlata: "Le pasaron $45.000 a su DaviPlata."
--
-- Son un solo movimiento. Confirmar los dos por separado dejaría el
-- patrimonio correcto —sale de un lado, entra al otro— pero inflaría
-- "gastos del mes" e "ingresos del mes" en $45.000 cada uno. Y esa es
-- justo la cifra que se mira para saber si uno se pasó.
--
-- Al entrar un mensaje se busca su posible pareja: mismo dueño, mismo
-- monto, dirección contraria, OTRA app, dentro de una ventana de
-- minutos, todavía pendiente y sin pareja. Si aparece, se enlazan los
-- dos.
--
-- Enlazar NO decide nada: solo marca "estos dos podrían ser lo mismo"
-- para que la pantalla lo pregunte. Adivinarlo sería exactamente el tipo
-- de suposición silenciosa que esta bandeja existe para evitar.
--
-- Por qué exigir que sean apps DISTINTAS: dos gastos legítimos del mismo
-- valor en el mismo banco y en pocos minutos son más probables que una
-- transferencia de un banco a sí mismo, que ni siquiera genera dos
-- notificaciones.
-- =====================================================================


-- La ventana. 15 minutos porque una transferencia interbancaria puede
-- tardar: el aviso de salida llega al instante y el de entrada cuando el
-- otro banco la acredita.
create or replace function public.ventana_pareja_ingesta()
returns interval
language sql
immutable
as $$ select interval '15 minutes' $$;


-- =====================================================================
-- recibir_ingesta() con los campos interpretados
--
-- Cambia la firma, así que hay que soltar la anterior: CREATE OR REPLACE
-- no puede añadir parámetros, y dejar las dos versiones haría ambigua
-- cualquier llamada.
-- =====================================================================

drop function if exists public.recibir_ingesta(text, text, text, timestamptz);

create or replace function public.recibir_ingesta(
  p_token     text,
  p_fuente    text,
  p_texto     text,
  p_recibido  timestamptz default now(),
  -- Lo que el lector consiguió sacar. Todo opcional: una entidad sin
  -- lector, o un texto que no casa, entra igual y se rellena a mano.
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
    (owner_id, fuente, texto, recibido_en, huella, monto, comercio, direccion)
  values
    (v_owner, v_fuente, trim(p_texto), coalesce(p_recibido, now()), v_huella,
     -- Un monto que no sea positivo no es un monto: se guarda como
     -- desconocido antes que como cero.
     case when p_monto > 0 then p_monto else null end,
     nullif(trim(coalesce(p_comercio, '')), ''),
     p_direccion)
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

revoke all on function public.recibir_ingesta(text, text, text, timestamptz, bigint, text, ingest_direccion) from public;
grant execute on function public.recibir_ingesta(text, text, text, timestamptz, bigint, text, ingest_direccion)
  to anon, authenticated;


-- =====================================================================
-- Confirmar una pareja como UNA transferencia
--
-- Crea un solo movimiento de tipo 'transfer' entre las dos cuentas y
-- marca los DOS mensajes como confirmados, apuntando a la misma
-- transacción. Así el historial muestra un traslado, no un gasto y un
-- ingreso que se anulan.
-- =====================================================================

create or replace function public.confirmar_pareja_ingesta(
  p_id             uuid,
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
  v_pareja uuid;
  v_estado ingest_estado;
  v_fecha  timestamptz;
  v_tx     uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select m.pareja_id, m.estado, m.recibido_en
    into v_pareja, v_estado, v_fecha
  from ingest_messages m
  where m.id = p_id and m.owner_id = v_uid;

  if not found then
    raise exception 'Ese mensaje no existe o no es tuyo';
  end if;
  if v_estado <> 'pendiente' then
    raise exception 'Ese mensaje ya fue %', v_estado;
  end if;
  if v_pareja is null then
    raise exception 'Ese mensaje no tiene pareja: confirmalo por separado';
  end if;

  -- Un solo movimiento para los dos avisos.
  v_tx := public.crear_movimiento(
    'transfer', p_monto, p_cuenta_origen, p_cuenta_destino,
    p_descripcion, v_fecha, null, 'private'
  );

  update ingest_messages
     set estado = 'confirmado', transaction_id = v_tx
   where id in (p_id, v_pareja)
     and owner_id = v_uid
     and estado = 'pendiente';

  return v_tx;
end;
$$;

revoke all on function public.confirmar_pareja_ingesta(uuid, bigint, uuid, uuid, text) from public;
grant execute on function public.confirmar_pareja_ingesta(uuid, bigint, uuid, uuid, text) to authenticated;


-- =====================================================================
-- La vista, ahora con la pareja resuelta
--
-- CREATE OR REPLACE no deja reordenar ni cambiar columnas, solo añadir
-- al final. Como cambia la estructura, hay que soltarla. No se pierde
-- nada: una vista es una consulta guardada.
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
  -- Los datos de la pareja, para poder ofrecer "esto es una sola
  -- transferencia" sin una segunda consulta desde la pantalla.
  par.fuente    as pareja_fuente,
  par.texto     as pareja_texto,
  par.direccion as pareja_direccion
from ingest_messages m
left join ingest_messages par
  on par.id = m.pareja_id and par.estado = 'pendiente'
where m.estado = 'pendiente'
order by m.recibido_en desc;
