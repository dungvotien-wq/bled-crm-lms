-- =====================================================================
-- BLED CRM + LMS — TÁCH HỌC VIÊN / NGƯỜI LIÊN HỆ (0005_lead_contact_split)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001, 0002, 0003. An toàn chạy lại (idempotent).
-- =====================================================================

-- 1) THÊM CỘT student_name -------------------------------------------
-- Tên học viên. Bản ghi CŨ để TRỐNG (Bob sẽ rà lại sau); contact_name
-- vẫn giữ tên người liên hệ như cũ.
alter table leads add column if not exists student_name text;

-- 2) BỎ UNIQUE INDEX CỨNG TRÊN SĐT (từ 0003) -------------------------
-- Vì 1 phụ huynh (1 SĐT) có thể có nhiều con → không được chặn cứng.
drop index if exists uniq_leads_branch_phone;

-- 3) INDEX THƯỜNG để tra cứu nhanh người liên hệ trùng SĐT -----------
create index if not exists idx_leads_branch_phone
  on leads (branch_id, normalize_phone(phone))
  where phone is not null and btrim(phone) <> '';

-- 4) UNIQUE MỀM: chỉ chặn TRÙNG THẬT --------------------------------
-- Trùng khi: cùng chi nhánh + cùng SĐT + cùng tên học viên.
-- (Anh/chị em cùng SĐT khác tên học viên VẪN tạo được.)
create unique index if not exists uniq_leads_branch_phone_student
  on leads (branch_id, normalize_phone(phone), lower(student_name))
  where phone is not null and btrim(phone) <> ''
    and student_name is not null and btrim(student_name) <> '';

-- =====================================================================
-- HẾT 0005_lead_contact_split
-- =====================================================================
