// =====================================================================
// TÀI CHÍNH — nguồn chân lý dùng chung cho /finance, /families/[id], /pricing.
// Mọi số tiền là SỐ NGUYÊN VND (tránh sai số dấu phẩy động).
// =====================================================================

export type InvoiceStatus = "unpaid" | "partial" | "paid" | "overdue" | "void";

// Ngưỡng giảm giá tối đa cho Quản lý chi nhánh (%). Vượt mức này cần CEO/Kế toán.
export const MAX_DISCOUNT_PCT_BRANCH_MANAGER = 20;

export const PERIOD_TYPES: { value: string; label: string }[] = [
  { value: "month", label: "Theo tháng" },
  { value: "course", label: "Theo khóa" },
  { value: "level", label: "Theo cấp độ (level)" },
  { value: "session", label: "Theo buổi" },
];

export function periodLabel(v: string): string {
  return PERIOD_TYPES.find((p) => p.value === v)?.label ?? v;
}

// Làm tròn về số nguyên VND.
export function roundVnd(n: number): number {
  return Math.round(n);
}

// Quy % giảm sang số tiền VND (đã làm tròn).
export function pctToVnd(unitPrice: number, pct: number): number {
  return roundVnd((unitPrice * pct) / 100);
}

// Số tiền cuối = đơn giá - giảm (không âm).
export function finalAmount(unitPrice: number, discount: number): number {
  return Math.max(0, roundVnd(unitPrice) - roundVnd(discount));
}

// Tính 1 dòng chứng từ: Thành tiền = SL×Giá − CK. CK nhập %/₫, tự suy ra cái kia.
// Mọi giá trị quy về số nguyên VND.
export function computeLine(
  quantity: number,
  unitPrice: number,
  discountKind: "amount" | "pct",
  discountValueRaw: string | number
): { gross: number; discount: number; pct: number; amount: number } {
  const q = quantity > 0 ? quantity : 1;
  const gross = roundVnd(q * unitPrice);
  let discount = 0;
  let pct = 0;
  if (discountKind === "pct") {
    pct = Number(String(discountValueRaw).replace(/[^0-9.]/g, "")) || 0;
    discount = pctToVnd(gross, pct);
  } else {
    discount = parseVndInput(String(discountValueRaw));
    pct = gross > 0 ? Math.round((discount / gross) * 10000) / 100 : 0;
  }
  discount = roundVnd(discount);
  const amount = Math.max(0, gross - discount);
  return { gross, discount, pct, amount };
}

// Định dạng tiền: 12.000.000 ₫
export function formatVnd(n: number): string {
  return (n ?? 0).toLocaleString("vi-VN") + " ₫";
}

// Đọc input người dùng ("12.000.000" / "12000000 đ") -> số nguyên VND.
export function parseVndInput(s: string): number {
  const digits = (s ?? "").replace(/[^0-9]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// -----------------------------------------------------------------------
// TRẠNG THÁI HÓA ĐƠN — tính động, KHÔNG nhập tay.
//  paid    : đã thu đủ
//  overdue : chưa thu đủ và đã quá hạn
//  partial : đã thu một phần (chưa quá hạn)
//  unpaid  : chưa thu, chưa tới hạn
//  void    : đã huỷ (giữ nguyên nếu DB đánh dấu void)
// -----------------------------------------------------------------------
export function computeInvoiceStatus(
  amount: number,
  paidTotal: number,
  dueDate: string | null,
  currentStatus?: string | null
): InvoiceStatus {
  if (currentStatus === "void") return "void";
  if (amount > 0 && paidTotal >= amount) return "paid";

  const overdue = !!dueDate && new Date(dueDate).getTime() < Date.now();
  if (overdue) return "overdue";
  if (paidTotal > 0) return "partial";
  return "unpaid";
}

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  unpaid: "Chưa thu",
  partial: "Thu một phần",
  paid: "Đã thu đủ",
  overdue: "Quá hạn",
  void: "Đã huỷ",
};

export const STATUS_COLORS: Record<InvoiceStatus, string> = {
  unpaid: "bg-slate-100 text-slate-700",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
  void: "bg-slate-200 text-slate-500",
};

// Tổng hợp công nợ từ danh sách hóa đơn (đã kèm số đã thu) — bỏ 'void'.
export function summarizeDebt(
  invoices: Array<{ amount: number; paid: number; status?: string | null }>
): { issued: number; paid: number; outstanding: number } {
  let issued = 0;
  let paid = 0;
  for (const inv of invoices) {
    if (inv.status === "void") continue;
    issued += inv.amount;
    paid += inv.paid;
  }
  return { issued, paid, outstanding: issued - paid };
}
