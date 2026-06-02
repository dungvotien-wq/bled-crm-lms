# TIẾN TRÌNH DỰ ÁN — BLED CRM + LMS

> File ghi nhớ để phiên Claude Code sau đọc lại ngữ cảnh. Cập nhật sau mỗi bước.

## Đã xong
- [x] **Bước 1 — Khung dự án**: Next.js + TS + Tailwind + Supabase client; trang kiểm tra kết nối (`app/page.tsx`); `.env.example`.
- [x] **Bước 2 — Schema database**: `db/migrations/0001_init.sql` (20 bảng: nền tảng, CRM, học phí, GV, LMS, chấm công, TQS) + `db/seed.sql` dữ liệu mẫu.

## Đã chạy thật & xác nhận hoạt động (31/05/2026)
- [x] `npm install` — 122 packages (đã set ExecutionPolicy RemoteSigned cho CurrentUser)
- [x] Project Supabase: tên `bled-crm-lms`, region Asia-Pacific (Tokyo), URL `https://qsbjpziwvlorycvbufxm.supabase.co`
- [x] Chạy `0001_init.sql` (Run without RLS) — 20 bảng OK
- [x] Chạy `seed.sql` — dữ liệu mẫu OK (email CEO đổi thành dzungvt@bled.edu.vn; đã fix ép kiểu enum ::user_role v.v.)
- [x] `.env.local` điền URL + anon key
- [x] `npm run dev` → localhost:3000 hiện "Đã kết nối Supabase ✅ / Số chi nhánh: 2"

## Đã chạy thật & xác nhận — Bước 3.1 (31/05/2026)
- [x] Cài `@supabase/ssr` (dùng `--legacy-peer-deps`)
- [x] Azure App registration: `BLED CRM LMS`, Client ID `83d4cfe4-...`, Tenant `9e00b27b-...`
      Redirect URI = `https://qsbjpziwvlorycvbufxm.supabase.co/auth/v1/callback`
- [x] Bật Azure provider trên Supabase Auth (Client ID/Secret + Tenant URL)
- [x] `.env.local` thêm: SERVICE_ROLE_KEY + AZURE_AD_CLIENT_ID/SECRET/TENANT_ID
- [x] Chạy `0002_rls.sql` — RLS BẬT trên các bảng có branch_id
- [x] Đăng nhập SSO thật OK → vào được `/me`
- Tài khoản CEO trong app_users: `dzungvt@bled.edu.vn` (seed) + `admin@bled.edu.vn` (thêm tay), cả hai role=ceo, branch_id=null
- Callback (`app/auth/callback/route.ts`) và `/me` tra cứu app_users bằng **admin client (service_role) + ilike** để bỏ qua RLS khi xác thực quyền — tránh phụ thuộc policy
- npm không có trong PATH; chạy qua `C:\Program Files\nodejs\npm.cmd`

## Đã làm — Bước 3.2: Module Quản lý Lead
- [x] Trang `/leads`: lọc (chi nhánh chỉ CEO, nguồn, trạng thái, người phụ trách) + tìm tên/SĐT
- [x] Kanban kéo-thả 6 cột (new→consulting→test→registered→paid→lost); kéo thẻ cập nhật stage trong DB ngay; mỗi cột hiện số lead + tổng điểm
- [x] Form thêm/sửa lead (validate tên + SĐT bắt buộc); lead mới tự gán branch người tạo (CEO chọn)
- [x] Nút "Tạo 5 lead mẫu" (gắn nhãn `[MẪU]`, không đụng dữ liệu thật)
- Thư viện kéo-thả: **@hello-pangea/dnd** (kế thừa react-beautiful-dnd, ổn định với React 18/Next.js)
- CÔNG THỨC chấm điểm ở **`lib/lead-score.ts`** (điểm nguồn + tương tác 30 ngày + giai đoạn, cap 100) — Bob sửa số trong file này
- File chính: `app/leads/{page,actions,LeadsClient,KanbanBoard,LeadTable,LeadForm}.tsx`, `lib/{auth,lead-score,leads-types}.ts`
- Mutations dùng session client → RLS tự lọc branch; tra cứu danh tính dùng admin client qua `lib/auth.ts`

## Đã làm — Bước 3.2 (điều chỉnh/bổ sung)
- [x] Kanban: mỗi cột hiện "x lead · TĐ y · TB z" (điểm trung bình)
- [x] Chống trùng SĐT trong cùng chi nhánh: chuẩn hoá (+84→0), cảnh báo + "Mở lead đó"; cảnh báo mềm tên gần giống. Chốt cuối: unique index DB.
- [x] Người liên hệ: thêm cột `contact_role` + dropdown vai trò (cha/mẹ/giám hộ/học viên/khác); nhãn "Tên người liên hệ"
- [x] Chương trình quan tâm: multi-select từ `lib/programs.ts`; lưu mảng `leads.programs text[]`; thẻ hiện tag
- [x] Ghi chú → nhật ký theo thời gian (bảng `interactions`, channel='note'); nút "Thêm ghi chú"; hiện mới nhất trên cùng
- [x] Ngày nhập: thẻ Kanban + bảng hiện "Nhập: dd/mm/yyyy"; danh sách sắp xếp theo ngày
- [x] Dữ liệu mẫu cập nhật: vai trò, nhiều chương trình, vài ghi chú có thời gian
- **Migration mới**: `db/migrations/0003_lead_update.sql` (hàm normalize_phone, cột contact_role/programs/is_reenrollment/previous_lead_id, enum 'note', unique index SĐT)
- File mới: `lib/programs.ts`, `lib/phone.ts`
- **TODO 3.2b — Tái ghi danh**: đã thêm cột `leads.is_reenrollment`, `leads.previous_lead_id` (chưa làm UI). Sau này: khi 1 học viên cũ quay lại, tạo lead mới trỏ `previous_lead_id` về lead/đăng ký trước, đánh dấu `is_reenrollment=true`, dùng cho điểm TQS phần A (tái ghi danh).

## Đã làm — Bước 3.2c: Tách Học viên / Người liên hệ
- [x] Thêm cột `leads.student_name` (form bắt buộc khi THÊM mới; khi SỬA bản ghi cũ cho để trống — Bob rà lại sau)
- [x] Bỏ unique index cứng SĐT (0003) → thay bằng index thường + unique MỀM `(branch_id, SĐT chuẩn hoá, lower(student_name))`
- [x] Chống trùng thông minh: (a) trùng SĐT + tên HV giống → TRÙNG THẬT (chặn); (b) trùng SĐT + tên HV khác → ANH/CHỊ EM (cho phép, báo mềm)
- [x] Form bố cục 4 dòng: Học viên|Chương trình · Người liên hệ|Vai trò · SĐT|Nguồn · Trạng thái|Phụ trách
- [x] Thẻ Kanban: tên HỌC VIÊN (to) + người liên hệ (nhỏ + vai trò); bảng có cột Học viên + Người liên hệ
- [x] Dữ liệu mẫu mới: cặp anh/chị em (0902000001: Bé Na/Bé Bi) + nền trùng thật (0902000002: Trần Minh Khôi)
- **Migration mới**: `db/migrations/0005_lead_contact_split.sql`
- **TODO 3.3** (ghi trong `actions.ts`): convert lead → families.parent_name / families.contact_role / students.full_name; nhiều lead cùng SĐT → 1 family nhiều students. Chưa làm UI.
- LƯU Ý: bản ghi lead CŨ có `student_name` trống, thẻ hiện "(chưa có tên HV)" — cần rà lại tên nào là HV / phụ huynh.

## Đã làm — Bước 3.2d: Người giới thiệu (nền affiliate)
- [x] Cột mới `leads`: `referrer_type` (none/family/student/external), `referrer_family_id`, `referrer_student_id`, `referrer_name`, `referrer_phone` + CHECK ràng buộc logic (external bắt buộc cả Tên + SĐT)
- [x] Form: mục "Người giới thiệu" — tra cứu families/students + người liên hệ trên các LEAD khác (nhãn "Liên hệ (lead)", chọn → lưu external). RLS theo chi nhánh, CEO toàn hệ thống; hoặc "nhập tay" (external); hiện người đã chọn + Bỏ chọn; nổi bật khi Nguồn = Giới thiệu
- LƯU Ý: trước khi có 3.3 (convert lead→family), phần lớn người giới thiệu sẽ nằm ở nhóm "Liên hệ (lead)" → lưu external. Sau 3.3 sẽ tìm thấy reference thật (family/student).
- [x] Thẻ Kanban hiện "🎁 Giới thiệu bởi: [tên] (Phụ huynh/Học viên/Ngoài)"
- [x] Dữ liệu mẫu: Bé Na (giới thiệu bởi phụ huynh có sẵn) + Lê Thị Mai (external "Cô Lan")
- **Migration mới**: `db/migrations/0006_lead_referrer.sql`
- **TODO affiliate** (trong `actions.ts`): bảng `referral_rewards` — thưởng = **VOUCHER HỌC PHÍ** (điều chỉnh sau), kích hoạt khi lead → 'paid'. Dữ liệu người giới thiệu đã sẵn ở `leads.referrer_*`. Chưa tạo bảng thưởng.

## Đã làm — Bước 3.3: Hồ sơ Gia đình & Học viên 360
- [x] `/families`: bảng (Tên PH · SĐT · Số con · Tier · Công nợ còn lại) + tìm tên/SĐT + lọc chi nhánh/tier
- [x] `/families/[id]` 360: thông tin liên hệ (+Sửa) · danh sách con (tuổi từ dob, lớp đang học, trạng thái) · công nợ (đã xuất/đã thu/còn nợ + hóa đơn) · dòng thời gian tương tác
- [x] Ghi nhanh tương tác (chọn kênh + summary → tự gán family_id + created_by + occurred_at)
- [x] Form thêm/sửa gia đình + thêm/sửa con; gia đình mới tự gán branch (CEO chọn)
- [x] Chống trùng gia đình theo SĐT chuẩn hoá (unique CỨNG 1 SĐT = 1 gia đình/chi nhánh) + cảnh báo "Mở gia đình đó"
- [x] Nút "Tạo gia đình mẫu" (2 gia đình + con + hóa đơn + tương tác, nhãn [MẪU])
- **Migration mới**: `db/migrations/0007_family_update.sql` (cột families.contact_role + index + unique SĐT)
- File: `lib/families-types.ts`, `app/families/{page,FamiliesClient,actions}.tsx`, `app/families/[id]/{page,FamilyDetail,FamilyForm,StudentForm,QuickInteraction}.tsx`
- Công nợ tính trong app từ invoices (trừ 'void') − payments; RLS lọc theo branch.

## Đã làm — Bước 3.4: Học phí & Công nợ + Bảng giá  (KẾT THÚC P0)
- [x] Bảng giá `tuition_plans` (migration 0008) + trang `/pricing` (CEO + Kế toán sửa); seed giá mẫu; RLS theo branch + role (my_role())
- [x] Tạo hóa đơn: chọn gia đình→HV→chương trình→kỳ→**tự lấy đơn giá từ bảng giá**; giảm giá (VND/%) + lý do; 3 dòng Đơn giá/Giảm/Phải thu; "giá thủ công" (CEO/Kế toán, có log manual_price_by)
- [x] Ghi thanh toán nhiều lần (payments); trạng thái **tự tính** (paid/partial/unpaid/overdue) trong `lib/finance.ts`
- [x] Trang `/finance`: lọc chi nhánh + "Ai còn nợ"; tổng đã xuất/đã thu/còn nợ; bảng chi tiết badge màu
- [x] Trang 360 (3.3) dùng chung `lib/finance.ts` → số khớp /finance
- [x] Quyền: tạo HĐ/thu = ceo+accountant+branch_manager; giá thủ công & giảm >20% = ceo+accountant (lib/permissions.ts); ngưỡng `MAX_DISCOUNT_PCT_BRANCH_MANAGER` ở lib/finance.ts
- [x] Ràng buộc DB (0008): amount>=0, discount<=unit_price, manual_price⇒có lý do; tiền là số nguyên VND (Math.round)
- [x] Dữ liệu mẫu: nút "Tạo hóa đơn mẫu" (đủ 4 trạng thái)
- **Migration mới**: `db/migrations/0008_pricing.sql`
- Menu: `/invoices` → đổi thành `/finance`; thêm `/pricing` (ceo+accountant)

## LƯU Ý quan trọng cho bước sau
- RLS đã BẬT. Test tính năng mới với cả CEO và role chi nhánh.
- Thứ tự migration: `0001`→`0002`→`0003`→`0005`→`0006`→`0007`→`0008`→`0009`.
- Quy tắc: CHẠY MIGRATION TRƯỚC rồi mới F5 (memory migration-then-code). "0 lead/trống" = quên migration, KHÔNG mất dữ liệu.
- Lỗi "Cannot find module './xxx.js'" = cache .next hỏng do OneDrive → xóa .next, chạy lại (memory next-cache-onedrive).
- TODO sau: convert lead → family+student; affiliate referral_rewards (voucher học phí).
- KHÔNG chạy `npm audit fix --force`.

## Đã làm — Bước 3.4b: Số hóa chứng từ học phí (biên lai/phiếu báo)
- [x] Chứng từ TỰ ĐỔI theo trạng thái: unpaid/overdue → PHIẾU BÁO; paid → BIÊN LAI + dấu số "ĐÃ THU TIỀN"; partial → BIÊN LAI (THU MỘT PHẦN)
- [x] Số biên lai ATOMIC theo chi nhánh: hàm DB `assign_receipt_no()` khóa dòng branch, `receipt_prefix + last_receipt_seq`; cấp 1 lần, không tái dùng (kể cả void)
- [x] Snapshot lúc tạo (giá không sai khi bảng giá đổi): product_code/name, unit_label, quantity(giờ), unit_price, discount_percent/amount/reason, course_start/end, tuition_valid_until, homeroom_teacher, room_class, campaign
- [x] Con dấu số: dùng ảnh `seal_url`/`paid_stamp_url` của chi nhánh; nếu trống → dấu CSS fallback
- [x] QR xác thực công khai `/verify/[token]` (verify_token ngẫu nhiên; đọc bằng admin client; chỉ field an toàn). Middleware mở `/verify`.
- [x] Layout chứng từ kiểu AMA: header/2 cột/bảng KHÔNG VAT (SL×Giá−CK)/2 mốc (Hạn TT vs Thời hạn học phí)/tổng/4 chữ ký/footer + QR
- [x] Hành động: In (window.print @media print A4) · Tải PDF (jspdf) · Tải ảnh PNG (html-to-image, pixelRatio 3) — tên `BienLai-[mã]-[tenHV].png`
- [x] Trang cấu hình `/settings/branch` (CEO+Kế toán): org_settings + logo/seal/stamp/bank/prefix từng chi nhánh
- [x] Dữ liệu mẫu AMA: Smart Kid 6 / SK6 / 35 giờ / 98.958đ/giờ / −10% ở 2 trạng thái (phiếu báo + biên lai có số)
- **Migration mới**: `db/migrations/0009_invoice_receipt.sql`
- **Thư viện**: qrcode (QR), html-to-image (PNG nét cao, tiếng Việt rõ), jspdf (PDF từ ảnh — tránh lỗi font)
- Trang: `/finance/[id]` (xem/in chứng từ); link từ bảng /finance

## ✅ GIAI ĐOẠN P0 HOÀN TẤT (3.1 → 3.4)
Auth+RLS · Lead Kanban · Hồ sơ Gia đình 360 · Học phí & Công nợ + Bảng giá.
Tiếp theo (P1): 3.5–3.6 Lớp học/Lịch dạy/Điểm danh · 3.7 Chấm công GV · 3.8 TQS · 3.9 Báo cáo tháng · 3.10 Teams · 3.11 Dashboard.

## Tiếp theo
- [x] **3.1** Đăng nhập Microsoft 365 (Azure AD SSO) + phân quyền theo vai trò
  - Bật Azure provider trên Supabase Auth (cần Client ID/Secret/Tenant từ Azure Portal)
  - Chạy `db/migrations/0002_rls.sql` trên Supabase SQL Editor
  - Điền `.env.local`: `SUPABASE_SERVICE_ROLE_KEY` + 3 biến `AZURE_AD_*`
- [x] **3.2** Quản lý Lead (Kanban) — xong
- [x] **3.3** Hồ sơ Phụ huynh & Học viên 360 — xong
- [x] **3.4** Học phí & Công nợ + Bảng giá — xong (KẾT THÚC P0)
- [ ] **3.5–3.9** LMS + Chấm công + TQS + Báo cáo tháng
- [ ] **3.10–3.11** Tích hợp Teams + Dashboard

## Deploy — GitHub + Vercel (02/06/2026) ✅ HOÀN THÀNH
- [x] `npm run build` local → thành công (9 route, 0 lỗi)
- [x] `.gitignore` loại trừ `.env.local`, `node_modules`, `.next`
- [x] GitHub repo public: `github.com/dungvotien-wq/bled-crm-lms`
- [x] Vercel deploy thành công — Status: Ready
- [x] **URL production**: `https://bled-crm-lms.vercel.app`
- [x] Supabase Auth → Site URL + Redirect URL cập nhật URL Vercel
- [x] Azure → Redirect URI: `https://bled-crm-lms.vercel.app/auth/callback` + `https://qsbjpziwvlorycvbufxm.supabase.co/auth/v1/callback`
- [x] Đăng nhập M365 trên Vercel URL hoạt động ✅
- **Ghi chú kỹ thuật**: `.npmrc` có `legacy-peer-deps=true` (conflict `@supabase/ssr`); git author phải dùng `dung.votien@gmail.com` để Vercel Hobby không block
- **Domain thật (DNS — CHƯA LÀM)**: sau khi có DNS, thêm `crm.bled.edu.vn` vào Vercel → Settings → Domains, trỏ CNAME record về `cname.vercel-dns.com`. Cập nhật Supabase Site URL + Azure Redirect URI sang domain mới.

## Ghi chú kỹ thuật
- Mọi bảng có `branch_id` để tách đa chi nhánh; lọc theo branch ở tầng app/RLS.
- Giờ dạy KHÔNG nhập tay: sinh từ `teaching_sessions` + `teacher_checkin` → `payroll_lines`.
- TQS: A(50)+B(30)+C(20); cột `total` tự tính trong DB.

## BACKLOG P2 — TÍCH HỢP & GỬI THÔNG BÁO (dịch vụ đã sẵn sàng)
- [ ] **Gửi hóa đơn tự động qua Zalo OA / ZNS** (Zalo Notification Service):
  - OA đã xác minh + ZNS đã có (Bob xác nhận 01/06/2026). Cần: template tin
    giao dịch duyệt trước, OA access token, chi phí theo tin.
  - Luồng: từ trang hóa đơn → nút "Gửi Zalo" → đẩy ZNS theo template (mã HĐ,
    HV, số tiền, hạn, link xem chi tiết). Log trạng thái gửi vào DB.
  - Trước khi có: branch admin xuất PDF/ảnh (3.4b) rồi gửi Zalo thủ công.
- [ ] Cùng nhóm P2: tích hợp MS Teams/Graph (3.10), Shifts → tính lương NV khác.

## YÊU CẦU NỘI DUNG HÓA ĐƠN IN/PDF (3.4b)
Bản in/PDF bắt buộc gồm: chi tiết khóa học (chương trình + cấp độ), SỐ GIỜ HỌC,
thời hạn hóa đơn (hạn thanh toán + thời hạn hiệu lực), ngoài các trường giá/
giảm/phải thu/đã thu/còn lại đã có.
- Số giờ học lấy từ bảng giá: thêm cột `total_hours` (+ tuỳ chọn `course_detail`)
  vào `tuition_plans` để tự điền lên hóa đơn (migration mới khi làm 3.4b).
- Khi có 3.5 (Lớp & Lịch học), số giờ thực tế có thể đối chiếu với lớp.

## 3.4b — CHỨNG TỪ HỌC PHÍ SỐ HÓA (thay quy trình in→đóng dấu→chụp→gửi)
Quy trình cũ: in → đóng dấu "ĐÃ THU TIỀN" tay → chụp ảnh → gửi Zalo (4 bước thủ công).
Giải pháp mới: 1 bản ghi hóa đơn, hệ thống tự đổi chứng từ theo status:
- unpaid/overdue → "PHIẾU BÁO HỌC PHÍ" (chưa có dấu, hiện Hạn thanh toán).
- paid → "BIÊN LAI HỌC PHÍ" + con dấu số "ĐÃ THU TIỀN" tự chèn.
- partial → "BIÊN LAI (THU MỘT PHẦN)" + còn lại.
Cải tiến: (1) con dấu số = ảnh PNG nền trong upload theo chi nhánh (dấu trung tâm
+ dấu ĐÃ THU TIỀN) → BỎ đóng dấu tay; (2) cấp receipt_no tự động khi xác nhận thu
tiền; (3) QR xác thực → trang công khai hiển thị mã+tiền+trạng thái (chống giả);
(4) 1 nút xuất ảnh PNG đúng trạng thái để gửi Zalo.
Layout theo mẫu AMA. VAT 0% (bỏ VAT). Hai mốc tách bạch: "Hạn thanh toán"
(due_date) và "THỜI HẠN HỌC PHÍ" (tuition_valid_until). Migration: 0009.

- receipt_no: đánh số theo TỪNG CHI NHÁNH (mỗi CN một dãy độc lập, prefix riêng), sinh atomic qua sequence/counter theo branch_id (tránh trùng khi thu đồng thời); số không tái dùng kể cả khi void.
