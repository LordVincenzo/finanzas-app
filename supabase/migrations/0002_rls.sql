-- =====================================================================
-- MIGRACIÓN 0002 — ROW LEVEL SECURITY
--
-- El RLS ya está activado desde 0001. Hasta ahora el comportamiento era
-- "denegar todo". Aquí abrimos los permisos mínimos necesarios.
--
-- PRINCIPIO: privado por defecto. Estar en pareja NO da acceso a nada;
-- el acceso lo concede la visibilidad de cada recurso, uno por uno.
--
-- Reglas de acceso a un recurso:
--   private     -> solo el dueño
--   shared_view -> el dueño + su pareja (solo lectura)
--   joint       -> ambos miembros de la pareja (lectura y escritura)
-- =====================================================================


-- =====================================================================
-- 1. FUNCIONES AUXILIARES
--
-- Son SECURITY DEFINER a propósito: se ejecutan con los permisos de
-- quien las creó, saltándose el RLS. Sin esto habría RECURSIÓN INFINITA:
-- la política de couple_members consultaría couple_members, que
-- dispararía la política otra vez, y así hasta el error.
--
-- SET search_path = '' es obligatorio en funciones SECURITY DEFINER:
-- impide que alguien manipule el search_path para que la función acabe
-- ejecutando tablas suyas en lugar de las nuestras.
-- =====================================================================

-- Pareja activa del usuario actual (NULL si no tiene).
create or replace function public.current_couple_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select cm.couple_id
  from public.couple_members cm
  where cm.profile_id = (select auth.uid())
    and cm.status = 'active'
  limit 1
$$;

-- ¿El usuario indicado es mi pareja activa?
create or replace function public.is_partner_of(p_profile uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.couple_members mine
    join public.couple_members theirs
      on theirs.couple_id = mine.couple_id
    where mine.profile_id  = (select auth.uid())
      and mine.status      = 'active'
      and theirs.profile_id = p_profile
      and theirs.status    = 'active'
      and theirs.profile_id <> mine.profile_id
  )
$$;

-- Correo del usuario actual, tomado del token. Para las invitaciones.
create or replace function public.current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(
    (select auth.jwt() ->> 'email'),
    ''
  ))
$$;


-- =====================================================================
-- 2. PROFILES
-- Veo mi perfil. Y el de mi pareja (solo nombre y avatar; no hay
-- información sensible en esta tabla).
-- No hay política de INSERT: los perfiles los crea handle_new_user,
-- que es SECURITY DEFINER y por tanto no pasa por el RLS.
-- =====================================================================

create policy "perfil propio o de la pareja: leer"
  on profiles for select
  using (
    id = (select auth.uid())
    or public.is_partner_of(id)
  );

create policy "perfil propio: actualizar"
  on profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));


-- =====================================================================
-- 3. PAREJA
-- =====================================================================

create policy "mi pareja: leer"
  on couples for select
  using (id = public.current_couple_id());

create policy "crear pareja propia"
  on couples for insert
  with check (created_by = (select auth.uid()));

create policy "mi pareja: actualizar"
  on couples for update
  using (id = public.current_couple_id())
  with check (id = public.current_couple_id());


create policy "miembros de mi pareja: leer"
  on couple_members for select
  using (
    profile_id = (select auth.uid())
    or couple_id = public.current_couple_id()
  );

-- Solo puedo añadirme a mí mismo (al crear la pareja o al aceptar
-- una invitación). Nadie puede meter a otra persona por la fuerza.
create policy "unirme a una pareja"
  on couple_members for insert
  with check (profile_id = (select auth.uid()));

-- Solo puedo cambiar mi propia membresía (por ejemplo, salirme).
create policy "mi membresia: actualizar"
  on couple_members for update
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));


create policy "invitaciones mias o dirigidas a mi: leer"
  on couple_invitations for select
  using (
    inviter_id = (select auth.uid())
    or lower(invitee_email) = public.current_email()
  );

create policy "crear invitacion para mi pareja"
  on couple_invitations for insert
  with check (
    inviter_id = (select auth.uid())
    and couple_id = public.current_couple_id()
  );

-- El invitado responde; el que invitó puede cancelar.
create policy "responder invitacion"
  on couple_invitations for update
  using (
    lower(invitee_email) = public.current_email()
    or inviter_id = (select auth.uid())
  )
  with check (
    lower(invitee_email) = public.current_email()
    or inviter_id = (select auth.uid())
  );


-- =====================================================================
-- 4. ACCOUNTS
-- El corazón de la privacidad. Aquí están tus cuentas y categorías.
-- =====================================================================

create policy "cuentas visibles para mi"
  on accounts for select
  using (
    -- mías
    owner_id = (select auth.uid())
    -- de mi pareja, marcadas como compartidas para ver
    or (visibility = 'shared_view' and public.is_partner_of(owner_id))
    -- del espacio conjunto
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

create policy "crear cuentas propias"
  on accounts for insert
  with check (
    owner_id = (select auth.uid())
    and (
      visibility <> 'joint'
      or couple_id = public.current_couple_id()
    )
  );

-- Escritura: solo el dueño, o cualquiera de los dos si es conjunta.
-- OJO: shared_view NO permite escribir. Ver es ver, no tocar.
create policy "editar cuentas propias o conjuntas"
  on accounts for update
  using (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  )
  with check (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

-- Las categorías del sistema no se borran (se desactivan con is_active).
create policy "borrar cuentas propias no del sistema"
  on accounts for delete
  using (
    owner_id = (select auth.uid())
    and is_system = false
  );


-- =====================================================================
-- 5. TRANSACTIONS
-- Mismo patrón que accounts.
-- =====================================================================

create policy "movimientos visibles para mi"
  on transactions for select
  using (
    owner_id = (select auth.uid())
    or (visibility = 'shared_view' and public.is_partner_of(owner_id))
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

create policy "crear movimientos propios"
  on transactions for insert
  with check (
    owner_id = (select auth.uid())
    and created_by = (select auth.uid())
    and (
      visibility <> 'joint'
      or couple_id = public.current_couple_id()
    )
  );

create policy "editar movimientos propios o conjuntos"
  on transactions for update
  using (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  )
  with check (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );

create policy "borrar movimientos propios o conjuntos"
  on transactions for delete
  using (
    owner_id = (select auth.uid())
    or (visibility = 'joint' and couple_id = public.current_couple_id())
  );


-- =====================================================================
-- 6. TRANSACTION_ENTRIES
-- Las líneas heredan los permisos de su transacción. No tienen
-- visibilidad propia: si puedes ver el movimiento, ves sus líneas.
--
-- El EXISTS de abajo consulta transactions, que a su vez aplica sus
-- propias políticas. Es decir: los permisos se encadenan solos.
-- =====================================================================

create policy "lineas de movimientos visibles"
  on transaction_entries for select
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_entries.transaction_id
    )
  );

-- Al crear una línea, además de poder ver el movimiento, la cuenta
-- destino tiene que ser una que yo pueda usar. Esto impide que alguien
-- inyecte dinero en una cuenta ajena.
create policy "crear lineas en mis movimientos"
  on transaction_entries for insert
  with check (
    exists (
      select 1 from transactions t
      where t.id = transaction_entries.transaction_id
        and (
          t.owner_id = (select auth.uid())
          or (t.visibility = 'joint' and t.couple_id = public.current_couple_id())
        )
    )
    and exists (
      select 1 from accounts a
      where a.id = transaction_entries.account_id
        and (
          a.owner_id = (select auth.uid())
          or (a.visibility = 'joint' and a.couple_id = public.current_couple_id())
        )
    )
  );

create policy "editar lineas de mis movimientos"
  on transaction_entries for update
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_entries.transaction_id
        and (
          t.owner_id = (select auth.uid())
          or (t.visibility = 'joint' and t.couple_id = public.current_couple_id())
        )
    )
  );

create policy "borrar lineas de mis movimientos"
  on transaction_entries for delete
  using (
    exists (
      select 1 from transactions t
      where t.id = transaction_entries.transaction_id
        and (
          t.owner_id = (select auth.uid())
          or (t.visibility = 'joint' and t.couple_id = public.current_couple_id())
        )
    )
  );
