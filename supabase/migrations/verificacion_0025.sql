-- =====================================================================
-- VERIFICACIÓN DE LA 0025 — que la bandeja aprenda, y que no aprenda mal
--
-- CÓMO SE USA: pegar entero en Supabase -> SQL Editor y ejecutar. Hace
-- todo dentro de una transacción que termina en ROLLBACK, así que no
-- deja nada: ni usuarios, ni cuentas, ni movimientos.
--
-- Si algo falla, sale un ERROR con el número esperado y el que salió.
-- Si todo va bien, la última línea dice que pasó.
--
-- CUIDADO CON EL ROL DE LA SESIÓN. Las vistas son security_invoker y
-- las tablas tienen RLS, así que leer los datos de alguien con el
-- request.jwt.claims de otro devuelve NULL, no un dato equivocado. Eso
-- ya hizo fallar dos veces a los scripts de 0021 y 0023 por un fallo
-- del script, no del código. Aquí cada bloque pone sus claims antes de
-- mirar nada.
--
-- QUÉ COMPRUEBA:
--   1. normalizar_clave junta "ÉXITO", "exito  " y "Exito"
--   2. La primera notificación ya propone cuenta, por el nombre
--   3. No propone una cuenta solo porque el nombre la contenga dentro
--   4. Confirmar aprende fuente -> cuenta y comercio -> categoría
--   5. La segunda notificación del mismo comercio llega con categoría
--   6. Cambiar de opinión reescribe la regla
--   7. Sin dirección NO se aprende de la fuente (aprender al revés es
--      peor que no aprender)
--   8. En una transferencia no se aprende "el comercio es una cuenta"
--   9. Las dos notificaciones de una transferencia traen los dos lados
-- =====================================================================

begin;

do $$
declare
  v_a        uuid := gen_random_uuid();
  v_mail_a   text;

  v_nequi    uuid;
  v_nu       uuid;
  v_mercado  uuid;
  v_ocio     uuid;
  v_manuel   uuid;

  v_token    text;
  v_msg      uuid;
  v_otro     uuid;
  v_val      uuid;
  v_veces    int;
begin
  -- ---- Preparación -------------------------------------------------
  v_mail_a := 'ver25_' || left(v_a::text, 8) || '@test.local';

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_a, v_mail_a, jsonb_build_object('display_name', 'Prueba'));

  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_a::text, 'role', 'authenticated', 'email', v_mail_a)::text, true);

  -- Cuentas con nombres realistas.
  v_nequi := crear_cuenta('Nequi', 'digital_wallet', null, 0, 'private');
  v_nu    := crear_cuenta('Nu',    'digital_wallet', null, 0, 'private');
  -- La trampa del punto 3: contiene "nu" dentro, pero no es un banco.
  v_manuel := crear_cuenta('Prestamo a Manuel', 'other', null, 0, 'private');

  select a.id into v_mercado from accounts a
   where a.owner_id = v_a and a.class = 'expense'
   order by a.name limit 1;
  select a.id into v_ocio from accounts a
   where a.owner_id = v_a and a.class = 'expense' and a.id <> v_mercado
   order by a.name limit 1;

  if v_mercado is null or v_ocio is null then
    raise exception 'PREPARACION FALLO: hacen falta dos categorias de gasto';
  end if;

  v_token := crear_token_ingesta('Celular de prueba');

  -- ---- 1. Normalizar -----------------------------------------------
  if normalizar_clave('ÉXITO') <> 'exito'
     or normalizar_clave('  Exito  ') <> 'exito'
     or normalizar_clave('Éxito   Express') <> 'exito express' then
    raise exception 'NORMALIZAR FALLO: "%" / "%" / "%"',
      normalizar_clave('ÉXITO'), normalizar_clave('  Exito  '),
      normalizar_clave('Éxito   Express');
  end if;
  if normalizar_clave('   ') is not null then
    raise exception 'NORMALIZAR FALLO: el vacio deberia ser NULL';
  end if;
  raise notice '1 OK -> normalizar_clave junta las variantes';

  -- ---- 2. La primera ya propone cuenta -----------------------------
  -- Sin ninguna regla aprendida: sale del nombre de la cuenta.
  v_msg := recibir_ingesta(v_token, 'nequi',
    'Enviaste $20.000 en EXITO', now(), 20000, 'EXITO', 'salida');

  select m.cuenta_id into v_val from ingest_messages m where m.id = v_msg;
  if v_val is distinct from v_nequi then
    raise exception 'PROPUESTA FALLO: esperaba la cuenta Nequi, dio %', v_val;
  end if;

  select m.categoria_id into v_val from ingest_messages m where m.id = v_msg;
  if v_val is not null then
    raise exception 'PROPUESTA FALLO: no deberia proponer categoria la primera vez';
  end if;
  raise notice '2 OK -> primera notificacion, cuenta propuesta por el nombre';

  -- ---- 3. Sin falsos positivos por subcadena -----------------------
  -- "nu" está dentro de "Prestamo a Manuel". Si se buscara por
  -- subcadena, la fuente "nu" propondría esa cuenta.
  if cuenta_para_fuente(v_a, 'nu') is distinct from v_nu then
    raise exception 'SUBCADENA FALLO: la fuente "nu" dio %, esperaba la cuenta Nu (%)',
      cuenta_para_fuente(v_a, 'nu'), v_nu;
  end if;
  if cuenta_para_fuente(v_a, 'bancolombia') is not null then
    raise exception 'SUBCADENA FALLO: no hay cuenta de bancolombia, no deberia proponer nada';
  end if;
  raise notice '3 OK -> "nu" no encaja dentro de "Manuel"';

  -- ---- 4. Confirmar aprende ----------------------------------------
  perform confirmar_ingesta(v_msg, 'expense', 20000, v_nequi, v_mercado,
                            'Compra en EXITO');

  select r.cuenta_id into v_val from ingest_reglas r
   where r.owner_id = v_a and r.tipo = 'fuente' and r.clave = 'nequi';
  if v_val is distinct from v_nequi then
    raise exception 'APRENDER FALLO: la regla de fuente dio %, esperaba %', v_val, v_nequi;
  end if;

  select r.categoria_id into v_val from ingest_reglas r
   where r.owner_id = v_a and r.tipo = 'comercio' and r.clave = 'exito';
  if v_val is distinct from v_mercado then
    raise exception 'APRENDER FALLO: la regla de comercio dio %, esperaba %', v_val, v_mercado;
  end if;
  raise notice '4 OK -> aprendio fuente->cuenta y comercio->categoria';

  -- ---- 5. La segunda llega rellena ---------------------------------
  -- Con acentos y espacios distintos, para que valga lo de normalizar.
  v_msg := recibir_ingesta(v_token, 'nequi',
    'Enviaste $35.000 en Éxito', now(), 35000, '  Éxito ', 'salida');

  select m.cuenta_id, m.categoria_id into v_val, v_otro
  from ingest_messages m where m.id = v_msg;

  if v_val is distinct from v_nequi then
    raise exception 'SEGUNDA FALLO: cuenta propuesta %, esperaba %', v_val, v_nequi;
  end if;
  if v_otro is distinct from v_mercado then
    raise exception 'SEGUNDA FALLO: categoria propuesta %, esperaba %', v_otro, v_mercado;
  end if;
  raise notice '5 OK -> la segunda del mismo comercio llega con las dos puestas';

  -- ---- 6. Cambiar de opinión reescribe -----------------------------
  perform confirmar_ingesta(v_msg, 'expense', 35000, v_nequi, v_ocio,
                            'Esta vez fue ocio');

  select r.categoria_id into v_val from ingest_reglas r
   where r.owner_id = v_a and r.tipo = 'comercio' and r.clave = 'exito';
  if v_val is distinct from v_ocio then
    raise exception 'REESCRIBIR FALLO: la regla quedo en %, esperaba %', v_val, v_ocio;
  end if;

  select r.veces into v_veces from ingest_reglas r
   where r.owner_id = v_a and r.tipo = 'comercio' and r.clave = 'exito';
  if v_veces < 2 then
    raise exception 'REESCRIBIR FALLO: veces quedo en %, esperaba 2 o mas', v_veces;
  end if;
  raise notice '6 OK -> la ultima respuesta manda, sin pantalla de gestion';

  -- ---- 7. Sin dirección NO se aprende de la fuente -----------------
  -- Este es el que evita aprender al reves: sin saber si salio o entro,
  -- no se puede decir cual de las dos cuentas es la del banco.
  v_msg := recibir_ingesta(v_token, 'bancoraro',
    'Algo que ningun lector entiende', now(), null, null, null);

  perform confirmar_ingesta(v_msg, 'expense', 10000, v_nu, v_mercado, 'A mano');

  if exists (select 1 from ingest_reglas r
             where r.owner_id = v_a and r.tipo = 'fuente' and r.clave = 'bancoraro') then
    raise exception 'SIN DIRECCION FALLO: no deberia haber aprendido nada de la fuente';
  end if;
  raise notice '7 OK -> sin direccion no se aprende (mejor eso que al reves)';

  -- ---- 8. En transferencia no se aprende comercio->cuenta ----------
  v_msg := recibir_ingesta(v_token, 'nu',
    'Enviaste $50.000 a Bri***** Cas*****', now(), 50000, 'Bri***** Cas*****',
    'salida');
  perform confirmar_ingesta(v_msg, 'transfer', 50000, v_nu, v_nequi, 'A mi Nequi');

  select r.categoria_id into v_val from ingest_reglas r
   where r.owner_id = v_a and r.tipo = 'comercio'
     and r.clave = normalizar_clave('Bri***** Cas*****');
  if v_val is not null then
    raise exception 'TRANSFERENCIA FALLO: aprendio que un comercio es una cuenta (%)', v_val;
  end if;

  -- Pero la cuenta de la fuente SI, que ahi la direccion no miente.
  select r.cuenta_id into v_val from ingest_reglas r
   where r.owner_id = v_a and r.tipo = 'fuente' and r.clave = 'nu';
  if v_val is distinct from v_nu then
    raise exception 'TRANSFERENCIA FALLO: la fuente "nu" quedo en %, esperaba %', v_val, v_nu;
  end if;
  raise notice '8 OK -> en transferencia aprende la cuenta, no el "comercio"';

  -- ---- 9. Los dos lados de una transferencia -----------------------
  -- Nu dice que salio, Nequi dice que entro, mismo monto, dos minutos.
  v_msg  := recibir_ingesta(v_token, 'nu',
    'Enviaste $100,00', now(), 100, null, 'salida');
  v_otro := recibir_ingesta(v_token, 'nequi',
    'Te enviaron $100', now() + interval '2 minutes', 100, null, 'entrada');

  select b.pareja_cuenta_id into v_val
  from bandeja_pendiente b where b.id = v_msg;
  if v_val is distinct from v_nequi then
    raise exception 'PAREJA FALLO: desde Nu, el otro lado dio %, esperaba Nequi (%)',
      v_val, v_nequi;
  end if;

  select b.cuenta_id into v_val from bandeja_pendiente b where b.id = v_msg;
  if v_val is distinct from v_nu then
    raise exception 'PAREJA FALLO: desde Nu, su propia cuenta dio %, esperaba Nu (%)',
      v_val, v_nu;
  end if;
  raise notice '9 OK -> transferencia con los DOS lados resueltos, cero selectores';

  raise notice '';
  raise notice '=== LA 0025 PASA ===';
end $$;

rollback;
