"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { canManageInvoices, canManualPriceOrHighDiscount } from "@/lib/permissions";
import {
  parseVndInput, computeLine, computeInvoiceStatus,
  MAX_DISCOUNT_PCT_BRANCH_MANAGER,
} from "@/lib/finance";
import { revalidatePath } from "next/cache";

export interface ActionResult { ok: boolean; error?: string }

export interface InvoiceInput {
  family_id: string;
  student_id?: string | null;
  program: string;
  period_type: string;
  description?: string;
  due_date?: string | null;
  discount_kind: "amount" | "pct";
  discount_value: string; // người dùng nhập
  discount_reason?: string;
  manual_price: boolean;
  manual_unit_price?: string;
  manual_price_reason?: string;
  // Snapshot chứng từ (nhập tay tới khi có 3.5)
  course_start?: string | null;
  course_end?: string | null;
  tuition_valid_until?: string | null;
  homeroom_teacher?: string | null;
  room_class?: string | null;
  campaign?: string | null;
}

function genCode(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return `HĐ-${yy}${mm}${dd}-${rnd}`;
}

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!canManageInvoices(user.role)) return { ok: false, error: "Bạn không có quyền tạo hóa đơn." };
  if (!input.family_id) return { ok: false, error: "Chưa chọn gia đình." };

  const supabase = createClient();
  const { data: fam } = await supabase.from("families").select("branch_id").eq("id", input.family_id).maybeSingle();
  if (!fam) return { ok: false, error: "Không tìm thấy gia đình." };
  const branchId = fam.branch_id;

  // 1) Đơn giá + thông tin sản phẩm (snapshot)
  let unitPrice: number;
  let quantity = 1;
  let unitLabel = "LẦN";
  let productCode: string | null = null;
  let tuitionPlanId: string | null = null;
  if (input.manual_price) {
    if (!canManualPriceOrHighDiscount(user.role))
      return { ok: false, error: "Chỉ CEO/Kế toán được dùng giá thủ công." };
    if (!input.manual_price_reason?.trim())
      return { ok: false, error: "Cần lý do cho giá thủ công." };
    unitPrice = parseVndInput(input.manual_unit_price ?? "");
    if (unitPrice <= 0) return { ok: false, error: "Đơn giá thủ công không hợp lệ." };
  } else {
    const { data: plans } = await supabase
      .from("tuition_plans")
      .select("id, branch_id, unit_price, unit_label, total_hours, product_code")
      .eq("program", input.program)
      .eq("period_type", input.period_type)
      .eq("active", true)
      .or(`branch_id.eq.${branchId},branch_id.is.null`);
    if (!plans || plans.length === 0)
      return { ok: false, error: `Chưa có bảng giá cho ${input.program} (${input.period_type}). Vào /pricing để thêm.` };
    const chosen = plans.find((p) => p.branch_id === branchId) ?? plans[0];
    unitPrice = Number(chosen.unit_price);
    quantity = chosen.total_hours && chosen.total_hours > 0 ? Number(chosen.total_hours) : 1;
    unitLabel = chosen.unit_label || "GIỜ";
    productCode = chosen.product_code ?? null;
    tuitionPlanId = chosen.id;
  }

  // 2) Tính dòng tiền: Thành tiền = SL×Giá − CK (số nguyên VND)
  const line = computeLine(quantity, unitPrice, input.discount_kind, input.discount_value);
  if (line.discount < 0) return { ok: false, error: "Giảm giá không hợp lệ." };
  if (line.discount > line.gross) return { ok: false, error: "Giảm giá không được vượt thành tiền." };
  if (line.discount > 0 && !input.discount_reason?.trim())
    return { ok: false, error: "Cần lý do giảm giá." };
  if (line.pct > MAX_DISCOUNT_PCT_BRANCH_MANAGER && !canManualPriceOrHighDiscount(user.role))
    return { ok: false, error: `Giảm giá vượt ${MAX_DISCOUNT_PCT_BRANCH_MANAGER}% cần CEO/Kế toán duyệt.` };

  const amount = line.amount;
  const status = computeInvoiceStatus(amount, 0, input.due_date ?? null);

  // 3) Tạo, retry nếu trùng code
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase.from("invoices").insert({
      branch_id: branchId,
      family_id: input.family_id,
      student_id: input.student_id || null,
      code: genCode(),
      description: input.description?.trim() || `${input.program} - ${input.period_type}`,
      amount,
      due_date: input.due_date || null,
      status,
      tuition_plan_id: tuitionPlanId,
      product_code: productCode,
      product_name: input.program,
      unit_label: unitLabel,
      quantity,
      unit_price: unitPrice,
      discount_percent: line.pct,
      discount_amount: line.discount,
      discount_reason: input.discount_reason?.trim() || null,
      course_start: input.course_start || null,
      course_end: input.course_end || null,
      tuition_valid_until: input.tuition_valid_until || null,
      homeroom_teacher: input.homeroom_teacher?.trim() || null,
      room_class: input.room_class?.trim() || null,
      campaign: input.campaign?.trim() || null,
      manual_price: input.manual_price,
      manual_price_reason: input.manual_price ? input.manual_price_reason?.trim() : null,
      manual_price_by: input.manual_price ? user.id : null,
    });
    if (!error) { revalidatePath("/finance"); return { ok: true }; }
    if (error.code !== "23505") return { ok: false, error: error.message };
  }
  return { ok: false, error: "Không sinh được số hóa đơn, thử lại." };
}

export interface PaymentInput {
  invoice_id: string;
  amount: string;
  method: string;
  ref_no?: string;
}

export async function addPayment(input: PaymentInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!canManageInvoices(user.role)) return { ok: false, error: "Bạn không có quyền ghi thanh toán." };

  const amt = parseVndInput(input.amount);
  if (amt <= 0) return { ok: false, error: "Số tiền không hợp lệ." };

  const supabase = createClient();
  const { data: inv } = await supabase
    .from("invoices").select("id, branch_id, amount, due_date, status").eq("id", input.invoice_id).maybeSingle();
  if (!inv) return { ok: false, error: "Không tìm thấy hóa đơn." };

  const { error } = await supabase.from("payments").insert({
    branch_id: inv.branch_id, invoice_id: inv.id, amount: amt,
    method: input.method, ref_no: input.ref_no?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };

  // Cập nhật trạng thái
  const { data: pays } = await supabase.from("payments").select("amount").eq("invoice_id", inv.id);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const status = computeInvoiceStatus(Number(inv.amount), paid, inv.due_date, inv.status);
  await supabase.from("invoices").update({ status }).eq("id", inv.id);

  // Thu đủ -> cấp số biên lai atomic (1 lần, theo chi nhánh)
  if (status === "paid") {
    await supabase.rpc("assign_receipt_no", { p_invoice: inv.id });
  }

  revalidatePath("/finance");
  return { ok: true };
}

// Dữ liệu mẫu: 4 hóa đơn đủ trạng thái, gắn vào gia đình/HV mẫu sẵn có.
export async function createSampleInvoices(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!canManageInvoices(user.role)) return { ok: false, error: "Bạn không có quyền." };

  const supabase = createClient();
  // Lấy 1 gia đình + học viên bất kỳ để gắn hóa đơn mẫu.
  const { data: fam } = await supabase.from("families").select("id, branch_id").limit(1).maybeSingle();
  if (!fam) return { ok: false, error: "Chưa có gia đình nào. Vào /families tạo gia đình mẫu trước." };
  const { data: stu } = await supabase.from("students").select("id").eq("family_id", fam.id).limit(1).maybeSingle();

  const today = new Date();
  const future = new Date(today); future.setDate(future.getDate() + 20);
  const past = new Date(today); past.setDate(past.getDate() - 10);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const samples = [
    { desc: "[MẪU] Học phí đã thu đủ", amount: 2000000, due: fmt(future), pay: 2000000 },
    { desc: "[MẪU] Học phí thu một phần", amount: 3000000, due: fmt(future), pay: 1000000 },
    { desc: "[MẪU] Học phí chưa thu", amount: 1800000, due: fmt(future), pay: 0 },
    { desc: "[MẪU] Học phí quá hạn", amount: 2500000, due: fmt(past), pay: 0 },
  ];

  for (const s of samples) {
    const status = computeInvoiceStatus(s.amount, s.pay, s.due);
    const { data: inv, error } = await supabase.from("invoices").insert({
      branch_id: fam.branch_id, family_id: fam.id, student_id: stu?.id ?? null,
      code: genCode(), description: s.desc, amount: s.amount, due_date: s.due, status,
      unit_price: s.amount, discount_amount: 0,
    }).select("id").single();
    if (error) return { ok: false, error: `Lỗi tạo hóa đơn mẫu: ${error.message}` };
    if (inv && s.pay > 0) {
      await supabase.from("payments").insert({
        branch_id: fam.branch_id, invoice_id: inv.id, amount: s.pay, method: "bank",
      });
    }
  }

  // --- Mẫu AMA: Smart Kid 6 / SK6 / 35 giờ / 98.958đ/giờ / ưu đãi -10% ---
  const qty = 35, price = 98958;
  const gross = Math.round(qty * price);          // 3.463.530
  const disc = Math.round(gross * 0.10);          // 346.353
  const amtAma = gross - disc;                     // 3.117.177
  const amaBase = {
    branch_id: fam.branch_id, family_id: fam.id, student_id: stu?.id ?? null,
    product_code: "SK6", product_name: "Smart Kid 6", unit_label: "GIỜ",
    quantity: qty, unit_price: price, discount_percent: 10, discount_amount: disc,
    discount_reason: "2 thành viên gia đình -10%", campaign: "Ưu đãi gia đình",
    homeroom_teacher: "Cô Mai", room_class: "SK6-A",
    course_start: fmt(today), course_end: fmt(future),
    tuition_valid_until: fmt(future), amount: amtAma,
  };
  // 1) Phiếu báo (chưa thu)
  await supabase.from("invoices").insert({
    ...amaBase, code: genCode(), description: "[MẪU] Smart Kid 6 - phiếu báo",
    due_date: fmt(future), status: "unpaid",
  });
  // 2) Biên lai (đã thu đủ) + cấp số biên lai
  const { data: amaPaid } = await supabase.from("invoices").insert({
    ...amaBase, code: genCode(), description: "[MẪU] Smart Kid 6 - biên lai",
    due_date: fmt(future), status: "paid",
  }).select("id").single();
  if (amaPaid) {
    await supabase.from("payments").insert({
      branch_id: fam.branch_id, invoice_id: amaPaid.id, amount: amtAma, method: "bank",
    });
    await supabase.rpc("assign_receipt_no", { p_invoice: amaPaid.id });
  }

  revalidatePath("/finance");
  return { ok: true };
}
