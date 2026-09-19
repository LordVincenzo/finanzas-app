-- =====================================================================
-- ¿POR QUÉ SALE EL PATRIMONIO EN 0?
--
-- No cambia nada. Mira tres cosas, en orden de probabilidad:
--
--   1. ¿Tiene la vista la columna `otros`? Si no, la app pide una
--      columna que no existe, Supabase devuelve error, y el código cae
--      al valor por defecto — que es 0.
--   2. ¿Puede leerla el rol `authenticated`? Un DROP VIEW se lleva por
--      delante los permisos de la vista, y hay que volver a darlos.
--   3. ¿Qué dice la vista de verdad para tu usuario?
-- =====================================================================

-- ---- 1. Las columnas de la vista ------------------------------------
select 'COLUMNAS' as que, string_agg(column_name, ', ' order by ordinal_position) as detalle
from information_schema.columns
where table_schema = 'public' and table_name = 'patrimonio_detalle'

union all

-- ---- 2. Quién puede leerla ------------------------------------------
select 'QUIEN PUEDE LEER',
       coalesce(string_agg(distinct grantee, ', '), 'NADIE — ese es el problema')
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'patrimonio_detalle'
  and privilege_type = 'SELECT'

union all

-- ---- 3. Cuántas filas hay en total ----------------------------------
-- Como superusuario del editor, sin RLS de por medio.
select 'FILAS EN LA VISTA', count(*)::text from patrimonio_detalle;


-- ---- 4. Tus cifras ---------------------------------------------------
-- Si la suma de las partes no da el patrimonio, algo quedó fuera.
select
  liquido, ahorros, inversiones, por_cobrar, otros, deudas, patrimonio,
  (liquido + ahorros + inversiones + por_cobrar + otros + deudas) as suma_de_partes,
  case
    when (liquido + ahorros + inversiones + por_cobrar + otros + deudas) = patrimonio
    then 'CUADRA'
    else 'NO CUADRA'
  end as comprobacion
from patrimonio_detalle;
