import { createAdminClient } from "@/lib/supabase-server";
import {
  computeInvoiceStatus, formatVnd, formatDate, STATUS_LABELS, STATUS_COLORS, type InvoiceStatus,
} from "@/lib/finance";

export const dynamic = "force-dynamic";

// Trang CÔNG KHAI — chỉ hiện thông tin xác thực, không lộ dữ liệu nhạy cảm.
export default async function VerifyPage({ params }: { params: { token: string } }) {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invoices")
    .select("id, code, receipt_no, amount, status, due_date, receipt_issued_at, product_name, family_id, student_id")
    .eq("verify_token", params.token)
    .maybeSingle<any>();

  if (!inv) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow">
          <div className="mb-3 text-3xl">❓</div>
          <h1 className="text-lg font-bold text-slate-800">Không tìm thấy chứng từ</h1>
          <p className="mt-2 text-sm text-slate-500">Mã xác thực không hợp lệ hoặc đã bị thu hồi.</p>
        </div>
      </main>
    );
  }

  // Tính số đã thu (chỉ để xác định trạng thái) — không hiển thị chi tiết thanh toán.
  const { data: pays } = await admin.from("payments").select("amount").eq("invoice_id", inv.id ?? "");
  // Lấy tên HV (chỉ tên, để xác thực)
  const { data: stu } = inv.student_id ? await admin.from("students").select("full_name").eq("id", inv.student_id).maybeSingle<any>() : { data: null };

  const paid = (pays ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const status = computeInvoiceStatus(Number(inv.amount), paid, inv.due_date, inv.status) as InvoiceStatus;
  const docCode = inv.receipt_no || inv.code;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow">
        <div className="mb-4 text-center">
          <div className="mb-2 text-3xl">✅</div>
          <h1 className="text-lg font-bold text-slate-800">Xác thực chứng từ học phí</h1>
          <p className="text-xs text-slate-400">BLED CRM — hệ thống xác thực công khai</p>
        </div>
        <dl className="space-y-2 text-sm">
          <Row label="Mã chứng từ" value={docCode} bold />
          <Row label="Học viên" value={stu?.full_name ?? "—"} />
          <Row label="Chương trình" value={inv.product_name ?? "—"} />
          <Row label="Số tiền" value={formatVnd(Number(inv.amount))} />
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Trạng thái</dt>
            <dd><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span></dd>
          </div>
          <Row label="Ngày thu" value={formatDate(inv.receipt_issued_at)} />
        </dl>
        <p className="mt-5 text-center text-xs text-slate-400">
          Chứng từ này được phát hành điện tử bởi hệ thống. Mọi thắc mắc liên hệ trung tâm.
        </p>
      </div>
    </main>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-dotted border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className={bold ? "font-bold text-slate-800" : "text-slate-700"}>{value}</dd>
    </div>
  );
}
