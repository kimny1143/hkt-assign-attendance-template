-- === Extensions ===
create extension if not exists postgis;
create extension if not exists pgcrypto;

-- === Enums ===
do $$ begin
  create type assignment_status as enum ('candidate','confirmed','declined','fallback');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

-- === Core Tables (no dependencies) ===

-- 会場マスタ
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

-- 役割マスタ（照明・リギング）
create table if not exists public.roles (
  id serial primary key,
  code text unique not null check (code in ('lighting','rigging')),
  label text
);

-- スタッフマスタ
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

-- === Tables with foreign keys ===

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

-- イベント
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

-- シフト
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

-- アサインメント
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

-- 勤怠記録
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

-- 経費
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendances(id) on delete cascade,
  kind text not null default 'transport',
  amount numeric(10,2) not null check (amount >= 0),
  receipt_url text,
  note text,
  created_at timestamptz default now()
);

-- 監査ログ
create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_user_id uuid,
  action text,
  table_name text,
  record_id uuid,
  diff jsonb,
  created_at timestamptz default now()
);

-- === インデックス ===
create index if not exists idx_equipment_qr_code on public.equipment(qr_code);
create index if not exists idx_equipment_venue_id on public.equipment(venue_id);
create index if not exists idx_attendances_staff_shift on public.attendances(staff_id, shift_id);
create index if not exists idx_events_date on public.events(event_date);
create index if not exists idx_shifts_event on public.shifts(event_id);
create index if not exists idx_assignments_shift on public.assignments(shift_id);
create index if not exists idx_assignments_staff on public.assignments(staff_id);

-- === RLS (Row Level Security) ===
alter table public.attendances enable row level security;
alter table public.expenses enable row level security;
alter table public.assignments enable row level security;
alter table public.staff enable row level security;
alter table public.equipment enable row level security;
alter table public.user_roles enable row level security;

-- スタッフが自分の勤怠を見る
create policy "Staff can view own attendance"
on public.attendances
for select
to authenticated
using (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

-- スタッフが自分の勤怠を登録
create policy "Staff can insert own attendance"
on public.attendances
for insert
to authenticated
with check (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

-- スタッフが自分の勤怠を更新
create policy "Staff can update own attendance"
on public.attendances
for update
to authenticated
using (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

-- 管理者は全ての勤怠を操作可能
create policy "Admin can manage all attendances"
on public.attendances
for all
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- スタッフが自分の経費を見る
create policy "Staff can view own expenses"
on public.expenses
for select
to authenticated
using (
  exists(
    select 1 from public.attendances a 
    join public.staff s on s.id = a.staff_id
    where a.id = expenses.attendance_id and s.user_id = auth.uid()
  )
);

-- スタッフが自分の経費を登録
create policy "Staff can insert own expenses"
on public.expenses
for insert
to authenticated
with check (
  exists(
    select 1 from public.attendances a 
    join public.staff s on s.id = a.staff_id
    where a.id = attendance_id and s.user_id = auth.uid()
  )
);

-- 管理者は全ての経費を操作可能
create policy "Admin can manage all expenses"
on public.expenses
for all
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- スタッフは自分のアサインメントを見る
create policy "Staff can view own assignments"
on public.assignments
for select
to authenticated
using (
  exists(select 1 from public.staff s where s.id = staff_id and s.user_id = auth.uid())
);

-- 管理者は全てのアサインメントを操作可能
create policy "Admin can manage all assignments"
on public.assignments
for all
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- スタッフは自分の情報を見る
create policy "Staff can view own profile"
on public.staff
for select
to authenticated
using (user_id = auth.uid());

-- 管理者は全てのスタッフ情報を操作可能
create policy "Admin can manage all staff"
on public.staff
for all
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- 全員が機材情報を見られる
create policy "Everyone can view equipment"
on public.equipment
for select
to authenticated
using (true);

-- 管理者のみ機材を管理
create policy "Admin can manage equipment"
on public.equipment
for all
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role in ('admin', 'manager')
  )
);

-- ユーザー権限は管理者のみ操作可能
create policy "Admin can manage user roles"
on public.user_roles
for all
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- === ビュー ===
create or replace view public.v_payroll_monthly as
select
  s.id as staff_id,
  s.code as staff_code,
  s.name as staff_name,
  date_trunc('month', sh.start_ts) as pay_month,
  count(distinct a.id) as attendance_count,
  sum(extract(epoch from (
    coalesce(a.check_out_ts, sh.end_ts) - coalesce(a.check_in_ts, sh.start_ts)
  )) / 3600) as total_hours,
  sum(e.amount) as transport_total,
  sum(
    case 
      when s.hourly_rate is not null then 
        s.hourly_rate * extract(epoch from (
          coalesce(a.check_out_ts, sh.end_ts) - coalesce(a.check_in_ts, sh.start_ts)
        )) / 3600
      when s.daily_rate is not null then 
        s.daily_rate
      else 0
    end
  ) as payment_amount,
  min(a.check_in_ts) as first_check_in,
  max(a.check_out_ts) as last_check_out
from public.staff s
join public.attendances a on a.staff_id = s.id
join public.shifts sh on sh.id = a.shift_id
left join public.expenses e on e.attendance_id = a.id and e.kind = 'transport'
where a.status = 'approved'
group by s.id, s.code, s.name, date_trunc('month', sh.start_ts);

-- === Functions ===
create or replace function public.attendance_punch_v2(
  p_staff_uid uuid,
  p_shift_id uuid,
  p_equipment_qr text,
  p_lat double precision,
  p_lon double precision,
  p_purpose text
) returns jsonb as $$
declare
  v_attendance_id uuid;
begin
  -- 打刻記録を更新または作成
  if p_purpose = 'checkin' then
    insert into attendances (
      staff_id, shift_id, 
      check_in_ts, check_in_lat, check_in_lon, check_in_equipment_qr
    ) values (
      p_staff_uid, p_shift_id,
      now(), p_lat, p_lon, p_equipment_qr
    )
    on conflict (staff_id, shift_id) 
    do update set
      check_in_ts = now(),
      check_in_lat = p_lat,
      check_in_lon = p_lon,
      check_in_equipment_qr = p_equipment_qr,
      updated_at = now()
    returning id into v_attendance_id;
  else -- checkout
    update attendances set
      check_out_ts = now(),
      check_out_lat = p_lat,
      check_out_lon = p_lon,
      check_out_equipment_qr = p_equipment_qr,
      updated_at = now()
    where staff_id = p_staff_uid and shift_id = p_shift_id
    returning id into v_attendance_id;
  end if;

  return jsonb_build_object(
    'attendance_id', v_attendance_id,
    'purpose', p_purpose,
    'timestamp', now()
  );
end;
$$ language plpgsql security definer;