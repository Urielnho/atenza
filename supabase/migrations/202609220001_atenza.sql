create table public.atenza_profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  role text not null default 'member' check (role in ('member', 'admin', 'display'))
);
create table public.atenza_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);
create table public.atenza_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.atenza_profiles(id),
  kind text not null check (kind in ('entrada', 'salida')),
  created_at timestamptz not null default clock_timestamp()
);
create index on public.atenza_attendance(user_id, created_at desc);
create or replace function public.atenza_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.atenza_profiles(id, full_name) values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Usuario'), 120));
  return new;
end; $$;
create trigger atenza_user_created after insert on auth.users for each row execute function public.atenza_new_user();
create or replace function public.atenza_role() returns text language sql stable security definer set search_path = '' as $$ select role from public.atenza_profiles where id = auth.uid(); $$;
alter table public.atenza_profiles enable row level security;
alter table public.atenza_notices enable row level security;
alter table public.atenza_attendance enable row level security;
create policy profiles_read on public.atenza_profiles for select to authenticated using (id = auth.uid() or public.atenza_role() in ('admin', 'display'));
create policy notices_read on public.atenza_notices for select to authenticated using (true);
create policy notices_manage on public.atenza_notices for all to authenticated using (public.atenza_role() = 'admin') with check (public.atenza_role() = 'admin');
create policy attendance_read on public.atenza_attendance for select to authenticated using (user_id = auth.uid() or public.atenza_role() in ('admin', 'display'));
create or replace function public.atenza_check_in(p_kind text) returns uuid language plpgsql security definer set search_path = '' as $$
declare last_record public.atenza_attendance; result uuid;
begin
  if auth.uid() is null or public.atenza_role() is distinct from 'member' then raise exception 'Se requiere una cuenta de miembro.'; end if;
  if p_kind not in ('entrada', 'salida') or p_kind is null then raise exception 'Tipo de registro inválido.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into last_record from public.atenza_attendance where user_id = auth.uid() order by created_at desc limit 1;
  if last_record.kind = p_kind then raise exception 'Tu última operación ya fue una %. Registra la operación opuesta.', p_kind; end if;
  if last_record.id is null and p_kind = 'salida' then raise exception 'Primero registra una entrada.'; end if;
  if last_record.created_at > clock_timestamp() - interval '30 seconds' then raise exception 'Espera 30 segundos entre registros.'; end if;
  insert into public.atenza_attendance(user_id, kind) values (auth.uid(), p_kind) returning id into result;
  return result;
end; $$;
revoke all on public.atenza_profiles, public.atenza_notices, public.atenza_attendance from anon, authenticated;
grant select on public.atenza_profiles, public.atenza_notices, public.atenza_attendance to authenticated;
grant insert, update, delete on public.atenza_notices to authenticated;
revoke all on function public.atenza_check_in(text), public.atenza_role(), public.atenza_new_user() from public;
grant execute on function public.atenza_check_in(text), public.atenza_role() to authenticated;
alter publication supabase_realtime add table public.atenza_attendance, public.atenza_notices;
