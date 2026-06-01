-- =====================================================================
-- BLED CRM + LMS + CHẤM CÔNG — SCHEMA KHỞI TẠO (0001_init)
-- Cơ sở dữ liệu: PostgreSQL (Supabase)
-- Quy ước: mọi bảng có id (uuid), branch_id (đa chi nhánh),
--          created_at / updated_at.
-- Chạy: dán toàn bộ file này vào Supabase > SQL Editor > Run.
-- =====================================================================

create extension if not exists "pgcrypto";   -- để dùng gen_random_uuid()

-- Hàm tự cập nhật updated_at -----------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =====================================================================
-- NHÓM NỀN TẢNG
-- =====================================================================

-- Chi nhánh ----------------------------------------------------------
create table branches (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,          -- AMA1, AMA2, BIS...
  name        text not null,
  address     text,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Người dùng & phân quyền -------------------------------------------
-- Liên kết với Azure AD qua azure_oid (object id từ Microsoft 365)
create type user_role as enum
  ('ceo','branch_manager','cm','teacher','csr','accountant');

create table app_users (
  id          uuid primary key default gen_random_uuid(),
  azure_oid   text unique,                   -- object id từ Azure AD SSO
  email       text unique not null,
  full_name   text not null,
  role        user_role not null default 'csr',
  branch_id   uuid references branches(id),  -- null = toàn hệ thống (CEO)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- =====================================================================
-- NHÓM CRM
-- =====================================================================

-- Phụ huynh ----------------------------------------------------------
create type family_tier as enum ('vip','standard','watch');

create table families (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  parent_name   text not null,
  phone         text,
  email         text,
  zalo          text,
  facebook      text,
  address       text,
  tier          family_tier not null default 'standard',
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Lead (khách tiềm năng) --------------------------------------------
create type lead_source as enum ('zalo','facebook','web_form','walk_in','referral','other');
create type lead_stage  as enum ('new','consulting','test','registered','paid','lost');

create table leads (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  family_id     uuid references families(id),    -- gắn vào gia đình khi đã xác định
  contact_name  text not null,
  phone         text,
  source        lead_source not null default 'other',
  stage         lead_stage  not null default 'new',
  score         int not null default 0,          -- điểm tự động 0-100
  program_interest text,                          -- IELTS, Kids, BIS...
  assigned_to   uuid references app_users(id),    -- tư vấn viên phụ trách
  intake_date   date,                             -- ngày khai giảng dự kiến
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Học viên -----------------------------------------------------------
create table students (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  family_id     uuid not null references families(id),
  full_name     text not null,
  dob           date,
  gender        text,
  level         text,                             -- trình độ hiện tại
  status        text not null default 'active',   -- active / paused / left
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Lịch sử tương tác --------------------------------------------------
create type interaction_channel as enum ('zalo','facebook','email','call','in_person','teams');

create table interactions (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  family_id     uuid references families(id),
  lead_id       uuid references leads(id),
  channel       interaction_channel not null,
  summary       text not null,
  created_by    uuid references app_users(id),
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- NHÓM HỌC PHÍ & CÔNG NỢ
-- =====================================================================

create type invoice_status as enum ('unpaid','partial','paid','overdue','void');

create table invoices (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  family_id     uuid not null references families(id),
  student_id    uuid references students(id),
  code          text unique not null,             -- số hóa đơn
  description   text,
  amount        numeric(14,2) not null,           -- VND
  due_date      date,
  status        invoice_status not null default 'unpaid',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create type payment_method as enum ('cash','bank','vnpay','momo','other');

create table payments (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  invoice_id    uuid not null references invoices(id),
  amount        numeric(14,2) not null,
  method        payment_method not null default 'bank',
  paid_at       timestamptz not null default now(),
  ref_no        text,                             -- mã giao dịch đối soát
  created_at    timestamptz not null default now()
);

-- =====================================================================
-- NHÓM GIÁO VIÊN
-- =====================================================================

create type teacher_type as enum ('vn','gvnn');    -- GV Việt / GV nước ngoài

create table teachers (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  user_id       uuid references app_users(id),     -- liên kết tài khoản đăng nhập
  full_name     text not null,
  teacher_type  teacher_type not null default 'vn',
  hourly_rate   numeric(12,2) not null default 0,  -- đơn giá giờ chuẩn (VND)
  currency      text not null default 'VND',       -- GVNN có thể USD
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- =====================================================================
-- NHÓM LMS: LỚP, LỊCH, GHI DANH, ĐIỂM DANH
-- =====================================================================

create table classes (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  code          text not null,
  name          text not null,
  program       text,                             -- IELTS, Kids, BIS...
  teacher_id    uuid references teachers(id),     -- GV phụ trách chính
  start_date    date,
  end_date      date,
  status        text not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Ghi danh học viên vào lớp -----------------------------------------
create table enrollments (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  class_id      uuid not null references classes(id),
  student_id    uuid not null references students(id),
  enrolled_at   date not null default current_date,
  status        text not null default 'active',   -- active / completed / dropped
  created_at    timestamptz not null default now(),
  unique (class_id, student_id)
);

-- Buổi dạy (sinh tự động từ lịch lớp) -------------------------------
create type session_mode as enum ('offline','online');     -- online = qua Teams

create table teaching_sessions (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references branches(id),
  class_id        uuid not null references classes(id),
  teacher_id      uuid references teachers(id),
  session_date    date not null,
  planned_start   time not null,
  planned_end     time not null,
  mode            session_mode not null default 'offline',
  room            text,
  teams_meeting_url text,                          -- nếu online
  status          text not null default 'scheduled', -- scheduled/done/cancelled
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Điểm danh học viên -------------------------------------------------
create type attendance_status as enum ('present','absent','late','excused');

create table attendance_student (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  session_id    uuid not null references teaching_sessions(id),
  student_id    uuid not null references students(id),
  status        attendance_status not null default 'present',
  note          text,
  created_at    timestamptz not null default now(),
  unique (session_id, student_id)
);

-- Đánh giá / điểm số -------------------------------------------------
create table assessments (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  student_id    uuid not null references students(id),
  class_id      uuid references classes(id),
  title         text not null,
  score         numeric(5,2),
  max_score     numeric(5,2),
  comment       text,
  assessed_at   date not null default current_date,
  created_at    timestamptz not null default now()
);

-- Báo cáo tháng cho phụ huynh ---------------------------------------
create table monthly_reports (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  student_id    uuid not null references students(id),
  period        text not null,                    -- 'YYYY-MM'
  content       jsonb,                            -- dữ liệu tổng hợp
  file_url      text,                             -- link PDF/Word đã xuất
  status        text not null default 'draft',    -- draft/sent
  created_at    timestamptz not null default now(),
  unique (student_id, period)
);

-- =====================================================================
-- NHÓM CHẤM CÔNG GIÁO VIÊN (TỰ ĐỘNG) + TQS
-- =====================================================================

-- Check-in / check-out thực tế tại lớp ------------------------------
create table teacher_checkin (
  id            uuid primary key default gen_random_uuid(),
  branch_id     uuid not null references branches(id),
  session_id    uuid not null references teaching_sessions(id),
  teacher_id    uuid not null references teachers(id),
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  method        text not null default 'app',      -- app / qr / teams
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (session_id, teacher_id)
);

-- Dòng tính lương theo giờ (đối soát + phân loại) -------------------
create type hour_type as enum ('standard','makeup','substitute','online','offline');

create table payroll_lines (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references branches(id),
  teacher_id      uuid not null references teachers(id),
  session_id      uuid references teaching_sessions(id),
  period          text not null,                  -- 'YYYY-MM'
  planned_hours   numeric(6,2) not null default 0,
  actual_hours    numeric(6,2) not null default 0, -- từ check-in/out
  hour_type       hour_type not null default 'standard',
  unit_rate       numeric(12,2) not null default 0,
  amount          numeric(14,2) not null default 0, -- actual_hours * unit_rate
  variance_flag   boolean not null default false,  -- true nếu lệch giờ/thiếu check-in
  approved        boolean not null default false,
  approved_by     uuid references app_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Điểm TQS (Teacher Quality Score) ----------------------------------
-- A = tái ghi danh (50) | B = giữ chân (30) | C = giờ dạy (20)
create table tqs_scores (
  id              uuid primary key default gen_random_uuid(),
  branch_id       uuid not null references branches(id),
  teacher_id      uuid not null references teachers(id),
  period          text not null,                  -- 'YYYY-MM' hoặc 'YYYY-Qn'
  score_a         numeric(5,2) not null default 0, -- 0-50
  score_b         numeric(5,2) not null default 0, -- 0-30
  score_c         numeric(5,2) not null default 0, -- 0-20
  total           numeric(5,2) generated always as (score_a + score_b + score_c) stored,
  rating          text,                            -- green/yellow/red (tính ở app)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (teacher_id, period)
);

-- =====================================================================
-- TRIGGER updated_at cho các bảng có cột này
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'branches','app_users','families','leads','students','invoices',
    'teachers','classes','teaching_sessions','teacher_checkin',
    'payroll_lines','tqs_scores'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- =====================================================================
-- CHỈ MỤC tăng tốc truy vấn phổ biến
-- =====================================================================
create index idx_leads_branch_stage      on leads(branch_id, stage);
create index idx_students_family         on students(family_id);
create index idx_invoices_status         on invoices(branch_id, status);
create index idx_sessions_class_date     on teaching_sessions(class_id, session_date);
create index idx_attendance_session      on attendance_student(session_id);
create index idx_payroll_teacher_period  on payroll_lines(teacher_id, period);
create index idx_checkin_session         on teacher_checkin(session_id);

-- =====================================================================
-- HẾT 0001_init
-- =====================================================================
