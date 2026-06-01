# BLED CRM + LMS

Hệ thống quản lý học viên, quan hệ phụ huynh, học phí, lịch học và **chấm công giáo viên tự động** cho Bao Linh Education. Tích hợp Microsoft 365 / Teams.

**Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase (PostgreSQL).

---

## A. Cài đặt trên máy (làm 1 lần)

1. Cài **Node.js LTS**: https://nodejs.org
2. Mở thư mục này trong **VS Code** (hoặc Terminal), chạy:
   ```bash
   npm install
   ```

## B. Tạo database Supabase

1. Tạo tài khoản tại https://supabase.com → **New project** (đặt mật khẩu DB, lưu lại).
2. Vào **SQL Editor** → New query → dán toàn bộ nội dung `db/migrations/0001_init.sql` → **Run**.
3. (Tuỳ chọn) Dán tiếp `db/seed.sql` → **Run** để có dữ liệu mẫu.
4. Vào **Project Settings → API**, sao chép:
   - Project URL
   - anon public key
   - service_role key (bí mật)

## C. Cấu hình biến môi trường

1. Sao chép `.env.example` thành `.env.local`.
2. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` từ bước B4.

## D. Chạy thử

```bash
npm run dev
```
Mở http://localhost:3000 — nếu thấy "Đã kết nối Supabase ✅" và số chi nhánh, là thành công.

---

## Cấu trúc thư mục

```
bled-crm-lms/
├─ app/                 # Giao diện (Next.js App Router)
│  ├─ layout.tsx
│  ├─ page.tsx          # Trang kiểm tra kết nối
│  └─ globals.css
├─ lib/
│  └─ supabase.ts       # Kết nối database
├─ db/
│  ├─ migrations/
│  │  └─ 0001_init.sql  # Schema đầy đủ (CRM + LMS + Chấm công + TQS)
│  └─ seed.sql          # Dữ liệu mẫu
├─ .env.example
└─ package.json
```

## Bước tiếp theo (dùng Claude Code)
Xem `TIENTRINH.md` và cẩm nang prompt mẫu (file DOCX cùng dự án). Bước kế: **3.1 Đăng nhập Microsoft 365**.
