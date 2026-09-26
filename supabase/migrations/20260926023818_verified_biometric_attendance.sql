-- The client can no longer skip either verification by calling the old RPC.
revoke execute on function public.atenza_check_in(text) from authenticated, anon, public;

-- Invoker rights: only the trusted local biometric service may execute this.
create or replace function public.atenza_verified_check_in(p_user uuid, p_kind text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare last_record public.atenza_attendance; result uuid;
begin
  if not exists (select 1 from public.atenza_profiles where id=p_user and role='member') then
    raise exception 'Se requiere una cuenta de usuario.';
  end if;
  if p_kind is null or p_kind not in ('entrada', 'salida') then raise exception 'Tipo de registro inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select * into last_record from public.atenza_attendance where user_id=p_user order by created_at desc limit 1;
  if last_record.kind=p_kind then raise exception 'Ya registraste tu %. Registra la operación opuesta.', p_kind; end if;
  if last_record.id is null and p_kind='salida' then raise exception 'Primero registra una entrada.'; end if;
  if last_record.created_at > clock_timestamp() - interval '30 seconds' then raise exception 'Espera 30 segundos entre registros.'; end if;
  insert into public.atenza_attendance(user_id,kind) values (p_user,p_kind) returning id into result;
  return result;
end; $$;
revoke all on function public.atenza_verified_check_in(uuid,text) from public, anon, authenticated;
grant execute on function public.atenza_verified_check_in(uuid,text) to service_role;
