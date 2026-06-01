-- =====================================================================
-- BLED CRM + LMS — HỒ SƠ GIA ĐÌNH (0007_family_update)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001, 0002, 0003, 0005, 0006. Idempotent.
-- =====================================================================

-- 1) CỘT contact_role cho families (đồng bộ với lead) ----------------
alter table families add column if not exists contact_role text;

-- 2) INDEX tra cứu nhanh theo SĐT chuẩn hoá -------------------------
create index if not exists idx_families_branch_phone
  on families (branch_id, normalize_phone(phone))
  where phone is not null and btrim(phone) <> '';

-- 3) UNIQUE CỨNG: 1 SĐT = 1 gia đình / chi nhánh --------------------
-- (Bob chọn: KHÔNG cho phép trùng SĐT gia đình.)
-- LƯU Ý: nếu đang có 2 gia đình cùng SĐT trong 1 chi nhánh, lệnh này sẽ
-- lỗi — cần gộp/sửa trước. Hiện dữ liệu mẫu seed chỉ 1 gia đình nên OK.
create unique index if not exists uniq_families_branch_phone
  on families (branch_id, normalize_phone(phone))
  where phone is not null and btrim(phone) <> '';

-- =====================================================================
-- HẾT 0007_family_update
-- =====================================================================
