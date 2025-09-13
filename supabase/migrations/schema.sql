-- === Extensions ===
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- === Tables ===
create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  lat double precision not null,
  lon double precision not null,
  geom geography(Point,4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,
  capacity integer,
  created_at timestamptz default now()
);

create table if not exists public.roles (
  id serial primary key,
  code text unique not null check (code in ('lighting','rigging')),
  label text
);

-- 機材テーブル（物理QRコード管理）
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  qr_code text unique not null,
  equipment_type text check (equipment_type in ('lighting','sound','rigging','stage','other')),
  location_hint text,
  active boolean default true,
  created_at timestamptz default now()
);

-- ユーザー権限テーブル
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  role text not null check (role in ('admin','manager','staff')),
  granted_at timestamptz default now(),
  granted_by uuid references public.staff(id),
  unique(staff_id, role)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_date date not null,
  open_time time,
  start_time time,
  end_time time,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  role_id int not null references public.roles(id),
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  required int not null default 1,
  created_at timestamptz default now(),
  constraint chk_shift_time check (end_ts > start_ts)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  code text unique,
  name text not null,
  phone text,
  email text,
  address text,
  lat double precision,
  lon double precision,
  skill_tags text[] default '{}',
  hourly_rate numeric(10,2),
  daily_rate numeric(10,2),
  project_rate numeric(10,2),
  active boolean default true,
  created_at timestamptz default now()
);

do $$ begin
  create type assignment_status as enum ('candidate','confirmed','declined','fallback');
exception when duplicate_object then null; end $$;

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.shifts(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  status assignment_status not null default 'candidate',
  score numeric(8,4),
  candidate_sent_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  created_at timestamptz default now(),
  unique (shift_id, staff_id)
);

do $$ begin
  create type attendance_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete restrict,
  shift_id uuid not null references public.shifts(id) on delete restrict,
  check_in_ts timestamptz,
  check_in_lat double precision,
  check_in_lon double precision,
  check_in_equipment_qr text,
  check_out_ts timestamptz,
  check_out_lat double precision,
  check_out_lon double precision,
  check_out_equipment_qr text,
  status attendance_status default 'pending',
  reviewer_id uuid,
  review_comment text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint uniq_one_attendance unique (staff_id, shift_id)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  kind text not null default 'transport',
  amount numeric(10,2) not null check (amount >= 0),
  receipt_url text,
  note text,
  created_at timestamptz default now()
);

-- qr_tokens table removed (using physical equipment QR instead)

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text,
  table_name text,
  record_id uuid,
  diff jsonb,
  created_at timestamptz default now()
);

-- === RLS ===
alter table public.attendances enable row level security;
alter table public.expenses     enable row level security;
alter table public.assignments  enable row level security;
alter table public.staff        enable row level security;

create or replace policy att_read_own on public.attendances
for select using (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

create or replace policy att_ins_own on public.attendances
for insert with check (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

create or replace policy att_upd_own on public.attendances
for update using (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

create or replace policy exp_read_own on public.expenses
for select using (
  exists(select 1
         from public.attendances a join public.staff s on s.id=a.staff_id
         where a.id = expenses.attendance_id and s.user_id = auth.uid())
);
create or replace policy exp_ins_own on public.expenses
for insert with check (
  exists(select 1
         from public.attendances a join public.staff s on s.id=a.staff_id
         where a.id = attendance_id and s.user_id = auth.uid())
);

create or replace policy admin_all_att on public.attendances
for all using (auth.jwt() ->> 'role' = 'admin');

create or replace policy admin_all_exp on public.expenses
for all using (auth.jwt() ->> 'role' = 'admin');

create or replace policy admin_all_assign on public.assignments
for all using (auth.jwt() ->> 'role' = 'admin');

create or replace policy staff_self on public.staff
for select using (user_id = auth.uid());
create or replace policy admin_staff on public.staff
for all using (auth.jwt() ->> 'role' = 'admin');

-- === View for CSV ===
create or replace view public.v_payroll_monthly as
select
  date_trunc('month', a.check_in_ts)::date as period_start,
  (date_trunc('month', a.check_in_ts) + interval '1 month - 1 day')::date as period_end,
  s.code as staff_code,
  s.name as staff_name,
  e.event_date as work_date,
  v.name as venue,
  r.code as role,
  a.check_in_ts::time as start_time,
  a.check_out_ts::time as end_time,
  greatest(0, extract(epoch from (coalesce(a.check_out_ts,a.check_in_ts) - a.check_in_ts))/3600.0) as worked_hours,
  coalesce((select sum(ex.amount) from public.expenses ex where ex.attendance_id = a.id),0) as transport_amount,
  coalesce(s.hourly_rate, s.project_rate, s.daily_rate, 0) as unit_price,
  (coalesce(s.hourly_rate,0) * greatest(0, extract(epoch from (coalesce(a.check_out_ts,a.check_in_ts) - a.check_in_ts))/3600.0))::numeric(12,2) as amount,
  a.status,
  a.id as attendance_id
from public.attendances a
join public.shifts sh on sh.id = a.shift_id
join public.events e on e.id = sh.event_id
join public.venues v on v.id = e.venue_id
join public.roles r on r.id = sh.role_id
join public.staff s on s.id = a.staff_id
where a.check_in_ts is not null;

-- === RPC ===
create or replace function public.attendance_punch(
  p_staff_uid uuid,
  p_shift_id uuid,
  p_lat double precision,
  p_lon double precision,
  p_qr_token text,
  p_photo_url text,
  p_purpose qr_purpose
) returns public.attendances
language plpgsql
security definer
as $$
declare
  v_staff_id uuid;
  v_att public.attendances;
  v_event_id uuid;
  v_venue_geom geography;
  v_now timestamptz := now();
  v_within boolean;
  v_qr_ok boolean;
  v_row public.attendances;
begin
  select id into v_staff_id from public.staff where user_id = p_staff_uid and active = true;
  if v_staff_id is null then
    raise exception 'staff not found or inactive';
  end if;

  select e.id, v.geom into v_event_id, v_venue_geom
  from public.shifts s
  join public.events e on e.id = s.event_id
  join public.venues v on v.id = e.venue_id
  where s.id = p_shift_id;

  if v_event_id is null then
    raise exception 'shift not found';
  end if;

  v_within := ST_DWithin(
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
    v_venue_geom,
    300
  );

  if not v_within then
    raise exception 'outside geofence (300m)';
  end if;

  if p_photo_url is null or length(p_photo_url) = 0 then
    raise exception 'photo required';
  end if;

  select exists(
    select 1 from public.qr_tokens qt
    join public.shifts s on s.id = qt.shift_id
    join public.events e on e.id = s.event_id
    where qt.token = p_qr_token
      and qt.shift_id = p_shift_id
      and qt.purpose = p_purpose
      and qt.issued_for_date = e.event_date
      and v_now <= qt.expires_at
  ) into v_qr_ok;

  if not v_qr_ok then
    raise exception 'qr token invalid or expired';
  end if;

  insert into public.attendances (staff_id, shift_id)
  values (v_staff_id, p_shift_id)
  on conflict (staff_id, shift_id) do nothing;

  select * into v_row from public.attendances
  where staff_id = v_staff_id and shift_id = p_shift_id for update;

  if p_purpose = 'checkin' then
    if v_row.check_in_ts is not null then
      raise exception 'already checked in';
    end if;
    update public.attendances
      set check_in_ts = v_now,
          check_in_lat = p_lat,
          check_in_lon = p_lon,
          check_in_photo_url = p_photo_url,
          check_in_qr_token = p_qr_token,
          updated_at = now()
    where id = v_row.id;
  else
    if v_row.check_out_ts is not null then
      raise exception 'already checked out';
    end if;
    update public.attendances
      set check_out_ts = v_now,
          check_out_lat = p_lat,
          check_out_lon = p_lon,
          check_out_photo_url = p_photo_url,
          check_out_qr_token = p_qr_token,
          updated_at = now()
    where id = v_row.id;
  end if;

  select * into v_att from public.attendances where id = v_row.id;
  return v_att;
end $$;