-- =====================================================================
-- MIGRACIÓN 0018 — eliminar_meta()
--
-- PROBLEMA: archivar_meta() solo marcaba la meta:
--
--     update savings_goals set is_archived = true where id = p_id;
--
-- No tocaba savings_contributions. Y cuentas_disponible suma TODOS los
-- aportes de una cuenta, sin mirar si su meta sigue viva:
--
--     select sum(c.amount) from savings_contributions c
--     where c.account_id = a.id
--
-- Resultado: al archivar, la meta desaparecía de la pantalla (que
-- filtra por is_archived = false) pero sus aportes seguían restando del
-- disponible para siempre. Dinero reservado para una meta que ya no
-- existe, sin ninguna pantalla donde verlo ni forma de recuperarlo.
--
-- Es el mismo patrón que eliminar_movimiento() y aportar_meta(): una
-- operación que deja piezas sueltas apuntando a algo que ya no está.
--
-- SOLUCIÓN: eliminar de verdad. savings_contributions ya tiene
-- ON DELETE CASCADE sobre savings_goals, así que borrar la meta se
-- lleva sus aportes y el dinero se libera solo. No hay que tocar
-- cuentas_disponible ni recalcular nada: los saldos se derivan.
--
-- Por qué eliminar y no arreglar el archivado: una meta archivada
-- quedaba invisible pero existente, porque todas las consultas filtran
-- por is_archived = false. Se comportaba igual que eliminar, pero
-- dejando filas que nadie puede ver ni limpiar. Si algún día hace falta
-- un historial de metas cumplidas, es otra función y otra pantalla.
--
-- OJO CON LAS METAS CONJUNTAS: el cascade se lleva también los aportes
-- de la pareja. No le quita dinero —un aporte solo marca, nunca movió
-- nada— pero libera lo que ella tenía reservado sin avisarle. Solo el
-- dueño puede borrar, así que nadie puede eliminar la meta del otro.
--
-- archivar_meta() tampoco comprobaba el dueño: confiaba en el RLS, y la
-- política de UPDATE de 0008 permite editar metas conjuntas de la
-- pareja. Aquí la comprobación es explícita.
-- =====================================================================

create or replace function public.eliminar_meta(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select g.owner_id into v_owner
  from savings_goals g where g.id = p_id;

  if not found then
    raise exception 'La meta no existe o no tienes acceso';
  end if;

  -- Explícito, no solo por RLS: una meta conjunta es editable por
  -- ambos, pero borrarla es otra cosa.
  if v_owner is distinct from v_uid then
    raise exception 'Solo puedes eliminar metas que hayas creado tu';
  end if;

  -- Los aportes caen en cascada (savings_contributions -> savings_goals)
  -- y con ellos la reserva sobre las cuentas. El dinero nunca se movió:
  -- un aporte solo marcaba cuanto de lo que ya tenias estaba destinado
  -- a algo.
  delete from savings_goals where id = p_id;
end;
$$;

revoke all on function public.eliminar_meta(uuid) from public;
grant execute on function public.eliminar_meta(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- archivar_meta() sigue existiendo para no romper la app entre esta
-- migración y el despliegue del código nuevo. Se le añade la
-- comprobación de dueño que le faltaba.
--
-- Una vez desplegado el código que llama a eliminar_meta(), esta
-- función ya no la usa nadie y se puede borrar con:
--
--     drop function if exists public.archivar_meta(uuid);
-- ---------------------------------------------------------------------

create or replace function public.archivar_meta(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'No hay sesion activa';
  end if;

  select g.owner_id into v_owner
  from savings_goals g where g.id = p_id;

  if not found then
    raise exception 'La meta no existe o no tienes acceso';
  end if;

  if v_owner is distinct from v_uid then
    raise exception 'Solo puedes archivar metas que hayas creado tu';
  end if;

  update savings_goals set is_archived = true where id = p_id;
end;
$$;