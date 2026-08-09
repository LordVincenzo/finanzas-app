-- =====================================================================
-- MIGRACIÓN 0005 — SISTEMA DE PAREJA
--
-- Ciclo de vida:
--   1. A invita a B por correo -> se crea la pareja con A dentro
--   2. B ve la invitación y la acepta -> B entra en la pareja
--   3. Cualquiera puede salirse en cualquier momento
--
-- PRINCIPIO CLAVE (ya garantizado por el RLS de la migración 0002):
--   Estar en pareja NO da acceso a nada. El acceso lo concede la
--   visibilidad de cada recurso, uno por uno. Estas funciones solo
--   crean el vínculo; no abren ninguna puerta por sí solas.
--
-- Contenido:
--   1. Columna inviter_name
--   2. invitar_pareja()
--   3. invitaciones_recibidas()
--   4. aceptar_invitacion() / rechazar_invitacion() / cancelar_invitacion()
--   5. salir_pareja()
-- =====================================================================


-- =====================================================================
-- 1. Guardamos el nombre de quien invita
--
-- ¿Por qué duplicar el nombre aquí en vez de leerlo de profiles?
-- Porque el RLS de profiles solo deja ver tu perfil y el de tu pareja.
-- Antes de aceptar, todavía NO son pareja: B no podría ver el nombre
-- de A. Guardar una copia en la invitación evita tener que ampliar
-- los permisos de profiles, que es donde vive la información personal.
-- =====================================================================

alter table couple_invitations
  add column if not exists inviter_name text;


-- =====================================================================
-- 2. INVITAR
-- =====================================================================

create or replace function public.invitar_pareja(p_email text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_email   text := lower(trim(p_email));
  v_couple  uuid;
  v_nombre  text;
  v_miembros int;
  v_inv     uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Escribe un correo valido';
  end if;

  if v_email = public.current_email() then
    raise exception 'No puedes invitarte a ti mismo';
  end if;

  select display_name into v_nombre from profiles where id = v_uid;

  v_couple := public.current_couple_id();

  -- Si aun no tengo pareja, creo el espacio y me meto dentro.
  if v_couple is null then
    insert into couples (created_by) values (v_uid) returning id into v_couple;
    insert into couple_members (couple_id, profile_id) values (v_couple, v_uid);
  else
    -- Ya existe: compruebo que no este completa.
    select count(*) into v_miembros
    from couple_members
    where couple_id = v_couple and status = 'active';

    if v_miembros >= 2 then
      raise exception 'Ya tienes una pareja vinculada';
    end if;
  end if;

  -- Caduca cualquier invitacion pendiente anterior a ese correo,
  -- para que el indice unico no bloquee reenviar.
  update couple_invitations
     set status = 'expired', responded_at = now()
   where couple_id = v_couple
     and lower(invitee_email) = v_email
     and status = 'pending';

  insert into couple_invitations
    (couple_id, inviter_id, invitee_email, inviter_name)
  values
    (v_couple, v_uid, v_email, v_nombre)
  returning id into v_inv;

  return v_inv;
end;
$$;


-- =====================================================================
-- 3. INVITACIONES QUE HE RECIBIDO
-- Devuelve solo las pendientes y no caducadas dirigidas a mi correo.
-- =====================================================================

create or replace function public.invitaciones_recibidas()
returns table (
  id           uuid,
  inviter_name text,
  created_at   timestamptz,
  expires_at   timestamptz
)
language sql
stable
set search_path = public
as $$
  select i.id, i.inviter_name, i.created_at, i.expires_at
  from couple_invitations i
  where lower(i.invitee_email) = public.current_email()
    and i.status = 'pending'
    and i.expires_at > now()
  order by i.created_at desc
$$;


-- =====================================================================
-- 4. RESPONDER
-- =====================================================================

create or replace function public.aceptar_invitacion(p_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_couple   uuid;
  v_expira   timestamptz;
  v_miembros int;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if public.current_couple_id() is not null then
    raise exception 'Ya perteneces a una pareja. Sal de ella antes de aceptar otra.';
  end if;

  select i.couple_id, i.expires_at into v_couple, v_expira
  from couple_invitations i
  where i.id = p_id
    and lower(i.invitee_email) = public.current_email()
    and i.status = 'pending';

  if v_couple is null then
    raise exception 'La invitacion no existe o ya fue respondida';
  end if;

  if v_expira <= now() then
    update couple_invitations set status = 'expired', responded_at = now()
     where id = p_id;
    raise exception 'La invitacion caduco. Pide que te la envien de nuevo.';
  end if;

  select count(*) into v_miembros
  from couple_members
  where couple_id = v_couple and status = 'active';

  if v_miembros >= 2 then
    raise exception 'Ese espacio ya tiene dos personas';
  end if;

  insert into couple_members (couple_id, profile_id)
  values (v_couple, v_uid);

  update couple_invitations
     set status = 'accepted', responded_at = now()
   where id = p_id;

  return v_couple;
end;
$$;


create or replace function public.rechazar_invitacion(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update couple_invitations
     set status = 'rejected', responded_at = now()
   where id = p_id
     and lower(invitee_email) = public.current_email()
     and status = 'pending';

  if not found then
    raise exception 'La invitacion no existe o ya fue respondida';
  end if;
end;
$$;


create or replace function public.cancelar_invitacion(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
begin
  update couple_invitations
     set status = 'expired', responded_at = now()
   where id = p_id
     and inviter_id = (select auth.uid())
     and status = 'pending';

  if not found then
    raise exception 'La invitacion no existe o ya fue respondida';
  end if;
end;
$$;


-- =====================================================================
-- 5. SALIR DE LA PAREJA
--
-- No borramos nada: marcamos la membresia como 'left'. El historial
-- se conserva y las cuentas shared_view dejan de ser visibles
-- automaticamente, porque is_partner_of() ya no devuelve verdadero.
-- =====================================================================

create or replace function public.salir_pareja()
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_couple uuid := public.current_couple_id();
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  if v_couple is null then
    raise exception 'No perteneces a ninguna pareja';
  end if;

  -- Mis cuentas compartidas vuelven a ser privadas.
  update accounts
     set visibility = 'private'
   where owner_id = v_uid and visibility = 'shared_view';

  update transactions
     set visibility = 'private'
   where owner_id = v_uid and visibility = 'shared_view';

  update couple_members
     set status = 'left', left_at = now()
   where couple_id = v_couple and profile_id = v_uid;

  -- Cancelo invitaciones pendientes que yo hubiera enviado.
  update couple_invitations
     set status = 'expired', responded_at = now()
   where couple_id = v_couple
     and inviter_id = v_uid
     and status = 'pending';
end;
$$;
