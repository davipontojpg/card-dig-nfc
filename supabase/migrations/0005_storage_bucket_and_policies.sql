-- ============================================================================
-- Migration 0005: Storage Bucket & Strict Multi-Tenant Media Policies
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-media',
  'menu-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_store_media(
  p_bucket_id text,
  p_object_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  v_folders text[];
  v_store_id uuid;
  v_folder text;
begin
  if p_bucket_id <> 'menu-media' or auth.uid() is null then
    return false;
  end if;

  if lower(coalesce(p_object_name, '')) !~ '^[^/]+/(products|branding)/[^/]+\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  v_folders := storage.foldername(p_object_name);
  if array_length(v_folders, 1) <> 2 then
    return false;
  end if;

  v_folder := v_folders[2];
  begin
    v_store_id := v_folders[1]::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  if public.is_platform_admin(auth.uid()) then
    return true;
  end if;

  return public.has_store_role(
    v_store_id,
    auth.uid(),
    case when v_folder = 'branding' then 'owner' else 'editor' end
  ) and public.store_has_service_access(v_store_id);
end;
$$;

revoke all on function public.can_manage_store_media(text, text) from public;
grant execute on function public.can_manage_store_media(text, text) to authenticated;

drop policy if exists "menu_media_public_read" on storage.objects;
create policy "menu_media_public_read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'menu-media');

drop policy if exists "menu_media_insert_authorized" on storage.objects;
create policy "menu_media_insert_authorized"
on storage.objects for insert to authenticated
with check (public.can_manage_store_media(bucket_id, name));

drop policy if exists "menu_media_update_authorized" on storage.objects;
create policy "menu_media_update_authorized"
on storage.objects for update to authenticated
using (public.can_manage_store_media(bucket_id, name))
with check (public.can_manage_store_media(bucket_id, name));

drop policy if exists "menu_media_delete_authorized" on storage.objects;
create policy "menu_media_delete_authorized"
on storage.objects for delete to authenticated
using (public.can_manage_store_media(bucket_id, name));

