-- =====================================================================
-- BLED CRM + LMS — BẢNG GIÁ HỌC PHÍ + HÓA ĐƠN (0008_pricing)
-- Chạy: Supabase Dashboard → SQL Editor → dán toàn bộ → Run.
-- Yêu cầu: đã chạy 0001..0007. Idempotent.
-- =====================================================================

-- 0) HÀM helper lấy role của user đăng nhập (cho RLS) ----------------
create or replace function my_role()
returns text
language sql
security definer
stable
as $$
  select role::text from app_users
  where email = (select email from auth.users where id = auth.uid())
  limit 1;
$$;

-- 1) BẢNG GIÁ HỌC PHÍ ------------------------------------------------
create table if not exists tuition_plans (
  id           uuid primary key default gen_random_uuid(),
  branch_id    uuid references branches(id),         -- null = áp dụng toàn hệ thống
  program      text not null,                        -- khớp lib/programs.ts
  period_type  text not null default 'month'
               check (period_type in ('month','course','level','session')),
  unit_price   numeric(14,0) not null check (unit_price >= 0), -- số nguyên VND
  active       boolean not null default true,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_tuition_plans_updated on tuition_plans;
create trigger trg_tuition_plans_updated before update on tuition_plans
  for each row execute function set_updated_at();

create index if not exists idx_tuition_plans_lookup
  on tuition_plans (branch_id, program, period_type) where active;

-- RLS bảng giá -------------------------------------------------------
alter table tuition_plans enable row level security;

drop policy if exists "tuition_plans_select" on tuition_plans;
create policy "tuition_plans_select" on tuition_plans for select
  using ( is_ceo() or branch_id is null or branch_id = my_branch_id() );

-- Chỉ CEO + Kế toán được thêm/sửa/xoá; Kế toán chỉ trong chi nhánh mình,
-- CEO làm trên mọi chi nhánh (kể cả giá chung branch_id null).
drop policy if exists "tuition_plans_insert" on tuition_plans;
create policy "tuition_plans_insert" on tuition_plans for insert
  with check ( my_role() in ('ceo','accountant') and (is_ceo() or branch_id = my_branch_id()) );

drop policy if exists "tuition_plans_update" on tuition_plans;
create policy "tuition_plans_update" on tuition_plans for update
  using ( my_role() in ('ceo','accountant') and (is_ceo() or branch_id = my_branch_id()) );

drop policy if exists "tuition_plans_delete" on tuition_plans;
create policy "tuition_plans_delete" on tuition_plans for delete
  using ( my_role() in ('ceo','accountant') and (is_ceo() or branch_id = my_branch_id()) );

-- 2) THÊM CỘT cho invoices ------------------------------------------
alter table invoices add column if not exists tuition_plan_id    uuid references tuition_plans(id);
alter table invoices add column if not exists unit_price         numeric(14,0);
alter table invoices add column if not exists discount_amount    numeric(14,0) not null default 0;
alter table invoices add column if not exists discount_reason    text;
alter table invoices add column if not exists manual_price       boolean not null default false;
alter table invoices add column if not exists manual_price_reason text;
alter table invoices add column if not exists manual_price_by    uuid references app_users(id);

-- 3) RÀNG BUỘC DỮ LIỆU ----------------------------------------------
-- amount không âm
alter table invoices drop constraint if exists chk_invoice_amount_nonneg;
alter table invoices add constraint chk_invoice_amount_nonneg check ( amount >= 0 );

-- giảm giá >= 0 và <= đơn giá (nếu có unit_price)
alter table invoices drop constraint if exists chk_invoice_discount;
alter table invoices add constraint chk_invoice_discount check (
  discount_amount >= 0 and (unit_price is null or discount_amount <= unit_price)
);

-- nếu giá thủ công thì bắt buộc có lý do
alter table invoices drop constraint if exists chk_invoice_manual_reason;
alter table invoices add constraint chk_invoice_manual_reason check (
  manual_price = false or (manual_price_reason is not null and btrim(manual_price_reason) <> '')
);

-- 4) SEED vài dòng giá mẫu (chỉ khi bảng giá còn trống) -------------
insert into tuition_plans (branch_id, program, period_type, unit_price, note)
select * from (values
  (null::uuid, 'IELTS',            'month',  2500000::numeric, 'Giá chung'),
  (null::uuid, 'IELTS',            'course', 12000000::numeric, 'Giá chung trọn khóa'),
  (null::uuid, 'Kids',             'month',  1800000::numeric, 'Giá chung'),
  (null::uuid, 'General English',  'month',  2000000::numeric, 'Giá chung'),
  (null::uuid, 'Cambridge',        'level',  6000000::numeric, 'Giá chung theo cấp độ'),
  (null::uuid, 'Flagship BIS',     'course', 18000000::numeric, 'Giá chung trọn khóa'),
  (null::uuid, 'Summer Camp',      'course', 5000000::numeric, 'Giá chung')
) v(branch_id, program, period_type, unit_price, note)
where not exists (select 1 from tuition_plans);

-- =====================================================================
-- HẾT 0008_pricing
-- =====================================================================
