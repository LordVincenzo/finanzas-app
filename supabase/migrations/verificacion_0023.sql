-- =====================================================================
-- VERIFICACIÓN DE LA MIGRACIÓN 0023 — BANDEJA DE ENTRADA
--
-- Comprueba:
--   TOKEN          -> se guarda hasheado, nunca en claro
--   RECIBIR        -> un token válido deja un mensaje pendiente
--   TOKEN MALO     -> sin token válido no entra nada
--   DUPLICADO      -> la misma notificación repetida no se cuenta dos veces
--   MINUTO         -> el mismo texto en OTRO minuto sí entra
--   AISLAMIENTO    -> un token solo escribe en la bandeja de su dueño
--   REVOCAR        -> un token revocado deja de servir
--   CONFIRMAR      -> crea el movimiento Y marca el mensaje
--   DOS VECES      -> confirmar lo ya confirmado se rechaza
--   IGNORAR        -> no toca el ledger
--
-- Ejecutar en el SQL Editor después de 0023.
-- Al terminar borra todo lo que creó.
-- =====================================================================

do $$
declare
  v_a      uuid := gen_random_uuid();
  v_b      uuid := gen_random_uuid();
  v_mail_a text;
  v_mail_b text;
  v_tok_a  text;
  v_tok_b  text;
  v_nu     uuid;
  v_cat    uuid;
  v_msg    uuid;
  v_otro   uuid;
  v_tx     uuid;
  v_id_tok uuid;
  v_val    bigint;
  v_txt    text;
  v_falla  boolean;
  v_antes  bigint;
begin
  v_mail_a := 'ing_' || left(v_a::text, 8) || '@test.local';
  v_mail_b := 'ing_' || left(v_b::text, 8) || '@test.local';

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_a, v_mail_a, jsonb_build_object('display_name', 'Ingesta A')),
    (v_b, v_mail_b, jsonb_build_object('display_name', 'Ingesta B'));

  perform set_config('role', 'authenticated', true);

  -- ================= SESIÓN A: cuenta y token =======================
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  v_nu := crear_cuenta('Nu', 'digital_wallet', null, 1000000);

  select id into v_cat from accounts
   where owner_id = v_a and class = 'expense' and lower(name) = 'alimentación'
   limit 1;

  v_tok_a := crear_token_ingesta('Celular de prueba');
  assert length(v_tok_a) = 64,
    format('TOKEN FALLO: esperaba 64 caracteres, son %s', length(v_tok_a));

  -- El token NO puede estar guardado en claro en ningún sitio.
  select count(*) into v_val from ingest_tokens where token_hash = v_tok_a;
  assert v_val = 0, 'TOKEN FALLO: el token se guardo SIN hashear';

  select count(*) into v_val from ingest_tokens
   where token_hash = encode(sha256(convert_to(v_tok_a, 'UTF8')), 'hex');
  assert v_val = 1, 'TOKEN FALLO: no se guardo el hash';
  raise notice 'TOKEN OK -> 64 caracteres, guardado solo como hash';

  -- ================= RECIBIR =========================================
  -- Lo llama el celular, sin sesión: rol anon.
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);

  v_msg := recibir_ingesta(v_tok_a, 'nequi',
    'Pagaste $45.000 en EXITO', '2026-09-19 12:34:00-05');
  assert v_msg is not null, 'RECIBIR FALLO: no devolvio id';

  select estado::text into v_txt from ingest_messages where id = v_msg;
  assert v_txt = 'pendiente',
    format('RECIBIR FALLO: el mensaje entro como %s', v_txt);
  raise notice 'RECIBIR OK -> mensaje en la bandeja, pendiente';

  -- ================= TOKEN MALO ======================================
  v_falla := false;
  begin
    perform recibir_ingesta(
      'noesuntokenvalidoperotienelalongitudsuficiente12', 'nequi', 'Hola');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO GRAVE: acepto un token invalido';
  raise notice 'TOKEN MALO OK -> rechazado';

  -- ================= DUPLICADO =======================================
  -- La MISMA notificación, el mismo minuto: Android las reenvía.
  v_otro := recibir_ingesta(v_tok_a, 'nequi',
    'Pagaste $45.000 en EXITO', '2026-09-19 12:34:52-05');
  assert v_otro is null,
    'DUPLICADO FALLO: conto dos veces la misma notificacion';

  select count(*) into v_val from ingest_messages where owner_id = v_a;
  assert v_val = 1, format('DUPLICADO FALLO: hay %s mensajes', v_val);
  raise notice 'DUPLICADO OK -> el reenvio no se conto';

  -- El mismo texto en OTRO minuto sí es un gasto distinto.
  v_otro := recibir_ingesta(v_tok_a, 'nequi',
    'Pagaste $45.000 en EXITO', '2026-09-19 12:36:00-05');
  assert v_otro is not null,
    'MINUTO FALLO: descarto un gasto legitimo de otro minuto';
  raise notice 'MINUTO OK -> otro minuto entra como gasto distinto';

  -- ================= AISLAMIENTO =====================================
  -- El token de A no puede escribir en la bandeja de B.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_b::text, 'role', 'authenticated', 'email', v_mail_b)::text, true);
  v_tok_b := crear_token_ingesta('Celular de B');

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
  perform recibir_ingesta(v_tok_b, 'nu', 'Compra $10.000');

  select count(*) into v_val from ingest_messages where owner_id = v_b;
  assert v_val = 1, format('AISLAMIENTO FALLO: B tiene %s mensajes', v_val);

  select count(*) into v_val from ingest_messages where owner_id = v_a;
  assert v_val = 2,
    format('AISLAMIENTO FALLO: A deberia tener 2 y tiene %s', v_val);
  raise notice 'AISLAMIENTO OK -> cada token escribe solo en su bandeja';

  -- ================= REVOCAR =========================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  select id into v_id_tok from ingest_tokens where owner_id = v_a;
  perform revocar_token_ingesta(v_id_tok);

  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
  v_falla := false;
  begin
    perform recibir_ingesta(v_tok_a, 'nequi', 'Otro gasto cualquiera');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'REVOCAR FALLO: un token revocado siguio funcionando';
  raise notice 'REVOCAR OK -> el token revocado dejo de servir';

  -- ================= CONFIRMAR =======================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  select patrimonio into v_antes from patrimonio_detalle where owner_id = v_a;

  v_tx := confirmar_ingesta(v_msg, 'expense', 45000, v_nu, v_cat,
                            'Compra en Exito');
  assert v_tx is not null, 'CONFIRMAR FALLO: no devolvio la transaccion';

  select estado::text into v_txt from ingest_messages where id = v_msg;
  assert v_txt = 'confirmado',
    format('CONFIRMAR FALLO: el mensaje quedo en %s', v_txt);

  select transaction_id into v_otro from ingest_messages where id = v_msg;
  assert v_otro = v_tx, 'CONFIRMAR FALLO: no guardo el enlace al movimiento';

  select patrimonio into v_val from patrimonio_detalle where owner_id = v_a;
  assert v_val = v_antes - 45000,
    format('CONFIRMAR FALLO: patrimonio paso de %s a %s, esperaba %s',
           v_antes, v_val, v_antes - 45000);

  -- El movimiento se fecha cuando LLEGO la notificacion, no cuando se
  -- confirma.
  select occurred_on::text into v_txt from transactions where id = v_tx;
  assert v_txt = '2026-09-19',
    format('FECHA FALLO: el movimiento quedo el %s', v_txt);
  raise notice 'CONFIRMAR OK -> movimiento creado, fechado y enlazado';

  -- ================= NO DOS VECES ====================================
  v_falla := false;
  begin
    perform confirmar_ingesta(v_msg, 'expense', 45000, v_nu, v_cat, 'Otra vez');
  exception when others then v_falla := true;
  end;
  assert v_falla, 'FALLO GRAVE: dejo confirmar dos veces el mismo mensaje';
  raise notice 'DOS VECES OK -> rechazo confirmar lo ya confirmado';

  -- ================= IGNORAR =========================================
  select id into v_otro from ingest_messages
   where owner_id = v_a and estado = 'pendiente' limit 1;

  select patrimonio into v_antes from patrimonio_detalle where owner_id = v_a;
  perform ignorar_ingesta(v_otro);

  select patrimonio into v_val from patrimonio_detalle where owner_id = v_a;
  assert v_val = v_antes,
    format('IGNORAR FALLO: el patrimonio cambio de %s a %s', v_antes, v_val);

  select count(*) into v_val from bandeja_pendiente where owner_id = v_a;
  assert v_val = 0, format('IGNORAR FALLO: quedan %s pendientes', v_val);
  raise notice 'IGNORAR OK -> fuera de la bandeja y sin tocar el ledger';

  raise notice '=== TODAS LAS PRUEBAS DE 0023 PASARON ===';

  -- ---- Limpieza ----------------------------------------------------
  perform set_config('role', 'postgres', true);
  delete from ingest_messages where owner_id in (v_a, v_b);
  delete from ingest_tokens   where owner_id in (v_a, v_b);
  delete from transactions    where owner_id in (v_a, v_b);
  delete from accounts        where owner_id in (v_a, v_b);
  delete from auth.users      where id in (v_a, v_b);
end;
$$;
