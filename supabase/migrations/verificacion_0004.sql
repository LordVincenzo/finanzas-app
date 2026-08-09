-- =====================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN 0004
--
-- Prueba crear_movimiento(), ajustar_saldo() y eliminar_movimiento()
-- SUPLANTANDO a un usuario autenticado, igual que hace la app.
--
-- Comprueba:
--   CASO A  gasto reduce el saldo
--   CASO B  transferencia no altera el patrimonio
--   ingreso aumenta el patrimonio
--   ajuste de saldo calcula la diferencia correcta
--   borrar un movimiento recalcula solo
--   validaciones: monto negativo, misma cuenta, clases incoherentes
--
-- Ejecutar en el SQL Editor después de 0004_movimientos.sql.
-- Al terminar borra todo lo que creó.
-- =====================================================================

do $$
declare
  v_user  uuid := gen_random_uuid();
  v_nu    uuid;
  v_davi  uuid;
  v_alim  uuid;
  v_sal   uuid;
  v_tx    uuid;
  v_val   bigint;
  v_antes bigint;
  v_falla boolean;
begin
  -- ---- Usuario real ------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'mov_' || left(v_user::text, 8) || '@test.local',
          jsonb_build_object('display_name', 'Prueba Movimientos'));

  -- ---- Nos convertimos en ese usuario ------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

  -- Cuentas creadas con el RPC de la fase 8
  v_nu   := crear_cuenta('Nu',         'digital_wallet', null, 2000000);
  v_davi := crear_cuenta('Davivienda', 'checking',       null, 1000000);

  select id into v_alim from accounts
   where owner_id = v_user and name = 'Alimentación';
  select id into v_sal  from accounts
   where owner_id = v_user and name = 'Salario';

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 2000000, format('Apertura mal: Nu = %s', v_val);
  raise notice 'SETUP OK -> Nu = 2000000, Davivienda = 1000000';

  -- ================= CASO A: gasto de $20.000 =======================
  v_tx := crear_movimiento('expense', 20000, v_nu, v_alim, 'Almuerzo');

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1980000, format('CASO A FALLO: Nu = %s', v_val);

  select balance into v_val from account_balances where account_id = v_alim;
  assert v_val = 20000, format('CASO A FALLO: Alimentacion = %s', v_val);
  raise notice 'CASO A OK -> Nu 1.980.000, Alimentacion acumula 20.000';

  -- ================= CASO B: transferencia ==========================
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  perform crear_movimiento('transfer', 500000, v_nu, v_davi, 'Traslado');

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1480000, format('CASO B FALLO: Nu = %s', v_val);
  select balance into v_val from account_balances where account_id = v_davi;
  assert v_val = 1500000, format('CASO B FALLO: Davivienda = %s', v_val);
  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes, 'CASO B FALLO: la transferencia altero el patrimonio';
  raise notice 'CASO B OK -> patrimonio intacto tras transferir (%)', v_val;

  -- ================= INGRESO ========================================
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  perform crear_movimiento('income', 3800000, v_sal, v_davi, 'Salario agosto');

  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes + 3800000,
    format('INGRESO FALLO: patrimonio %s, esperaba %s', v_val, v_antes + 3800000);

  -- Las cuentas de ingreso acumulan negativo (convencion contable)
  select balance into v_val from account_balances where account_id = v_sal;
  assert v_val = -3800000, format('INGRESO FALLO: Salario = %s', v_val);
  raise notice 'INGRESO OK -> patrimonio sube 3.800.000';

  -- ================= AJUSTE DE SALDO ================================
  -- Nu tiene 1.480.000 pero el banco dice 1.500.000
  perform ajustar_saldo(v_nu, 1500000, 'Cuadre con el banco');

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1500000, format('AJUSTE FALLO: Nu = %s', v_val);
  raise notice 'AJUSTE OK -> Nu ajustado a 1.500.000 (diferencia +20.000)';

  -- ================= BORRAR RECALCULA SOLO ==========================
  -- Borramos el almuerzo: Alimentacion debe volver a 0
  perform eliminar_movimiento(
    (select id from transactions
      where owner_id = v_user and description = 'Almuerzo' limit 1)
  );

  select balance into v_val from account_balances where account_id = v_alim;
  assert v_val = 0, format('BORRADO FALLO: Alimentacion = %s', v_val);
  raise notice 'BORRADO OK -> al eliminar el gasto, la categoria vuelve a 0';

  -- ================= VALIDACIONES ===================================
  v_falla := false;
  begin
    perform crear_movimiento('expense', -5000, v_nu, v_alim, 'Monto negativo');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO: acepto un monto negativo';

  v_falla := false;
  begin
    perform crear_movimiento('transfer', 1000, v_nu, v_nu, 'Misma cuenta');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO: acepto origen = destino';

  v_falla := false;
  begin
    -- transferir A una categoria de gasto inflaria el patrimonio
    perform crear_movimiento('transfer', 1000, v_nu, v_alim, 'Clase incorrecta');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO GRAVE: permitio transferir a una categoria de gasto';

  v_falla := false;
  begin
    perform crear_movimiento('expense', 1000, v_alim, v_nu, 'Invertido');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO: permitio un gasto con las cuentas invertidas';

  raise notice 'VALIDACIONES OK -> rechazo monto negativo, misma cuenta y clases incoherentes';
  raise notice '=== TODAS LAS PRUEBAS DE MOVIMIENTOS PASARON ===';

  -- ---- Limpieza ----------------------------------------------------
  perform set_config('role', 'postgres', true);
  delete from transactions where owner_id = v_user;
  delete from accounts     where owner_id = v_user;
  delete from auth.users   where id       = v_user;
end;
$$;
