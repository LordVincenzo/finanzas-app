-- =====================================================================
-- CORRECCIÓN 0006 — política de lectura de couples
--
-- Un INSERT ... RETURNING también aplica las políticas de SELECT.
-- Al crear la pareja todavía no eres miembro, así que la política
-- basada en current_couple_id() no te dejaba leer la fila que
-- acababas de crear.
--
-- Añadimos "o la creaste tú". No abre nada nuevo: sigues sin poder
-- ver parejas ajenas.
-- =====================================================================

drop policy if exists "mi pareja: leer" on couples;

create policy "mi pareja: leer"
  on couples for select
  using (
    id = public.current_couple_id()
    or created_by = (select auth.uid())
  );