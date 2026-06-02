-- =====================================================================
-- BLED CRM + LMS — LỚP & LỊCH HỌC (0010_classes_schedule)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001..0009. Idempotent.
-- =====================================================================

-- 0) teaching_sessions: tham chiếu buổi gốc khi học bù --------------
alter table teaching_sessions add column if not exists makeup_of uuid references teaching_sessions(id);

-- 1) MẪU LỊCH LẶP theo tuần của lớp ---------------------------------
create table if not exists class_schedules (
  id             uuid primary key default gen_random_uuid(),
  branch_id      uuid not null references branches(id),
  class_id       uuid not null references classes(id) on delete cascade,
  weekday        int  not null check (weekday between 0 and 6), -- 0=CN..6=T7
  planned_start  time not null,
  planned_end    time not null,
  mode           session_mode not null default 'offline',
  room           text,
  effective_from date,
  effective_to   date,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index if not exists idx_class_schedules_class on class_schedules(class_id);

-- 2) GV cấp LỚP (GV phụ mặc định) -----------------------------------
create table if not exists class_teachers (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references branches(id),
  class_id    uuid not null references classes(id) on delete cascade,
  teacher_id  uuid not null references teachers(id),
  role        text not null default 'assistant', -- main/assistant/gvnn/vn
  created_at  timestamptz not null default now(),
  unique (class_id, teacher_id)
);

-- 3) GÁN NHIỀU GV CHO 1 BUỔI ----------------------------------------
create table if not exists session_teachers (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid not null references branches(id),
  session_id  uuid not null references teaching_sessions(id) on delete cascade,
  teacher_id  uuid not null references teachers(id),
  role        text not null default 'main', -- main/assistant/gvnn/vn
  created_at  timestamptz not null default now(),
  unique (session_id, teacher_id)
);
create index if not exists idx_session_teachers_session on session_teachers(session_id);

-- 4) NGÀY NGHỈ (bỏ qua khi sinh buổi) -------------------------------
create table if not exists holidays (
  id          uuid primary key default gen_random_uuid(),
  branch_id   uuid references branches(id),   -- null = toàn hệ thống
  day         date not null,
  name        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_holidays_day on holidays(day);

-- =====================================================================
-- RLS — theo chi nhánh (CEO toàn hệ thống)
-- =====================================================================
alter table class_schedules enable row level security;
alter table class_teachers   enable row level security;
alter table session_teachers enable row level security;
alter table holidays         enable row level security;

-- class_schedules
drop policy if exists cs_all on class_schedules;
create policy cs_all on class_schedules for all
  using ( is_ceo() or branch_id = my_branch_id() )
  with check ( is_ceo() or branch_id = my_branch_id() );

-- class_teachers
drop policy if exists ct_all on class_teachers;
create policy ct_all on class_teachers for all
  using ( is_ceo() or branch_id = my_branch_id() )
  with check ( is_ceo() or branch_id = my_branch_id() );

-- session_teachers
drop policy if exists st_all on session_teachers;
create policy st_all on session_teachers for all
  using ( is_ceo() or branch_id = my_branch_id() )
  with check ( is_ceo() or branch_id = my_branch_id() );

-- holidays: xem được cả ngày nghỉ chung (null) + của chi nhánh; sửa thì
-- CEO làm mọi nơi, người khác chỉ chi nhánh mình.
drop policy if exists hol_select on holidays;
create policy hol_select on holidays for select
  using ( is_ceo() or branch_id is null or branch_id = my_branch_id() );
drop policy if exists hol_write on holidays;
create policy hol_write on holidays for all
  using ( is_ceo() or branch_id = my_branch_id() )
  with check ( is_ceo() or branch_id = my_branch_id() );

-- =====================================================================
-- HẾT 0010_classes_schedule
-- =====================================================================
