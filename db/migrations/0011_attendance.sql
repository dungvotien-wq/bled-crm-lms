-- =====================================================================
-- BLED CRM + LMS — ĐIỂM DANH HV + CHECK-IN GV (0011_attendance)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001..0010. Idempotent.
-- =====================================================================

-- 1) teaching_sessions: chốt & khóa buổi ----------------------------
alter table teaching_sessions add column if not exists attendance_locked boolean not null default false;
alter table teaching_sessions add column if not exists locked_at   timestamptz;
alter table teaching_sessions add column if not exists locked_by   uuid references app_users(id);
alter table teaching_sessions add column if not exists reopened_at timestamptz;
alter table teaching_sessions add column if not exists reopened_by uuid references app_users(id);

-- 2) attendance_student: người/lúc điểm danh + cờ báo phụ huynh ------
alter table attendance_student add column if not exists taken_by uuid references app_users(id);
alter table attendance_student add column if not exists taken_at timestamptz;
alter table attendance_student add column if not exists parent_notify_flag boolean not null default false;
alter table attendance_student add column if not exists notify_status text not null default 'none'
  check (notify_status in ('none','pending','sent'));

create index if not exists idx_attendance_notify
  on attendance_student(branch_id, notify_status) where notify_status = 'pending';

-- RLS: các bảng attendance_student, teacher_checkin, teaching_sessions
-- đã bật RLS theo branch từ 0002 → cột mới tự được bảo vệ. Không cần thêm.

-- =====================================================================
-- HẾT 0011_attendance
-- =====================================================================
