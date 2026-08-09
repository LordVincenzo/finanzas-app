-- =====================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN 0009 — PRÉSTAMOS
--
-- Reproduce el ejemplo exacto del plan:
--   Juan Pérez, $1.200.000, desde Nu, en 3 cuotas de $400.000
--   (15 ago, 15 sep, 15 oct)
--
-- Comprueba:
--   CASO C  prestar no cambia el patrimonio
--   CASO D  cobrar no infla el patrimonio
--   ABONO PARCIAL: pagan 200.000 de una cuota de 400.000
--                  -> la cuota NO queda pagada
--   varios abonos contra la misma cuota
--   no se puede cobrar más de lo prestado
--   las cuotas deben sumar el total
--   deshacer un abono revierte el dinero
--
-- Ejecutar en el SQL Editor después de 0009_prestamos.sql.
-- Al terminar borra todo lo que creó.
-- =====================================================================

do $$
declare
  v_user   uuid := gen_random_uuid();
  v_nu     uuid;
  v_loan   uuid;
  v_recv   uuid;
  v_cuota1 uuid;
  v_pago   uuid;
  v_val    bigint;
  v_antes  bigint;
  v_txt    text;
  v_falla  boolean;
begin
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'loan_' || left(v_user::text, 8) || '@test.local',
          jsonb_build_object('display_name', 'Prueba Prestamos'));

  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', v_user::text, 'role', 'authenticated')::text, true);

  v_nu := crear_cuenta('Nu', 'digital_wallet', null, 2000000);

  -- ================= CASO C: prestar 1.200.000 en 3 cuotas ==========
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  v_loan := crear_prestamo(
    'Juan Perez', 1200000, v_nu, '2026-08-01'::date,
    '[{"fecha":"2026-08-15","monto":400000},
      {"fecha":"2026-09-15","monto":400000},
      {"fecha":"2026-10-15","monto":400000}]'::jsonb
  );

  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes,
    format('CASO C FALLO: patrimonio paso de %s a %s', v_antes, v_val);

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 800000, format('CASO C FALLO: Nu = %s', v_val);

  select receivable_account_id into v_recv from loans where id = v_loan;
  select balance into v_val from account_balances where account_id = v_recv;
  assert v_val = 1200000, format('CASO C FALLO: por cobrar = %s', v_val);
  raise notice 'CASO C OK -> Nu 800.000, por cobrar 1.200.000, patrimonio intacto';

  -- Las 3 cuotas se crearon
  select cuotas_total into v_val from prestamos_resumen where id = v_loan;
  assert v_val = 3, format('FALLO: esperaba 3 cuotas, hay %s', v_val);
  raise notice 'CUOTAS OK -> 3 cuotas de 400.000';

  -- ================= ABONO PARCIAL: 200.000 de 400.000 =============
  select id into v_cuota1 from loan_installments
   where loan_id = v_loan and number = 1;

  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  v_pago := registrar_pago_prestamo(
    v_loan, 200000, v_nu, v_cuota1, '2026-08-15'::date, 'Abono parcial');

  -- CASO D: cobrar no infla el patrimonio
  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes,
    format('CASO D FALLO: el abono cambio el patrimonio a %s', v_val);

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1000000, format('CASO D FALLO: Nu = %s', v_val);

  select balance into v_val from account_balances where account_id = v_recv;
  assert v_val = 1000000, format('CASO D FALLO: por cobrar = %s', v_val);
  raise notice 'CASO D OK -> Nu +200.000, por cobrar -200.000, patrimonio intacto';

  -- LA PRUEBA CLAVE: la cuota NO queda pagada
  select pagado, pendiente, estado into v_val, v_antes, v_txt
  from cuotas_detalle where id = v_cuota1;

  assert v_val = 200000,   format('PARCIAL FALLO: pagado = %s', v_val);
  assert v_antes = 200000, format('PARCIAL FALLO: pendiente = %s', v_antes);
  assert v_txt <> 'pagada', format('PARCIAL FALLO: la cuota quedo %s', v_txt);
  raise notice 'PARCIAL OK -> cuota: pagado 200.000, pendiente 200.000, estado %', v_txt;

  -- ================= SEGUNDO ABONO A LA MISMA CUOTA ================
  perform registrar_pago_prestamo(
    v_loan, 200000, v_nu, v_cuota1, '2026-08-20'::date, 'Completa la cuota');

  select pendiente, estado into v_val, v_txt
  from cuotas_detalle where id = v_cuota1;

  assert v_val = 0, format('SEGUNDO ABONO FALLO: pendiente = %s', v_val);
  assert v_txt = 'pagada', format('SEGUNDO ABONO FALLO: estado = %s', v_txt);
  raise notice 'MULTIABONO OK -> dos abonos de 200.000 completan la cuota';

  -- El resumen del préstamo
  select pagado, pendiente into v_val, v_antes
  from prestamos_resumen where id = v_loan;
  assert v_val = 400000,   format('RESUMEN FALLO: pagado = %s', v_val);
  assert v_antes = 800000, format('RESUMEN FALLO: pendiente = %s', v_antes);
  raise notice 'RESUMEN OK -> pagado 400.000, pendiente 800.000';

  -- ================= NO SE PUEDE COBRAR DE MAS =====================
  v_falla := false;
  begin
    perform registrar_pago_prestamo(v_loan, 5000000, v_nu, null, null, 'Exceso');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO GRAVE: permitio cobrar mas de lo prestado';
  raise notice 'LIMITE OK -> rechazo cobrar mas del saldo pendiente';

  -- ================= LAS CUOTAS DEBEN SUMAR EL TOTAL ===============
  v_falla := false;
  begin
    perform crear_prestamo('Mal Cuadrado', 1000000, v_nu, null,
      '[{"fecha":"2026-09-01","monto":300000}]'::jsonb);
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO: acepto cuotas que no suman el prestamo';
  raise notice 'CUADRE OK -> rechazo cuotas que no suman el total';

  -- ================= DESHACER UN ABONO =============================
  perform eliminar_pago_prestamo(v_pago);

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1000000, format('DESHACER FALLO: Nu = %s', v_val);

  select pagado into v_val from prestamos_resumen where id = v_loan;
  assert v_val = 200000, format('DESHACER FALLO: pagado = %s', v_val);
  raise notice 'DESHACER OK -> el abono se revirtio en el ledger';

  raise notice '=== TODAS LAS PRUEBAS DE PRESTAMOS PASARON ===';

  -- ---- Limpieza ----------------------------------------------------
  perform set_config('role', 'postgres', true);
  delete from loan_payments     where loan_id in (select id from loans where owner_id = v_user);
  delete from loan_installments where loan_id in (select id from loans where owner_id = v_user);
  delete from loans             where owner_id = v_user;
  delete from transactions      where owner_id = v_user;
  delete from accounts          where owner_id = v_user;
  delete from auth.users        where id       = v_user;
end;
$$;
