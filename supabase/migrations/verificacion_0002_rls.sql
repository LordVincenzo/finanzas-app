-- =====================================================================
-- VERIFICACIÓN DE RLS (migración 0002)
--
-- Crea DOS usuarios, les da cuentas, y comprueba que:
--   1. Cada uno ve solo lo suyo
--   2. Sin ser pareja, no ven nada del otro
--   3. Siendo pareja, siguen SIN ver lo privado del otro
--   4. Solo ven lo marcado como shared_view o joint
--   5. No pueden crear cuentas a nombre del otro
--
-- Ejecutar en el SQL Editor DESPUÉS de 0002_rls.sql.
-- Al terminar borra todo lo que creó.
--
-- Cómo funciona la suplantación: set_config('role','authenticated') +
-- request.jwt.claims reproduce exactamente lo que hace la API de
-- Supabase cuando tu app hace una petición. No es una simulación
-- aproximada: es el mismo mecanismo.
-- =====================================================================

do $$
declare
  v_ana    uuid := gen_random_uuid();
  v_beto   uuid := gen_random_uuid();
  v_pareja uuid := gen_random_uuid();
  v_n      int;
begin
  -- ---- Dos usuarios ------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_ana,  'ana_'  || left(v_ana::text,  8) || '@test.local',
     jsonb_build_object('display_name','Ana')),
    (v_beto, 'beto_' || left(v_beto::text, 8) || '@test.local',
     jsonb_build_object('display_name','Beto'));

  -- ---- Cuentas de Ana con las tres visibilidades --------------------
  insert into accounts (owner_id, name, class, type, visibility) values
    (v_ana, 'Nu privada',     'asset', 'digital_wallet', 'private'),
    (v_ana, 'Davivienda ver', 'asset', 'checking',       'shared_view');

  -- ---- Cuenta de Beto ----------------------------------------------
  insert into accounts (owner_id, name, class, type, visibility) values
    (v_beto, 'Nequi de Beto', 'asset', 'digital_wallet', 'private');

  -- =================================================================
  -- ESCENARIO 1: sin relación de pareja
  -- =================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_ana::text, 'role','authenticated')::text, true);

  select count(*) into v_n from accounts where name = 'Nequi de Beto';
  assert v_n = 0, 'FALLO GRAVE: Ana ve una cuenta privada de Beto sin ser pareja';
  raise notice 'RLS 1 OK -> Ana NO ve las cuentas de Beto (sin pareja)';

  select count(*) into v_n from accounts where owner_id = v_ana;
  assert v_n = 19, format('FALLO: Ana deberia ver 19 cuentas suyas, ve %s', v_n);
  raise notice 'RLS 2 OK -> Ana ve sus 19 cuentas (17 categorias + 2 propias)';

  -- Intento de crear una cuenta a nombre de Beto
  declare v_bloqueado boolean := false;
  begin
    begin
      insert into accounts (owner_id, name, class, type)
      values (v_beto, 'Cuenta falsa', 'asset', 'cash');
    exception when others then
      v_bloqueado := true;
    end;
    assert v_bloqueado, 'FALLO GRAVE: Ana creo una cuenta a nombre de Beto';
    raise notice 'RLS 3 OK -> Ana NO puede crear cuentas a nombre de Beto';
  end;

  -- =================================================================
  -- ESCENARIO 2: ahora SÍ son pareja
  -- =================================================================
  perform set_config('role', 'postgres', true);

  insert into couples (id, created_by) values (v_pareja, v_ana);
  insert into couple_members (couple_id, profile_id) values
    (v_pareja, v_ana), (v_pareja, v_beto);

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_beto::text, 'role','authenticated')::text, true);

  -- LA PRUEBA CLAVE: ser pareja no da acceso a lo privado
  select count(*) into v_n from accounts where name = 'Nu privada';
  assert v_n = 0,
    'FALLO GRAVE: Beto ve la cuenta PRIVADA de Ana solo por ser pareja';
  raise notice 'RLS 4 OK -> ser pareja NO revela las cuentas privadas';

  -- Pero sí ve lo que Ana marcó como compartido
  select count(*) into v_n from accounts where name = 'Davivienda ver';
  assert v_n = 1,
    'FALLO: Beto deberia ver la cuenta shared_view de Ana';
  raise notice 'RLS 5 OK -> Beto SI ve la cuenta marcada como compartida';

  -- Ver no es tocar: no puede modificarla
  update accounts set name = 'Secuestrada' where name = 'Davivienda ver';
  get diagnostics v_n = row_count;
  assert v_n = 0, 'FALLO GRAVE: Beto modifico una cuenta shared_view de Ana';
  raise notice 'RLS 6 OK -> shared_view permite ver, NO modificar';

  -- Ve el perfil de su pareja (solo nombre)
  select count(*) into v_n from profiles where id = v_ana;
  assert v_n = 1, 'FALLO: Beto deberia ver el perfil de su pareja';
  raise notice 'RLS 7 OK -> Beto ve el perfil de Ana (nombre y avatar)';

  -- =================================================================
  -- Limpieza
  -- =================================================================
  perform set_config('role', 'postgres', true);

  delete from transactions where owner_id in (v_ana, v_beto);
  delete from accounts     where owner_id in (v_ana, v_beto);
  delete from couple_members where couple_id = v_pareja;
  delete from couples      where id = v_pareja;
  delete from auth.users   where id in (v_ana, v_beto);

  raise notice '=== TODAS LAS PRUEBAS DE RLS PASARON ===';
end;
$$;
