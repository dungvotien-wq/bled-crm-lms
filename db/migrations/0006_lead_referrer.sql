-- =====================================================================
-- BLED CRM + LMS — NGƯỜI GIỚI THIỆU CHO LEAD (0006_lead_referrer)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001, 0002, 0003, 0005. An toàn chạy lại (idempotent).
-- Nền cho chương trình thưởng giới thiệu (affiliate) — xem TODO ở app.
-- =====================================================================

-- 1) CỘT MỚI ---------------------------------------------------------
-- Loại người giới thiệu: none | family | student | external
alter table leads add column if not exists referrer_type text not null default 'none';

-- Tham chiếu khi chọn từ DB
alter table leads add column if not exists referrer_family_id  uuid references families(id);
alter table leads add column if not exists referrer_student_id uuid references students(id);

-- Tên hiển thị (LUÔN lưu, kể cả khi chọn từ DB → hiện trên thẻ không cần join)
alter table leads add column if not exists referrer_name  text;
-- SĐT (bắt buộc khi external; để định danh khi chi thưởng)
alter table leads add column if not exists referrer_phone text;

-- 2) RÀNG BUỘC LOGIC -------------------------------------------------
-- family/student phải có id tương ứng; external phải có cả tên + SĐT.
alter table leads drop constraint if exists chk_lead_referrer;
alter table leads add constraint chk_lead_referrer check (
  referrer_type in ('none','family','student','external')
  and (
       (referrer_type = 'none')
    or (referrer_type = 'family'  and referrer_family_id  is not null)
    or (referrer_type = 'student' and referrer_student_id is not null)
    or (referrer_type = 'external'
        and referrer_name  is not null and btrim(referrer_name)  <> ''
        and referrer_phone is not null and btrim(referrer_phone) <> '')
  )
);

-- 3) CHỈ MỤC tra cứu theo người giới thiệu (phục vụ affiliate sau) ----
create index if not exists idx_leads_referrer_family  on leads (referrer_family_id);
create index if not exists idx_leads_referrer_student on leads (referrer_student_id);

-- =====================================================================
-- HẾT 0006_lead_referrer
-- =====================================================================
