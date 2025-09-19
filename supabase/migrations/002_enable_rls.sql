-- === 追加のRLS設定 ===

-- 残りのテーブルにもRLSを有効化
alter table public.audit_logs enable row level security;
alter table public.events enable row level security;
alter table public.roles enable row level security;
alter table public.shifts enable row level security;
alter table public.venues enable row level security;

-- === venues のポリシー ===
-- 全員が会場情報を閲覧可能
create policy "Anyone can view venues"
on public.venues
for select
to authenticated
using (true);

-- 管理者のみ会場を追加
create policy "Admin can insert venues"
on public.venues
for insert
to authenticated
with check (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- 管理者のみ会場を更新
create policy "Admin can update venues"
on public.venues
for update
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- 管理者のみ会場を削除
create policy "Admin can delete venues"
on public.venues
for delete
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- === events のポリシー ===
-- 全員がイベント情報を閲覧可能
create policy "Anyone can view events"
on public.events
for select
to authenticated
using (true);

-- 管理者とマネージャーがイベントを追加
create policy "Admin can insert events"
on public.events
for insert
to authenticated
with check (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role in ('admin', 'manager')
  )
);

-- 管理者とマネージャーがイベントを更新
create policy "Admin can update events"
on public.events
for update
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role in ('admin', 'manager')
  )
);

-- 管理者のみイベントを削除
create policy "Admin can delete events"
on public.events
for delete
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- === shifts のポリシー ===
-- 全員がシフト情報を閲覧可能
create policy "Anyone can view shifts"
on public.shifts
for select
to authenticated
using (true);

-- 管理者とマネージャーがシフトを追加
create policy "Admin can insert shifts"
on public.shifts
for insert
to authenticated
with check (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role in ('admin', 'manager')
  )
);

-- 管理者とマネージャーがシフトを更新
create policy "Admin can update shifts"
on public.shifts
for update
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role in ('admin', 'manager')
  )
);

-- 管理者のみシフトを削除
create policy "Admin can delete shifts"
on public.shifts
for delete
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- === roles のポリシー ===
-- 全員が役割マスタを閲覧可能
create policy "Anyone can view roles"
on public.roles
for select
to authenticated
using (true);

-- 管理者のみ役割を追加
create policy "Admin can insert roles"
on public.roles
for insert
to authenticated
with check (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- 管理者のみ役割を更新
create policy "Admin can update roles"
on public.roles
for update
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- 管理者のみ役割を削除
create policy "Admin can delete roles"
on public.roles
for delete
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- === audit_logs のポリシー ===
-- 管理者のみ監査ログを閲覧・管理可能
create policy "Admin can view audit logs"
on public.audit_logs
for select
to authenticated
using (
  exists(
    select 1 from public.user_roles ur 
    join public.staff s on s.id = ur.staff_id
    where s.user_id = auth.uid() and ur.role = 'admin'
  )
);

-- システムのみ監査ログを書き込み可能（service roleを使用）
create policy "System can insert audit logs"
on public.audit_logs
for insert
to authenticated
with check (false); -- 通常のユーザーは書き込み不可、service roleのみ