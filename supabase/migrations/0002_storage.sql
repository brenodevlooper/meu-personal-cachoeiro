-- Vídeos de execução e de "onde fica o aparelho".
-- Bucket público para leitura (vídeo de exercício não é dado pessoal);
-- só o personal sobe, troca ou apaga.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 52428800, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

create policy videos_personal_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and public.is_personal());
create policy videos_personal_update on storage.objects for update to authenticated
  using (bucket_id = 'videos' and public.is_personal());
create policy videos_personal_delete on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and public.is_personal());
