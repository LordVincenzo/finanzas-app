-- =====================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN 0021
--
-- Escenario real, no sintético: primero una cena compartida que crea la
-- deuda, y después la liquidación que la cierra. Sin esa deuda previa el
-- balance no parte de cero y las cifras no significan nada.
--
--   Carlos tiene 1.000.000 en Nu A. Marina, 500.000 en Nu B.
--   Cena de 120.000 que paga Carlos, 50/50.
--     Carlos: Nu A -120.000, Alimentación +60.000, Balance +60.000
--     Marina: Alimentación +60.000, Balance -60.000
--     Patrimonios: 940.000 y 440.000
--   Marina le devuelve los 60.000 y lo registra ella.
--     Marina: Nu B -60.000, Balance +60.000 -> 0
--     Carlos (espejo): Balance -60.000 -> 0, Pendiente +60.000
--     Patrimonios: 940.000 y 440.000   <- NINGUNO se mueve
--
-- Comprueba:
--   QUIEN PAGA          -> su patrimonio no se mueve
--   QUIEN RECIBE        -> su patrimonio NO se mueve  <- el bug de 0021
--   DISPONIBLE          -> el total cuadra aunque no esté ubicado
--   BORRAR LIQUIDACIÓN  -> revierte los DOS ledgers
--   UBICAR              -> una transferencia normal lo cierra
--   CANCELADO           -> borrar un abono no revive un préstamo
--   DERIVADO            -> el estado sale de la suma de abonos
--
-- OJO CON LA SESIÓN ACTIVA. patrimonio_detalle, account_balances y
-- cuentas_disponible son security_invoker: solo muestran las cuentas que
-- puede ver quien consulta. Comprobar el patrimonio de Carlos desde la
-- sesión de Marina devuelve NULL, no un número equivocado, y la
-- aserción falla sin decir por qué. Por eso cada bloque dice de quién es
-- la sesión, y se cambia antes de mirar los datos de cada uno.
--
-- Ejecutar en el SQL Editor después de 0021.
-- Al terminar borra todo lo que creó.
-- =====================================================================

do $$
declare
  v_a        uuid := gen_random_uuid();   -- Carlos
  v_b        uuid := gen_random_uuid();   -- Marina
  v_mail_a   text;
  v_mail_b   text;
  v_inv      uuid;
  v_nu_a     uuid;
  v_nu_b     uuid;
  v_cat_a    uuid;
  v_bal_a    uuid;
  v_pend_a   uuid;
  v_liq      uuid;
  v_loan     uuid;
  v_pago1    uuid;
  v_pago2    uuid;
  v_patri_a  bigint;
  v_patri_b  bigint;
  v_val      bigint;
  v_txt      text;
  v_bool     boolean;
begin
  v_mail_a := 'car_' || left(v_a::text, 8) || '@test.local';
  v_mail_b := 'mar_' || left(v_b::text, 8) || '@test.local';

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_a, v_mail_a, jsonb_build_object('display_name', 'Carlos')),
    (v_b, v_mail_b, jsonb_build_object('display_name', 'Marina'));

  perform set_config('role', 'authenticated', true);

  -- ================= SESIÓN: BRIAND =================================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  v_nu_a := crear_cuenta('Nu A', 'digital_wallet', null, 1000000);
  v_inv  := invitar_pareja(v_mail_b);

  select id into v_cat_a from accounts
   where owner_id = v_a and class = 'expense' and lower(name) = 'alimentación'
   limit 1;
  assert v_cat_a is not null,
    'PREPARACION FALLO: Carlos no tiene la categoria Alimentacion';

  -- ================= SESIÓN: ANDREA =================================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_b::text, 'role', 'authenticated', 'email', v_mail_b)::text, true);

  v_nu_b := crear_cuenta('Nu B', 'digital_wallet', null, 500000);
  perform aceptar_invitacion(v_inv);

  -- ================= SESIÓN: BRIAND — la cena =======================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  perform crear_gasto_compartido(120000, v_nu_a, v_cat_a, 'Cena', 60000);

  select patrimonio into v_patri_a from patrimonio_detalle where owner_id = v_a;
  assert v_patri_a = 940000,
    format('CENA FALLO: patrimonio de Carlos = %s, esperaba 940000', v_patri_a);

  select a.id into v_bal_a from accounts a
   where a.owner_id = v_a and a.is_partner_balance;
  select balance into v_val from account_balances where account_id = v_bal_a;
  assert v_val = 60000,
    format('CENA FALLO: Marina deberia deberle 60000, el balance dice %s', v_val);
  raise notice 'CENA OK -> Marina le debe 60.000 a Carlos';

  -- ================= SESIÓN: ANDREA — paga y registra ===============
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_b::text, 'role', 'authenticated', 'email', v_mail_b)::text, true);

  select patrimonio into v_patri_b from patrimonio_detalle where owner_id = v_b;
  assert v_patri_b = 440000,
    format('CENA FALLO: patrimonio de Marina = %s, esperaba 440000', v_patri_b);

  v_liq := liquidar_con_pareja(60000, v_nu_b, true);

  -- Quien paga y registra: su patrimonio no se mueve (pagó una deuda).
  select patrimonio into v_val from patrimonio_detalle where owner_id = v_b;
  assert v_val = v_patri_b,
    format('QUIEN PAGA FALLO: patrimonio de Marina paso de %s a %s',
           v_patri_b, v_val);
  raise notice 'QUIEN PAGA OK -> patrimonio de Marina intacto (%)', v_val;

  select balance into v_val from account_balances where account_id = v_nu_b;
  assert v_val = 440000,
    format('QUIEN PAGA FALLO: Nu B quedo en %s, esperaba 440000', v_val);

  -- ================= SESIÓN: BRIAND — el que recibe =================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  -- Su patrimonio TAMPOCO se mueve. Esto es lo que arregla 0021: antes
  -- bajaba 60.000, porque la contrapartida del espejo iba a su cuenta de
  -- apertura, que es de clase income y no cuenta como patrimonio.
  select patrimonio into v_val from patrimonio_detalle where owner_id = v_a;
  assert v_val = v_patri_a,
    format('EL BUG DE 0021 SIGUE AHI: el patrimonio de Carlos paso de %s a %s '
           'al recibir un pago (deberia seguir igual)', v_patri_a, v_val);
  raise notice 'QUIEN RECIBE OK -> patrimonio de Carlos intacto (%)', v_val;

  -- Ya no se deben nada.
  select balance into v_val from account_balances where account_id = v_bal_a;
  assert v_val = 0,
    format('BALANCE FALLO: Carlos quedo en %s, esperaba 0', v_val);

  -- El dinero está, pero sin ubicar.
  select a.id into v_pend_a from accounts a
   where a.owner_id = v_a and a.is_pending_location;
  assert v_pend_a is not null,
    'FALLO: no se creo la cuenta "Pendiente de ubicar" de Carlos';

  select balance into v_val from account_balances where account_id = v_pend_a;
  assert v_val = 60000,
    format('PENDIENTE FALLO: esperaba 60000 sin ubicar, hay %s', v_val);
  raise notice 'PENDIENTE OK -> 60.000 visibles en "Pendiente de ubicar"';

  -- El total del disponible cuadra aunque no esté ubicado: Nu A sigue en
  -- 880.000 y el pendiente aporta los 60.000 que entraron de verdad.
  select coalesce(sum(disponible), 0) into v_val
   from cuentas_disponible where owner_id = v_a;
  assert v_val = 940000,
    format('DISPONIBLE FALLO: esperaba 940000, dio %s', v_val);
  raise notice 'DISPONIBLE OK -> el total cuadra sin ubicar el dinero';

  -- ================= BORRAR LA LIQUIDACIÓN ==========================
  -- La borra Carlos, que NO fue quien la registró: cualquiera de los dos
  -- puede, porque cualquiera pudo haberla registrado mal.
  perform eliminar_liquidacion(v_liq);

  assert not exists (select 1 from couple_settlements where id = v_liq),
    'BORRAR FALLO: la liquidacion sigue ahi';

  select balance into v_val from account_balances where account_id = v_bal_a;
  assert v_val = 60000,
    format('BORRAR FALLO: el balance de Carlos quedo en %s, esperaba 60000',
           v_val);

  select balance into v_val from account_balances where account_id = v_pend_a;
  assert v_val = 0,
    format('BORRAR FALLO: el pendiente quedo en %s, esperaba 0', v_val);

  select patrimonio into v_val from patrimonio_detalle where owner_id = v_a;
  assert v_val = v_patri_a,
    format('BORRAR FALLO: patrimonio de Carlos = %s, esperaba %s',
           v_val, v_patri_a);
  raise notice 'BORRAR OK -> revirtio los dos ledgers';

  -- ================= SESIÓN: ANDREA — paga otra vez =================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_b::text, 'role', 'authenticated', 'email', v_mail_b)::text, true);

  v_liq := liquidar_con_pareja(60000, v_nu_b, true);

  -- ================= SESIÓN: BRIAND — ubica el dinero ===============
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  -- Con una transferencia normal. Sin funciones nuevas, sin ajustes.
  perform crear_movimiento('transfer', 60000, v_pend_a, v_nu_a,
                           'Ubicar el pago de Marina');

  select balance into v_val from account_balances where account_id = v_pend_a;
  assert v_val = 0, format('UBICAR FALLO: el pendiente quedo en %s', v_val);

  select balance into v_val from account_balances where account_id = v_nu_a;
  assert v_val = 940000,
    format('UBICAR FALLO: Nu A quedo en %s, esperaba 940000', v_val);

  select patrimonio into v_val from patrimonio_detalle where owner_id = v_a;
  assert v_val = v_patri_a,
    format('UBICAR FALLO: el patrimonio cambio a %s', v_val);
  raise notice 'UBICAR OK -> transferencia normal cierra el cabo suelto';

  -- ================= PRÉSTAMO CANCELADO NO REVIVE ===================
  v_loan  := crear_prestamo('Juan', 400000, v_nu_a, null, '[]'::jsonb);
  v_pago1 := registrar_pago_prestamo(v_loan, 100000, v_nu_a);

  perform cancelar_prestamo(v_loan);
  select status into v_txt from loans where id = v_loan;
  assert v_txt = 'cancelled', format('PREPARACION FALLO: status = %s', v_txt);

  perform eliminar_pago_prestamo(v_pago1);

  select status into v_txt from loans where id = v_loan;
  assert v_txt = 'cancelled',
    format('CANCELADO FALLO: borrar un abono lo devolvio a %s', v_txt);
  raise notice 'CANCELADO OK -> un prestamo cancelado no revive';

  -- ================= EL ESTADO SE DERIVA DE LOS ABONOS ==============
  v_loan  := crear_prestamo('Ana', 400000, v_nu_a, null, '[]'::jsonb);

  v_pago1 := registrar_pago_prestamo(v_loan, 200000, v_nu_a);
  select status into v_txt from loans where id = v_loan;
  assert v_txt = 'active',
    format('DERIVADO FALLO: con 200000 de 400000 esperaba active, es %s', v_txt);

  v_pago2 := registrar_pago_prestamo(v_loan, 200000, v_nu_a);
  select status into v_txt from loans where id = v_loan;
  assert v_txt = 'paid',
    format('DERIVADO FALLO: cubierto del todo esperaba paid, es %s', v_txt);

  -- Borrar uno de los dos lo deja a medias: vuelve a activo. La versión
  -- de 0009 ponía 'active' a secas, así que este caso salía igual por
  -- casualidad; el que fallaba era el de arriba (cancelado).
  perform eliminar_pago_prestamo(v_pago2);
  select status into v_txt from loans where id = v_loan;
  assert v_txt = 'active',
    format('DERIVADO FALLO: con 200000 de 400000 esperaba active, es %s', v_txt);

  -- Y la cuenta por cobrar vuelve a estar utilizable.
  select a.is_active into v_bool from accounts a
   join loans l on l.receivable_account_id = a.id where l.id = v_loan;
  assert v_bool,
    format('DERIVADO FALLO: la cuenta por cobrar quedo is_active = %s', v_bool);
  raise notice 'DERIVADO OK -> el estado sale de la suma de abonos';

  raise notice '=== TODAS LAS PRUEBAS DE 0021 PASARON ===';

  -- ---- Limpieza ----------------------------------------------------
  perform set_config('role', 'postgres', true);
  delete from couple_settlements
   where from_profile in (v_a, v_b) or to_profile in (v_a, v_b);
  delete from shared_expense_splits   where profile_id in (v_a, v_b);
  delete from shared_expenses         where payer_id in (v_a, v_b);
  delete from loan_payments
   where loan_id in (select id from loans where owner_id in (v_a, v_b));
  delete from loan_installments
   where loan_id in (select id from loans where owner_id in (v_a, v_b));
  delete from loans                   where owner_id in (v_a, v_b);
  delete from transactions            where owner_id in (v_a, v_b);
  delete from couple_invitations      where inviter_id in (v_a, v_b);
  delete from couple_members          where profile_id in (v_a, v_b);
  delete from couples                 where created_by in (v_a, v_b);
  delete from accounts                where owner_id in (v_a, v_b);
  delete from auth.users              where id in (v_a, v_b);
end;
$$;
