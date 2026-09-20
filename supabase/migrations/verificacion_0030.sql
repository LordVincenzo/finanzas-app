-- =====================================================================
-- VERIFICACIÓN DE LA 0030 — editar sin romper el ledger
--
-- CÓMO SE USA: pegar entero en Supabase -> SQL Editor. Termina en
-- ROLLBACK, así que no deja nada.
--
-- POR QUÉ ESTE SÍ LLEVA SCRIPT. Las migraciones 0028 y 0029 —topes y
-- fechas de pago— no lo llevan a propósito: son una tabla aparte y dos
-- columnas, no tocan el dinero. Esta reescribe las líneas de una
-- transacción existente, que es lo más cerca del ledger que se ha
-- estado desde la 0021.
--
-- QUÉ COMPRUEBA:
--   1. Editar el monto mueve los saldos de las dos cuentas
--   2. Cambiar de categoría mueve el gasto de sitio, no lo duplica
--   3. El patrimonio no cambia al editar una transferencia
--   4. El id NO cambia: el enlace con la bandeja sobrevive
--   5. Un movimiento descuadrado es imposible (monto <= 0)
--   6. No se puede editar una apertura
--   7. No se puede editar un ajuste
--   8. No se puede editar el movimiento de otra persona
--   9. Las reglas contables siguen valiendo al editar
-- =====================================================================

begin;

do $$
declare
  v_a       uuid := gen_random_uuid();
  v_b       uuid := gen_random_uuid();
  v_mail_a  text;
  v_mail_b  text;

  v_nu      uuid;
  v_eft     uuid;
  v_merc    uuid;
  v_ocio    uuid;
  v_sueldo  uuid;

  v_tx      uuid;
  v_mismo   uuid;
  v_val     bigint;
  v_patri   bigint;
  v_err     text;
begin
  -- ---- Preparación -------------------------------------------------
  v_mail_a := 'ver30a_' || left(v_a::text, 8) || '@test.local';
  v_mail_b := 'ver30b_' || left(v_b::text, 8) || '@test.local';

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_a, v_mail_a, jsonb_build_object('display_name', 'Ana')),
    (v_b, v_mail_b, jsonb_build_object('display_name', 'Beto'));

  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  v_nu  := crear_cuenta('Nu',       'digital_wallet', null, 1000000, 'private');
  v_eft := crear_cuenta('Efectivo', 'cash',           null,  500000, 'private');

  select a.id into v_merc from accounts a
   where a.owner_id = v_a and a.class = 'expense' order by a.name limit 1;
  select a.id into v_ocio from accounts a
   where a.owner_id = v_a and a.class = 'expense' and a.id <> v_merc
   order by a.name limit 1;
  select a.id into v_sueldo from accounts a
   where a.owner_id = v_a and a.class = 'income' order by a.name limit 1;

  if v_merc is null or v_ocio is null or v_sueldo is null then
    raise exception 'PREPARACION FALLO: faltan categorias';
  end if;

  -- ---- 1. Editar el monto mueve los saldos -------------------------
  v_tx := crear_movimiento('expense', 100000, v_nu, v_merc, 'Mercado');

  select balance into v_val from account_balances where account_id = v_nu;
  if v_val <> 900000 then
    raise exception '1 FALLO: Nu quedo en %, esperaba 900000', v_val;
  end if;

  perform editar_movimiento(v_tx, 'expense', 250000, v_nu, v_merc,
                            'Mercado corregido', now());

  select balance into v_val from account_balances where account_id = v_nu;
  if v_val <> 750000 then
    raise exception '1 FALLO: tras editar Nu quedo en %, esperaba 750000', v_val;
  end if;

  select balance into v_val from account_balances where account_id = v_merc;
  if v_val <> 250000 then
    raise exception '1 FALLO: la categoria quedo en %, esperaba 250000', v_val;
  end if;
  raise notice '1 OK -> editar el monto mueve las dos cuentas';

  -- ---- 2. Cambiar de categoría no duplica --------------------------
  perform editar_movimiento(v_tx, 'expense', 250000, v_nu, v_ocio,
                            'Mercado corregido', now());

  select balance into v_val from account_balances where account_id = v_merc;
  if v_val <> 0 then
    raise exception '2 FALLO: la categoria vieja quedo en %, esperaba 0', v_val;
  end if;

  select balance into v_val from account_balances where account_id = v_ocio;
  if v_val <> 250000 then
    raise exception '2 FALLO: la categoria nueva quedo en %, esperaba 250000', v_val;
  end if;

  if (select count(*) from transaction_entries where transaction_id = v_tx) <> 2 then
    raise exception '2 FALLO: la transaccion quedo con % lineas, esperaba 2',
      (select count(*) from transaction_entries where transaction_id = v_tx);
  end if;
  raise notice '2 OK -> cambiar de categoria mueve el gasto, no lo duplica';

  -- ---- 3. El id NO cambia ------------------------------------------
  -- Es lo que mantiene vivo el enlace con la bandeja, los prestamos y
  -- los gastos compartidos.
  select t.id into v_mismo from transactions t where t.id = v_tx;
  if v_mismo is null then
    raise exception '3 FALLO: la transaccion ya no existe con ese id';
  end if;
  raise notice '3 OK -> el id sobrevive a la edicion';

  -- ---- 4. Una transferencia no mueve el patrimonio -----------------
  select patrimonio into v_patri from patrimonio_detalle where owner_id = v_a;
  v_mismo := crear_movimiento('transfer', 200000, v_nu, v_eft, 'Paso a efectivo');

  perform editar_movimiento(v_mismo, 'transfer', 400000, v_nu, v_eft,
                            'Paso a efectivo', now());

  select patrimonio into v_val from patrimonio_detalle where owner_id = v_a;
  if v_val <> v_patri then
    raise exception '4 FALLO: el patrimonio paso de % a % al editar un traslado',
      v_patri, v_val;
  end if;

  select balance into v_val from account_balances where account_id = v_eft;
  if v_val <> 900000 then
    raise exception '4 FALLO: Efectivo quedo en %, esperaba 900000', v_val;
  end if;
  raise notice '4 OK -> editar un traslado no toca el patrimonio';

  -- ---- 5. Monto cero o negativo, imposible -------------------------
  begin
    perform editar_movimiento(v_tx, 'expense', 0, v_nu, v_ocio, 'Cero', now());
    raise exception '5 FALLO: acepto un monto de cero';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%FALLO%' then raise; end if;
  end;
  raise notice '5 OK -> monto cero rechazado';

  -- ---- 6. Las reglas contables siguen valiendo ---------------------
  -- Un gasto no puede ir contra una cuenta de dinero.
  begin
    perform editar_movimiento(v_tx, 'expense', 100000, v_nu, v_eft,
                              'Gasto a una cuenta', now());
    raise exception '6 FALLO: dejo que un gasto fuera contra una cuenta';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%FALLO%' then raise; end if;
  end;

  -- Y origen igual a destino, tampoco.
  begin
    perform editar_movimiento(v_tx, 'expense', 100000, v_nu, v_nu,
                              'A si misma', now());
    raise exception '6 FALLO: dejo origen = destino';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%FALLO%' then raise; end if;
  end;
  raise notice '6 OK -> las reglas contables valen igual al editar';

  -- ---- 7. Una apertura no se edita ---------------------------------
  select t.id into v_mismo from transactions t
   where t.owner_id = v_a and t.type = 'opening' limit 1;

  if v_mismo is null then
    raise exception 'PREPARACION FALLO: no hay ninguna apertura';
  end if;

  begin
    perform editar_movimiento(v_mismo, 'expense', 1000, v_nu, v_ocio,
                              'Tocando una apertura', now());
    raise exception '7 FALLO: dejo editar una apertura';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%FALLO%' then raise; end if;
  end;
  raise notice '7 OK -> una apertura no se edita';

  -- ---- 8. Un ajuste tampoco ----------------------------------------
  perform ajustar_saldo(v_nu, 800000, 'Cuadre');

  select t.id into v_mismo from transactions t
   where t.owner_id = v_a and t.type = 'adjustment'
   order by t.created_at desc limit 1;

  if v_mismo is null then
    raise exception 'PREPARACION FALLO: no se creo el ajuste';
  end if;

  begin
    perform editar_movimiento(v_mismo, 'expense', 1000, v_nu, v_ocio,
                              'Tocando un ajuste', now());
    raise exception '8 FALLO: dejo editar un ajuste';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%FALLO%' then raise; end if;
  end;
  raise notice '8 OK -> un ajuste no se edita';

  -- ---- 9. El movimiento de otra persona ----------------------------
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_b::text, 'role', 'authenticated', 'email', v_mail_b)::text, true);

  begin
    perform editar_movimiento(v_tx, 'expense', 999999, v_nu, v_ocio,
                              'Robando', now());
    raise exception '9 FALLO: Beto edito un movimiento de Ana';
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err like '%FALLO%' then raise; end if;
  end;

  -- Y el movimiento de Ana sigue como estaba.
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  select destino.amount into v_val
  from transaction_entries destino
  where destino.transaction_id = v_tx and destino.amount > 0;

  if v_val <> 250000 then
    raise exception '9 FALLO: el movimiento de Ana quedo en %, esperaba 250000', v_val;
  end if;
  raise notice '9 OK -> nadie edita lo de otra persona';

  raise notice '';
  raise notice '=== LA 0030 PASA ===';
end $$;

rollback;
