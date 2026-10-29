-- 아이 냉장고 파먹기 · 가족 공유용 DB 설정
-- Supabase 대시보드 › SQL Editor › New query 에 전체를 붙여넣고 Run 을 누르세요. (한 번만 실행)

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default '우리 가족',
  invite_code text unique not null,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.family_members (
  family_id uuid not null references public.families on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

create table if not exists public.family_state (
  family_id uuid not null references public.families on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (family_id, key)
);

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.family_state enable row level security;

-- 내가 그 가족의 구성원인지 확인
create or replace function public.is_family_member(fid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.family_members where family_id = fid and user_id = auth.uid());
$$;

drop policy if exists "members read family" on public.families;
create policy "members read family" on public.families
  for select to authenticated using (public.is_family_member(id));

drop policy if exists "members read members" on public.family_members;
create policy "members read members" on public.family_members
  for select to authenticated using (public.is_family_member(family_id));

drop policy if exists "leave family" on public.family_members;
create policy "leave family" on public.family_members
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members use state" on public.family_state;
create policy "members use state" on public.family_state
  for all to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

-- 가족 만들기: 초대코드(6자리)를 만들고 나를 구성원으로 추가
create or replace function public.create_family(p_name text, p_display text)
returns json language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  loop
    v_code := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', ''), 1, 6));
    exit when length(v_code) = 6 and not exists (select 1 from families where invite_code = v_code);
  end loop;
  insert into families (name, invite_code, created_by) values (coalesce(nullif(p_name, ''), '우리 가족'), v_code, auth.uid())
    returning id into v_id;
  insert into family_members (family_id, user_id, display_name) values (v_id, auth.uid(), p_display);
  return json_build_object('id', v_id, 'invite_code', v_code);
end $$;

-- 초대코드로 참여하기
create or replace function public.join_family(p_code text, p_display text)
returns json language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  select id into v_id from families where invite_code = upper(trim(p_code));
  if v_id is null then raise exception 'invite code not found'; end if;
  insert into family_members (family_id, user_id, display_name) values (v_id, auth.uid(), p_display)
    on conflict (family_id, user_id) do update set display_name = excluded.display_name;
  return json_build_object('id', v_id);
end $$;

revoke all on function public.create_family(text, text) from public, anon;
revoke all on function public.join_family(text, text) from public, anon;
grant execute on function public.create_family(text, text) to authenticated;
grant execute on function public.join_family(text, text) to authenticated;

-- 실시간 동기화 켜기
do $$ begin
  alter publication supabase_realtime add table public.family_state;
exception when duplicate_object then null; end $$;
