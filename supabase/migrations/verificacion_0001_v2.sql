-- =====================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN 0001  (v2)
--
-- Cambio respecto a v1: creamos un usuario REAL en auth.users, porque
-- profiles.id tiene una clave foránea hacia esa tabla. De paso esto
-- verifica el trigger handle_new_user (perfil + categorías por defecto).
--
-- Ejecutar en el SQL Editor de Supabase, después de 0001_fundamentos.sql.
-- Al terminar borra todo lo que creó.
-- =====================================================================

do $$
declare
  v_user  uuid := gen_random_uuid();
  v_nu    uuid;
  v_davi  uuid;
  v_alim  uuid;
  v_juan  uuid;
  v_open  uuid;
  v_tx    uuid;
  v_val   bigint;
  v_antes bigint;
  v_fallo boolean := false;
  v_cats  int;
begin
  -- ---- Usuario real. El trigger creará perfil y categorías ----------
  insert into auth.users (id, email, raw_user_meta_data)
  values (v_user, 'prueba_' || left(v_user::text, 8) || '@test.local',
          jsonb_build_object('display_name', 'Usuario Prueba'));

  -- Verificamos que el trigger de alta funcionó
  assert exists (select 1 from profiles where id = v_user),
    'FALLO: el trigger handle_new_user no creo el perfil';

  select count(*) into v_cats from accounts
   where owner_id = v_user and class = 'expense';
  assert v_cats = 12, format('FALLO: esperaba 12 categorias de gasto, hay %s', v_cats);
  raise notice 'ALTA OK -> perfil creado y % categorias de gasto sembradas', v_cats;

  -- Reutilizamos la categoría que ya creó el trigger
  select id into v_alim from accounts
   where owner_id = v_user and name = 'Alimentación';

  insert into accounts (owner_id, name, class, type)
    values (v_user, 'Nu', 'asset', 'digital_wallet') returning id into v_nu;
  insert into accounts (owner_id, name, class, type)
    values (v_user, 'Davivienda', 'asset', 'checking') returning id into v_davi;
  insert into accounts (owner_id, name, class, type)
    values (v_user, 'Por cobrar: Juan', 'asset', 'receivable') returning id into v_juan;
  insert into accounts (owner_id, name, class, type)
    values (v_user, 'Saldo inicial', 'income', 'income_category') returning id into v_open;

  -- ---- Saldos iniciales: Nu $2.000.000, Davivienda $1.000.000 -------
  insert into transactions (owner_id, type, description, created_by)
    values (v_user, 'opening', 'Apertura Nu', v_user) returning id into v_tx;
  insert into transaction_entries (transaction_id, account_id, amount)
    values (v_tx, v_nu, 2000000), (v_tx, v_open, -2000000);

  insert into transactions (owner_id, type, description, created_by)
    values (v_user, 'opening', 'Apertura Davivienda', v_user) returning id into v_tx;
  insert into transaction_entries (transaction_id, account_id, amount)
    values (v_tx, v_davi, 1000000), (v_tx, v_open, -1000000);

  -- ================= CASO A: gasto de $20.000 desde Nu ===============
  insert into transactions (owner_id, type, description, created_by)
    values (v_user, 'expense', 'Almuerzo', v_user) returning id into v_tx;
  insert into transaction_entries (transaction_id, account_id, amount)
    values (v_tx, v_nu, -20000), (v_tx, v_alim, 20000);

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1980000, format('CASO A FALLO: Nu deberia ser 1980000, es %s', v_val);
  raise notice 'CASO A OK -> Nu = % tras gastar 20000', v_val;

  -- ============ CASO B: transferencia Nu -> Davivienda $500.000 ======
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  insert into transactions (owner_id, type, description, created_by)
    values (v_user, 'transfer', 'Traslado a Davivienda', v_user) returning id into v_tx;
  insert into transaction_entries (transaction_id, account_id, amount)
    values (v_tx, v_nu, -500000), (v_tx, v_davi, 500000);

  select balance into v_val from account_balances where account_id = v_nu;
  assert v_val = 1480000, format('CASO B FALLO: Nu = %s', v_val);
  select balance into v_val from account_balances where account_id = v_davi;
  assert v_val = 1500000, format('CASO B FALLO: Davivienda = %s', v_val);
  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes, 'CASO B FALLO: la transferencia altero el patrimonio';
  raise notice 'CASO B OK -> transferencia sin alterar el patrimonio (%)', v_val;

  -- ============ CASO C: prestar $1.000.000 a Juan desde Nu ===========
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  insert into transactions (owner_id, type, description, created_by)
    values (v_user, 'loan_out', 'Prestamo a Juan', v_user) returning id into v_tx;
  insert into transaction_entries (transaction_id, account_id, amount)
    values (v_tx, v_nu, -1000000), (v_tx, v_juan, 1000000);

  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes,
    format('CASO C FALLO: el patrimonio cambio de %s a %s', v_antes, v_val);
  raise notice 'CASO C OK -> patrimonio intacto tras prestar: %', v_val;

  -- ============ CASO D: Juan devuelve $200.000 a Nu ==================
  select nw.net_worth into v_antes from net_worth nw where nw.owner_id = v_user;

  insert into transactions (owner_id, type, description, created_by)
    values (v_user, 'loan_repay', 'Abono de Juan', v_user) returning id into v_tx;
  insert into transaction_entries (transaction_id, account_id, amount)
    values (v_tx, v_juan, -200000), (v_tx, v_nu, 200000);

  select balance into v_val from account_balances where account_id = v_juan;
  assert v_val = 800000, format('CASO D FALLO: por cobrar = %s', v_val);
  select nw.net_worth into v_val from net_worth nw where nw.owner_id = v_user;
  assert v_val = v_antes, 'CASO D FALLO: el abono inflo el patrimonio';
  raise notice 'CASO D OK -> por cobrar Juan = %, patrimonio intacto', v_val;

  -- ============ PRUEBA CLAVE: intentar CREAR dinero =================
  -- El trigger es DEFERRED (comprueba al cerrar la transaccion).
  -- SET CONSTRAINTS ALL IMMEDIATE lo obliga a comprobar aqui mismo.
  begin
    insert into transactions (owner_id, type, description, created_by)
      values (v_user, 'income', 'Dinero de la nada', v_user) returning id into v_tx;
    insert into transaction_entries (transaction_id, account_id, amount)
      values (v_tx, v_nu, 999999999);   -- una sola linea: no suma 0
    set constraints all immediate;
  exception when others then
    v_fallo := true;
    raise notice 'BLOQUEO OK -> la base de datos rechazo crear dinero';
  end;

  assert v_fallo, 'FALLO GRAVE: se pudo crear dinero de la nada';

  raise notice '=== TODAS LAS PRUEBAS PASARON ===';

  -- ---- Limpieza -----------------------------------------------------
  -- Orden importante: primero transacciones (arrastran sus lineas en
  -- cascada), luego cuentas, luego el usuario (arrastra el perfil).
  delete from transactions where owner_id = v_user;
  delete from accounts     where owner_id = v_user;
  delete from auth.users   where id       = v_user;
end;
$$;
