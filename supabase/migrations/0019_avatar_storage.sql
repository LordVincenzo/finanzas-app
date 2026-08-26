-- =====================================================================
-- 0019 — bucket de Storage para fotos de perfil
--
-- avatar_url ya existía en profiles desde el principio, pero ninguna
-- pantalla dejaba subir una foto. Este archivo crea el bucket y las
-- políticas: cada quien sube, reemplaza y borra solo su propia foto,
-- guardada como "<user_id>/avatar.<extensión>".
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- El path completo es "<user_id>/avatar.ext": storage.foldername(name)
-- devuelve las carpetas del path como array, así que la posición 1 es
-- el user_id. Comparar eso contra auth.uid() es lo que impide que
-- alguien suba o borre la foto de otra persona.

create policy "avatar propio: subir"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatar propio: reemplazar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatar propio: borrar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Bucket público de lectura (para poder mostrar <img src="..."> sin
-- pedir una URL firmada), pero declarar la política explícita no está
-- de más si algún día se lee vía API en vez de la URL pública directa.
create policy "avatares: cualquiera puede ver"
  on storage.objects for select
  using (bucket_id = 'avatars');
