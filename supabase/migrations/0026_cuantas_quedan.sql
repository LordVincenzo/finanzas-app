-- =====================================================================
-- MIGRACIÓN 0026 — CUÁNTAS QUEDAN POR CONFIRMAR, Y UN SOLO CRITERIO
--
-- DOS COSAS, Y LA SEGUNDA ES UN BUG.
--
-- 1. La app de Android quiere mostrar un aviso discreto con «3
--    movimientos por confirmar». Necesita el número, y el número lo
--    sabe el servidor.
--
-- 2. Ese número ya estaba mal en la propia app. Una transferencia entre
--    cuentas propias llega como DOS mensajes, y la bandeja enseña UNA
--    tarjeta: la del lado que salió, porque confirmar esa cierra las
--    dos. Pero contarPendientes() contaba los dos, así que Inicio decía
--    «2 movimientos por confirmar» y al entrar había una sola tarjeta.
--
--    Eso pasó porque el criterio de cuál se esconde vivía en
--    TypeScript, dentro de cargarBandeja(), y el contador es otra
--    consulta que no lo sabía. Es el cuarto bug de este proyecto por
--    tener el mismo cálculo en dos sitios.
--
-- Así que el criterio baja a la vista, como una columna, y todo el
-- mundo lo lee de ahí: la pantalla, el contador de Inicio y el aviso
-- del teléfono.
--
-- POR QUÉ UNA FUNCIÓN APARTE Y NO CAMBIAR recibir_ingesta(). Esa
-- devuelve el uuid del mensaje y la ruta /api/ingesta cuenta con ello:
-- cambiarle el tipo de retorno para colar un segundo dato obliga a
-- tocar las dos cosas a la vez, y en una tubería que queda corriendo
-- sola eso se paga el día que una va por delante de la otra.
--
-- QUÉ SE EXPONE: un número, y solo a quien ya tiene un token válido —
-- el mismo que le permite escribir en esa bandeja. No dice de qué son
-- ni de cuánto.
-- =====================================================================


-- =====================================================================
-- 1. LA VISTA DICE CUÁL SE ESCONDE
--
-- Se esconde la mitad que ENTRÓ, y solo si su pareja es la que SALIÓ.
-- La de salida es la que suele traer el nombre de quien recibe ("a Juan
-- Pérez") y "enviaste" es la acción que hiciste tú.
--
-- Si por lo que sea las dos fueran del mismo sentido, no se esconde
-- ninguna: mejor dos tarjetas de más que un movimiento desaparecido.
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
  par.cuenta_id as pareja_cuenta_id,
  -- El criterio, en un solo sitio.
  (m.pareja_id is not null
     and m.direccion = 'entrada'
     and par.direccion = 'salida') as oculta
from ingest_messages m
left join ingest_messages par
  on par.id = m.pareja_id and par.estado = 'pendiente'
where m.estado = 'pendiente'
order by m.recibido_en desc;


-- =====================================================================
-- 2. EL NÚMERO, PARA EL TELÉFONO
-- =====================================================================

create or replace function public.pendientes_por_token(p_token text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_hash  text;
  v_n     int;
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

  /* La misma cuenta que hace la pantalla. No se consulta la vista
     porque es security_invoker y aquí no hay sesión: esta función
     corre con el token, no con auth.uid(). La condición se repite, y
     por eso está escrita igual y con este aviso al lado — si cambia el
     criterio de la vista, cambia aquí. */
  select count(*) into v_n
  from public.ingest_messages m
  left join public.ingest_messages par
    on par.id = m.pareja_id and par.estado = 'pendiente'
  where m.owner_id = v_owner
    and m.estado = 'pendiente'
    and not (m.pareja_id is not null
             and m.direccion = 'entrada'
             and par.direccion = 'salida');

  return coalesce(v_n, 0);
end;
$$;

revoke all on function public.pendientes_por_token(text) from public;
grant execute on function public.pendientes_por_token(text) to anon, authenticated;
