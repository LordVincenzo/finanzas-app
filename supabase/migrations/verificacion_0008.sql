-- =====================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN 0008 — METAS DE AHORRO
--
-- La prueba que importa (CASO E del plan):
--   Asignar $500.000 de Nu a una meta NO cambia el patrimonio.
--
-- También comprueba:
--   - el saldo de la cuenta no cambia
--   - el progreso se calcula bien
--   - no puedes asignar más dinero del que tienes libre
--   - retirar de una meta funciona
--   - no puedes dejar una meta en negativo
--
-- Ejecutar en el SQL Editor después de 0008_metas.sql.
-- Al terminar borra todo lo que creó.
-- =====================================================================

do $$
declare
  v_user  uuid := gen_random_uuid();
  v_nu    uuid;
  v_meta  uuid;
  v_val   bigint;
  v_antes bigint;
  v_falla boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'meta_' || left(v_user::text, 8) || '@test.local',
          jsonb_build_object('display_name', 'Prueba Metas'));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

  v_nu := crear_cuenta('Nu', 'digital_wallet', null, 1000000);

  -- ================= CASO E: asignar NO cambia el patrimonio =========
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  v_meta := crear_meta('Viaje Japon', 5000000, null, null, 'private');
  perform aportar_meta(v_meta, v_nu, 500000, 'Primer aporte');

  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes,
    format('CASO E FALLO: el patrimonio paso de %s a %s', v_antes, v_val);

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1000000,
    format('CASO E FALLO: el saldo de Nu cambio a %s', v_val);
  raise notice 'CASO E OK -> asignar 500.000 no altero patrimonio ni saldo';

  -- ================= PROGRESO =======================================
  select acumulado into v_val from metas_resumen where id = v_meta;
  assert v_val = 500000, format('PROGRESO FALLO: acumulado = %s', v_val);

  select progreso into v_val from metas_resumen where id = v_meta;
  assert v_val = 10, format('PROGRESO FALLO: esperaba 10%%, dio %s', v_val);
  raise notice 'PROGRESO OK -> 500.000 de 5.000.000 = 10%%';

  -- ================= DISPONIBLE SIN ASIGNAR =========================
  select disponible into v_val from cuentas_disponible where account_id = v_nu;
  assert v_val = 500000, format('DISPONIBLE FALLO: %s', v_val);
  raise notice 'DISPONIBLE OK -> Nu tiene 1.000.000, libre 500.000';

  -- ================= NO PUEDES ASIGNAR DE MAS =======================
  v_falla := false;
  begin
    perform aportar_meta(v_meta, v_nu, 900000, 'Mas de lo que tengo');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO GRAVE: permitio asignar mas dinero del disponible';
  raise notice 'LIMITE OK -> rechazo asignar mas de lo que hay libre';

  -- ================= RETIRAR DE LA META =============================
  perform aportar_meta(v_meta, v_nu, -200000, 'Retiro');

  select acumulado into v_val from metas_resumen where id = v_meta;
  assert v_val = 300000, format('RETIRO FALLO: acumulado = %s', v_val);

  select disponible into v_val from cuentas_disponible where account_id = v_nu;
  assert v_val = 700000, format('RETIRO FALLO: disponible = %s', v_val);
  raise notice 'RETIRO OK -> meta 300.000, libre en Nu 700.000';

  -- ================= NO PUEDE QUEDAR NEGATIVA =======================
  v_falla := false;
  begin
    perform aportar_meta(v_meta, v_nu, -900000, 'Retiro imposible');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO: permitio dejar la meta en negativo';
  raise notice 'NEGATIVO OK -> rechazo dejar la meta bajo cero';

  raise notice '=== TODAS LAS PRUEBAS DE METAS PASARON ===';

  -- ---- Limpieza ----------------------------------------------------
  perform set_config('role', 'postgres', true);
  delete from savings_contributions
   where goal_id in (select id from savings_goals where owner_id = v_user);
  delete from savings_goals where owner_id = v_user;
  delete from transactions    where owner_id = v_user;
  delete from accounts        where owner_id = v_user;
  delete from auth.users      where id       = v_user;
end;
$$;
