-- =====================================================================
-- BLED CRM + LMS — SỐ HÓA CHỨNG TỪ HỌC PHÍ (0009_invoice_receipt)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001..0008. Idempotent.
-- =====================================================================

-- 1) BẢNG GIÁ: mã SP, đơn vị tính, tổng giờ ------------------------
alter table tuition_plans add column if not exists product_code text;
alter table tuition_plans add column if not exists unit_label   text not null default 'GIỜ';
alter table tuition_plans add column if not exists total_hours  int;

-- 2) ORG SETTINGS (thông tin công ty — 1 dòng) --------------------
create table if not exists org_settings (
  id           uuid primary key default gen_random_uuid(),
  company_name text,
  head_office  text,
  email        text,
  website      text,
  hotline      text,
  terms_url    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists trg_org_settings_updated on org_settings;
create trigger trg_org_settings_updated before update on org_settings
  for each row execute function set_updated_at();

insert into org_settings (company_name, head_office, email, website, hotline)
select 'Bao Linh Education', 'Trụ sở chính: (cập nhật)', 'info@bled.edu.vn', 'bled.edu.vn', '1900-xxxx'
where not exists (select 1 from org_settings);

alter table org_settings enable row level security;
drop policy if exists "org_settings_select" on org_settings;
create policy "org_settings_select" on org_settings for select using ( auth.uid() is not null );
drop policy if exists "org_settings_write" on org_settings;
create policy "org_settings_write" on org_settings for all
  using ( my_role() in ('ceo','accountant') ) with check ( my_role() in ('ceo','accountant') );

-- 3) BRANCHES: thương hiệu + số biên lai --------------------------
alter table branches add column if not exists logo_url        text;
alter table branches add column if not exists seal_url        text;   -- dấu trung tâm (PNG nền trong)
alter table branches add column if not exists paid_stamp_url  text;   -- dấu "ĐÃ THU TIỀN"
alter table branches add column if not exists bank_account    text;   -- số TK + tên + ngân hàng
alter table branches add column if not exists receipt_prefix  text not null default 'BL';
alter table branches add column if not exists last_receipt_seq int not null default 0;

-- Cho phép Kế toán sửa chi nhánh mình (cấu hình thương hiệu) -------
drop policy if exists "branches_update" on branches;
create policy "branches_update" on branches for update
  using ( is_ceo() or (my_role() = 'accountant' and id = my_branch_id()) );

-- 4) INVOICES: snapshot chứng từ ----------------------------------
alter table invoices add column if not exists product_code        text;
alter table invoices add column if not exists product_name        text;
alter table invoices add column if not exists unit_label          text;
alter table invoices add column if not exists quantity            numeric(10,2);
-- unit_price, discount_amount, discount_reason đã có ở 0008
alter table invoices add column if not exists discount_percent    numeric(5,2) not null default 0;
alter table invoices add column if not exists course_start        date;
alter table invoices add column if not exists course_end          date;
alter table invoices add column if not exists tuition_valid_until date;
alter table invoices add column if not exists homeroom_teacher    text;
alter table invoices add column if not exists room_class          text;
alter table invoices add column if not exists campaign            text;
alter table invoices add column if not exists receipt_no          text;
alter table invoices add column if not exists receipt_issued_at   timestamptz;
alter table invoices add column if not exists verify_token        text default encode(gen_random_bytes(16),'hex');

-- Backfill verify_token cho hóa đơn cũ
update invoices set verify_token = encode(gen_random_bytes(16),'hex') where verify_token is null;

create index if not exists idx_invoices_verify on invoices(verify_token);
-- receipt_no không trùng trong cùng chi nhánh
create unique index if not exists uniq_invoices_branch_receipt
  on invoices(branch_id, receipt_no) where receipt_no is not null;

-- 5) HÀM CẤP SỐ BIÊN LAI — ATOMIC theo chi nhánh ------------------
-- Khóa dòng branch, tăng last_receipt_seq, gán receipt_no 1 LẦN (không tái dùng).
create or replace function assign_receipt_no(p_invoice uuid)
returns text
language plpgsql
security definer
as $$
declare
  v_branch uuid;
  v_existing text;
  v_prefix text;
  v_seq int;
  v_no text;
begin
  select branch_id, receipt_no into v_branch, v_existing from invoices where id = p_invoice;
  if v_existing is not null then
    return v_existing;  -- đã cấp rồi, giữ nguyên
  end if;

  -- UPDATE branch khóa dòng -> an toàn đồng thời
  update branches
    set last_receipt_seq = coalesce(last_receipt_seq, 0) + 1
    where id = v_branch
    returning receipt_prefix, last_receipt_seq into v_prefix, v_seq;

  v_no := coalesce(v_prefix, 'BL') || lpad(v_seq::text, 5, '0');

  update invoices
    set receipt_no = v_no, receipt_issued_at = now()
    where id = p_invoice and receipt_no is null;

  return (select receipt_no from invoices where id = p_invoice);
end $$;

-- =====================================================================
-- HẾT 0009_invoice_receipt
-- =====================================================================
