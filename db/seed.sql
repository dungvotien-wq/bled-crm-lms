-- =====================================================================
-- DỮ LIỆU MẪU (seed) — chạy SAU 0001_init.sql để thử nghiệm
-- Lưu ý: enum phải ép kiểu rõ ràng bằng ::tên_enum
-- Chạy 1 lần trên database trống. Nếu muốn chạy lại, xóa dữ liệu cũ trước.
-- =====================================================================

-- Chi nhánh
insert into branches (code, name, address) values
  ('AMA1', 'AMA Quảng Ngãi 1', 'TP Quảng Ngãi'),
  ('BIS',  'BIS Quảng Ngãi',   'TP Quảng Ngãi')
on conflict (code) do nothing;

-- Người dùng mẫu
insert into app_users (email, full_name, role, branch_id)
select 'dzungvt@bled.edu.vn', 'Bob (CEO)', 'ceo'::user_role, null
union all
select 'manager.ama1@bled.edu.vn', 'QL AMA1', 'branch_manager'::user_role,
       (select id from branches where code='AMA1')
on conflict (email) do nothing;

-- Giáo viên mẫu
insert into teachers (branch_id, full_name, teacher_type, hourly_rate, currency)
select id, 'Nguyễn Văn A', 'vn'::teacher_type, 200000, 'VND' from branches where code='AMA1'
union all
select id, 'John Smith', 'gvnn'::teacher_type, 25, 'USD' from branches where code='AMA1';

-- Gia đình + học viên mẫu
with f as (
  insert into families (branch_id, parent_name, phone, tier)
  select id, 'Phụ huynh Trần B', '0905000111', 'standard'::family_tier
  from branches where code='AMA1'
  returning id, branch_id
)
insert into students (branch_id, family_id, full_name, level)
select branch_id, id, 'Trần Bé B', 'Starter' from f;

-- Lead mẫu
insert into leads (branch_id, contact_name, phone, source, stage, score, program_interest)
select id, 'Phụ huynh Lê C', '0905000222', 'zalo'::lead_source, 'consulting'::lead_stage, 60, 'Kids'
from branches where code='AMA1';
