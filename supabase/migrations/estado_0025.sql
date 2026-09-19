-- =====================================================================
-- ¿EN QUÉ ESTADO QUEDÓ LA 0025?
--
-- No cambia nada: solo mira qué piezas existen. Sirve cuando una
-- migración se corrió a medias, o dos veces, y uno ya no sabe qué hay.
--
-- Todas las filas tienen que decir SI. Si alguna dice NO, vuelve a
-- ejecutar 0025_la_bandeja_aprende.sql entera —ahora se puede repetir
-- sin romperse— y vuelve a mirar aquí.
-- =====================================================================

select 'tipo ingest_regla_tipo' as pieza,
       case when exists (select 1 from pg_type where typname = 'ingest_regla_tipo')
            then 'SI' else 'NO' end as existe
union all
select 'tabla ingest_reglas',
       case when to_regclass('public.ingest_reglas') is not null
            then 'SI' else 'NO' end
union all
select 'RLS activo en ingest_reglas',
       case when coalesce(
              (select c.relrowsecurity from pg_class c
                where c.oid = to_regclass('public.ingest_reglas')), false)
            then 'SI' else 'NO' end
union all
select 'politica "reglas propias"',
       case when exists (
              select 1 from pg_policies
               where schemaname = 'public' and tablename = 'ingest_reglas')
            then 'SI' else 'NO' end
union all
select 'funcion normalizar_clave',
       case when exists (select 1 from pg_proc p
                          join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'normalizar_clave')
            then 'SI' else 'NO' end
union all
select 'funcion cuenta_para_fuente',
       case when exists (select 1 from pg_proc p
                          join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'cuenta_para_fuente')
            then 'SI' else 'NO' end
union all
select 'funcion categoria_para_comercio',
       case when exists (select 1 from pg_proc p
                          join pg_namespace n on n.oid = p.pronamespace
                         where n.nspname = 'public' and p.proname = 'categoria_para_comercio')
            then 'SI' else 'NO' end
union all
-- La señal de que confirmar_ingesta es la NUEVA y no la de 0023: la
-- vieja no menciona ingest_reglas por ninguna parte.
select 'confirmar_ingesta ya aprende',
       case when exists (
              select 1 from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'confirmar_ingesta'
                 and pg_get_functiondef(p.oid) like '%ingest_reglas%')
            then 'SI' else 'NO' end
union all
select 'recibir_ingesta ya propone',
       case when exists (
              select 1 from pg_proc p
               join pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public' and p.proname = 'recibir_ingesta'
                 and pg_get_functiondef(p.oid) like '%cuenta_para_fuente%')
            then 'SI' else 'NO' end
union all
-- Lo que consulta la pantalla de la bandeja. Si falta esta columna, la
-- app da error al abrir "Por confirmar".
select 'vista con pareja_cuenta_id',
       case when exists (
              select 1 from information_schema.columns
               where table_schema = 'public'
                 and table_name = 'bandeja_pendiente'
                 and column_name = 'pareja_cuenta_id')
            then 'SI' else 'NO' end;
