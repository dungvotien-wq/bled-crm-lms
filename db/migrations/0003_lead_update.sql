-- =====================================================================
-- BLED CRM + LMS — CẬP NHẬT MODULE LEAD (0003_lead_update)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001_init.sql và 0002_rls.sql.
-- An toàn chạy lại nhiều lần (idempotent ở mức hợp lý).
-- =====================================================================

-- 1) HÀM CHUẨN HOÁ SỐ ĐIỆN THOẠI -------------------------------------
-- Bỏ mọi ký tự không phải số; nếu bắt đầu bằng 84 (từ +84) thì đổi sang 0.
-- IMMUTABLE để dùng được trong unique index.
create or replace function normalize_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    else (
      select case
        when digits like '84%' and length(digits) >= 11 then '0' || substring(digits from 3)
        else digits
      end
      from (select regexp_replace(p, '[^0-9]', '', 'g') as digits) t
    )
  end
$$;

-- 2) CỘT MỚI TRÊN leads ----------------------------------------------
-- Vai trò người liên hệ: father/mother/guardian/student/other
alter table leads add column if not exists contact_role text;

-- Nhiều chương trình quan tâm (mảng text)
alter table leads add column if not exists programs text[] not null default '{}';

-- Chuẩn bị tái ghi danh (CHƯA dùng UI — TODO 3.2b)
alter table leads add column if not exists is_reenrollment boolean not null default false;
alter table leads add column if not exists previous_lead_id uuid references leads(id);

-- 3) DI TRÚ DỮ LIỆU CŨ: program_interest (text) -> programs (text[]) --
update leads
set programs = array[program_interest]
where program_interest is not null
  and btrim(program_interest) <> ''
  and (programs is null or programs = '{}');

-- 4) THÊM 'note' VÀO ENUM interaction_channel (để lưu ghi chú) --------
alter type interaction_channel add value if not exists 'note';

-- 5) CHỐNG TRÙNG SĐT TRONG CÙNG CHI NHÁNH ----------------------------
-- LƯU Ý: nếu đang có SĐT trùng (vd bấm "Tạo lead mẫu" nhiều lần), lệnh
-- tạo index dưới sẽ lỗi. Bỏ comment khối DEDUP bên dưới để dọn trước
-- (giữ lại bản ghi cũ nhất), rồi chạy lại.
--
-- ---- DEDUP (tuỳ chọn, cân nhắc kỹ trên dữ liệu thật) ----
-- delete from leads l
-- using leads keep
-- where l.id <> keep.id
--   and l.branch_id = keep.branch_id
--   and normalize_phone(l.phone) = normalize_phone(keep.phone)
--   and normalize_phone(l.phone) is not null
--   and normalize_phone(l.phone) <> ''
--   and l.created_at > keep.created_at;
-- --------------------------------------------------------

create unique index if not exists uniq_leads_branch_phone
  on leads (branch_id, normalize_phone(phone))
  where phone is not null and btrim(phone) <> '';

-- =====================================================================
-- HẾT 0003_lead_update
-- =====================================================================
