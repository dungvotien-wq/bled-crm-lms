-- =====================================================================
-- BLED CRM + LMS — ROW LEVEL SECURITY (0002_rls)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ file → Run
-- Yêu cầu: đã chạy 0001_init.sql; auth.uid() = UUID của user trong
--          auth.users (Supabase Auth).
-- Logic:
--   CEO (branch_id IS NULL) → thấy tất cả.
--   Các vai trò khác → chỉ thấy dòng có branch_id = branch của mình.
-- =====================================================================

-- Hàm helper: lấy branch_id của user đang đăng nhập từ app_users
create or replace function my_branch_id()
returns uuid
language sql
security definer
stable
as $$
  select branch_id
  from app_users
  where email = (select email from auth.users where id = auth.uid())
  limit 1;
$$;

-- Hàm helper: kiểm tra user có phải CEO không (branch_id IS NULL)
create or replace function is_ceo()
returns boolean
language sql
security definer
stable
as $$
  select branch_id is null
  from app_users
  where email = (select email from auth.users where id = auth.uid())
  limit 1;
$$;

-- =====================================================================
-- BẬT RLS + POLICY cho các bảng có branch_id
-- =====================================================================

-- Macro pattern cho từng bảng:
--   SELECT: CEO thấy tất cả; còn lại chỉ thấy branch mình.
--   INSERT/UPDATE/DELETE: tương tự (chỉ cho phép trên branch mình,
--     CEO có thể làm trên mọi branch).

-- branches -------------------------------------------------------
alter table branches enable row level security;

create policy "branches_select"
  on branches for select
  using ( is_ceo() or id = my_branch_id() );

create policy "branches_insert"
  on branches for insert
  with check ( is_ceo() );

create policy "branches_update"
  on branches for update
  using ( is_ceo() );

create policy "branches_delete"
  on branches for delete
  using ( is_ceo() );

-- app_users -------------------------------------------------------
alter table app_users enable row level security;

-- User luôn thấy chính mình; CEO thấy tất cả; manager thấy trong branch.
create policy "app_users_select"
  on app_users for select
  using (
    email = (select email from auth.users where id = auth.uid())
    or is_ceo()
    or branch_id = my_branch_id()
  );

create policy "app_users_insert"
  on app_users for insert
  with check ( is_ceo() );

create policy "app_users_update"
  on app_users for update
  using (
    email = (select email from auth.users where id = auth.uid())
    or is_ceo()
  );

-- families -------------------------------------------------------
alter table families enable row level security;

create policy "families_select"
  on families for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "families_insert"
  on families for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "families_update"
  on families for update
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "families_delete"
  on families for delete
  using ( is_ceo() or branch_id = my_branch_id() );

-- leads ----------------------------------------------------------
alter table leads enable row level security;

create policy "leads_select"
  on leads for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "leads_insert"
  on leads for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "leads_update"
  on leads for update
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "leads_delete"
  on leads for delete
  using ( is_ceo() or branch_id = my_branch_id() );

-- students -------------------------------------------------------
alter table students enable row level security;

create policy "students_select"
  on students for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "students_insert"
  on students for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "students_update"
  on students for update
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "students_delete"
  on students for delete
  using ( is_ceo() or branch_id = my_branch_id() );

-- interactions ---------------------------------------------------
alter table interactions enable row level security;

create policy "interactions_select"
  on interactions for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "interactions_insert"
  on interactions for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

-- invoices -------------------------------------------------------
alter table invoices enable row level security;

create policy "invoices_select"
  on invoices for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "invoices_insert"
  on invoices for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "invoices_update"
  on invoices for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- payments -------------------------------------------------------
alter table payments enable row level security;

create policy "payments_select"
  on payments for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "payments_insert"
  on payments for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

-- teachers -------------------------------------------------------
alter table teachers enable row level security;

create policy "teachers_select"
  on teachers for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "teachers_insert"
  on teachers for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "teachers_update"
  on teachers for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- classes --------------------------------------------------------
alter table classes enable row level security;

create policy "classes_select"
  on classes for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "classes_insert"
  on classes for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "classes_update"
  on classes for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- enrollments ----------------------------------------------------
alter table enrollments enable row level security;

create policy "enrollments_select"
  on enrollments for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "enrollments_insert"
  on enrollments for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "enrollments_update"
  on enrollments for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- teaching_sessions ----------------------------------------------
alter table teaching_sessions enable row level security;

create policy "teaching_sessions_select"
  on teaching_sessions for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "teaching_sessions_insert"
  on teaching_sessions for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "teaching_sessions_update"
  on teaching_sessions for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- attendance_student ---------------------------------------------
alter table attendance_student enable row level security;

create policy "attendance_student_select"
  on attendance_student for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "attendance_student_insert"
  on attendance_student for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "attendance_student_update"
  on attendance_student for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- assessments ----------------------------------------------------
alter table assessments enable row level security;

create policy "assessments_select"
  on assessments for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "assessments_insert"
  on assessments for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

-- monthly_reports ------------------------------------------------
alter table monthly_reports enable row level security;

create policy "monthly_reports_select"
  on monthly_reports for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "monthly_reports_insert"
  on monthly_reports for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "monthly_reports_update"
  on monthly_reports for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- teacher_checkin ------------------------------------------------
alter table teacher_checkin enable row level security;

create policy "teacher_checkin_select"
  on teacher_checkin for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "teacher_checkin_insert"
  on teacher_checkin for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "teacher_checkin_update"
  on teacher_checkin for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- payroll_lines --------------------------------------------------
alter table payroll_lines enable row level security;

create policy "payroll_lines_select"
  on payroll_lines for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "payroll_lines_insert"
  on payroll_lines for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "payroll_lines_update"
  on payroll_lines for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- tqs_scores -----------------------------------------------------
alter table tqs_scores enable row level security;

create policy "tqs_scores_select"
  on tqs_scores for select
  using ( is_ceo() or branch_id = my_branch_id() );

create policy "tqs_scores_insert"
  on tqs_scores for insert
  with check ( is_ceo() or branch_id = my_branch_id() );

create policy "tqs_scores_update"
  on tqs_scores for update
  using ( is_ceo() or branch_id = my_branch_id() );

-- =====================================================================
-- HẾT 0002_rls
-- =====================================================================
