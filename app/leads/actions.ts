"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { computeLeadScore, INTERACTION_WINDOW_DAYS } from "@/lib/lead-score";
import { normalizePhone, namesSimilar } from "@/lib/phone";
import type {
  LeadSource, LeadStage, ContactRole, LeadNote, ReferrerType, ReferrerResult,
} from "@/lib/leads-types";
import { revalidatePath } from "next/cache";

// TODO 3.2b: luồng tái ghi danh — dùng cột leads.is_reenrollment +
// leads.previous_lead_id (đã có trong 0003) để tạo lead tái ghi danh trỏ về
// lead/đăng ký cũ; phục vụ điểm TQS phần A. Chưa xây UI ở bước này.
//
// TODO 3.3: convert lead -> family+student — khi chốt lead thành dữ liệu thật:
//   contact_name  -> families.parent_name
//   contact_role  -> families.contact_role
//   student_name  -> students.full_name
//   Nhiều lead cùng SĐT (chuẩn hoá) trong 1 chi nhánh -> CÙNG 1 family,
//   tạo nhiều students (anh/chị em). Chưa xây UI ở bước này.
//
// TODO affiliate: bảng referral_rewards (referrer [family/student/external],
//   lead_id, mốc thưởng khi lead -> 'paid', giá trị thưởng = VOUCHER HỌC PHÍ
//   (số tiền/điểm, có thể điều chỉnh sau), trạng thái chi thưởng). Dữ liệu
//   người giới thiệu đã lưu sẵn ở leads.referrer_* (0006). Chưa tạo bảng thưởng.

export interface LeadInput {
  id?: string;
  student_name?: string;
  contact_name: string;
  contact_role?: ContactRole | null;
  phone: string;
  source: LeadSource;
  stage: LeadStage;
  programs?: string[];
  assigned_to?: string | null;
  branch_id?: string; // chỉ CEO mới được truyền; vai trò khác bị bỏ qua
  // Người giới thiệu
  referrer_type?: ReferrerType;
  referrer_family_id?: string | null;
  referrer_student_id?: string | null;
  referrer_name?: string | null;
  referrer_phone?: string | null;
}

// Chuẩn hoá + kiểm tra dữ liệu người giới thiệu trước khi lưu.
function buildReferrer(
  input: LeadInput
): { ok: true; cols: Record<string, unknown> } | { ok: false; error: string } {
  const t: ReferrerType = input.referrer_type ?? "none";
  if (t === "none") {
    return { ok: true, cols: {
      referrer_type: "none", referrer_family_id: null, referrer_student_id: null,
      referrer_name: null, referrer_phone: null,
    } };
  }
  if (t === "family") {
    if (!input.referrer_family_id) return { ok: false, error: "Thiếu phụ huynh giới thiệu." };
    return { ok: true, cols: {
      referrer_type: "family", referrer_family_id: input.referrer_family_id,
      referrer_student_id: null, referrer_name: input.referrer_name ?? null,
      referrer_phone: input.referrer_phone ?? null,
    } };
  }
  if (t === "student") {
    if (!input.referrer_student_id) return { ok: false, error: "Thiếu học viên giới thiệu." };
    return { ok: true, cols: {
      referrer_type: "student", referrer_student_id: input.referrer_student_id,
      referrer_family_id: null, referrer_name: input.referrer_name ?? null,
      referrer_phone: input.referrer_phone ?? null,
    } };
  }
  // external — bắt buộc cả tên + SĐT
  if (!input.referrer_name?.trim()) return { ok: false, error: "Thiếu tên người giới thiệu." };
  if (!input.referrer_phone?.trim()) return { ok: false, error: "Thiếu SĐT người giới thiệu." };
  return { ok: true, cols: {
    referrer_type: "external", referrer_family_id: null, referrer_student_id: null,
    referrer_name: input.referrer_name.trim(), referrer_phone: input.referrer_phone.trim(),
  } };
}

// Tra cứu người giới thiệu trong families + students (RLS tự giới hạn chi nhánh).
export async function searchReferrers(query: string): Promise<ReferrerResult[]> {
  const q = query.replace(/[%,]/g, "").trim();
  if (q.length < 2) return [];
  const supabase = createClient();

  const { data: fams } = await supabase
    .from("families")
    .select("id, parent_name, phone, branches(name)")
    .or(`parent_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8);

  const { data: studs } = await supabase
    .from("students")
    .select("id, full_name, branches(name)")
    .ilike("full_name", `%${q}%`)
    .limit(8);

  // Cũng tìm trong người liên hệ trên các LEAD khác (chưa chốt thành family).
  // Chọn loại này -> lưu external (tên + SĐT).
  const { data: leadContacts } = await supabase
    .from("leads")
    .select("id, contact_name, student_name, phone, branches(name)")
    .or(`contact_name.ilike.%${q}%,student_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(8);

  const out: ReferrerResult[] = [];
  for (const f of fams ?? []) {
    out.push({
      kind: "family", id: (f as any).id, name: (f as any).parent_name,
      phone: (f as any).phone ?? null, branch_name: (f as any).branches?.name ?? null,
    });
  }
  for (const s of studs ?? []) {
    out.push({
      kind: "student", id: (s as any).id, name: (s as any).full_name,
      phone: null, branch_name: (s as any).branches?.name ?? null,
    });
  }
  // Khử trùng người liên hệ theo SĐT chuẩn hoá để tránh lặp anh/chị em.
  const seen = new Set<string>();
  for (const l of leadContacts ?? []) {
    const name = (l as any).contact_name as string;
    const phone = (l as any).phone as string | null;
    const key = normalizePhone(phone) + "|" + (name ?? "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      kind: "lead", id: (l as any).id, name,
      phone: phone ?? null, branch_name: (l as any).branches?.name ?? null,
    });
  }
  return out;
}

export interface DuplicateInfo {
  id: string;
  student_name: string | null;
  contact_name: string;
  stage: LeadStage;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  duplicate?: DuplicateInfo;
}

// Đếm số tương tác gần đây của 1 lead (trong cửa sổ ngày cấu hình).
async function countRecentInteractions(leadId: string): Promise<number> {
  const supabase = createClient();
  const since = new Date();
  since.setDate(since.getDate() - INTERACTION_WINDOW_DAYS);
  const { count } = await supabase
    .from("interactions")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", leadId)
    .gte("occurred_at", since.toISOString());
  return count ?? 0;
}

// Phân loại trùng theo SĐT trong cùng chi nhánh:
//  - "duplicate": cùng SĐT + tên học viên gần giống  -> TRÙNG THẬT (chặn)
//  - "sibling"  : cùng SĐT + tên học viên KHÁC        -> ANH/CHỊ EM (cho phép)
//  - null       : không trùng SĐT
async function classifyByPhone(
  branchId: string,
  phone: string,
  studentName: string,
  excludeId?: string
): Promise<{ kind: "duplicate" | "sibling"; info: DuplicateInfo } | null> {
  const target = normalizePhone(phone);
  if (!target) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, student_name, contact_name, stage, phone")
    .eq("branch_id", branchId);

  const samePhone = (data ?? []).filter(
    (l) => l.id !== excludeId && normalizePhone(l.phone) === target
  );
  if (samePhone.length === 0) return null;

  // Ưu tiên báo TRÙNG THẬT nếu có tên học viên gần giống.
  const realDup = samePhone.find((l) =>
    namesSimilar(l.student_name ?? "", studentName)
  );
  const chosen = realDup ?? samePhone[0];
  return {
    kind: realDup ? "duplicate" : "sibling",
    info: {
      id: chosen.id,
      student_name: chosen.student_name,
      contact_name: chosen.contact_name,
      stage: chosen.stage,
    },
  };
}

// Tạo lead mới ----------------------------------------------------------
export async function createLead(input: LeadInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!input.student_name?.trim()) return { ok: false, error: "Thiếu tên học viên." };
  if (!input.contact_name?.trim()) return { ok: false, error: "Thiếu tên người liên hệ." };
  if (!input.phone?.trim()) return { ok: false, error: "Thiếu số điện thoại." };

  const branchId = user.role === "ceo" ? input.branch_id : user.branch_id;
  if (!branchId) return { ok: false, error: "Chưa chọn chi nhánh." };

  // Chống trùng thông minh: chỉ chặn khi TRÙNG THẬT (cùng SĐT + tên HV giống).
  const cls = await classifyByPhone(branchId, input.phone, input.student_name);
  if (cls?.kind === "duplicate") {
    return {
      ok: false,
      error: "Học viên này (cùng SĐT) đã tồn tại trong chi nhánh.",
      duplicate: cls.info,
    };
  }

  const ref = buildReferrer(input);
  if (!ref.ok) return { ok: false, error: ref.error };

  const score = computeLeadScore({
    source: input.source,
    stage: input.stage,
    recentInteractions: 0,
  });

  const supabase = createClient();
  const { error } = await supabase.from("leads").insert({
    branch_id: branchId,
    student_name: input.student_name.trim(),
    contact_name: input.contact_name.trim(),
    contact_role: input.contact_role ?? null,
    phone: input.phone.trim(),
    source: input.source,
    stage: input.stage,
    score,
    programs: input.programs ?? [],
    assigned_to: input.assigned_to || null,
    ...ref.cols,
  });

  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "Học viên này (cùng SĐT) đã tồn tại trong chi nhánh." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/leads");
  return { ok: true };
}

// Cập nhật lead ---------------------------------------------------------
export async function updateLead(input: LeadInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!input.id) return { ok: false, error: "Thiếu mã lead." };
  if (!input.contact_name?.trim()) return { ok: false, error: "Thiếu tên người liên hệ." };
  if (!input.phone?.trim()) return { ok: false, error: "Thiếu số điện thoại." };
  // student_name có thể để trống khi sửa bản ghi cũ (Bob rà lại sau).

  const branchId = user.role === "ceo" ? input.branch_id : user.branch_id;
  if (branchId && input.student_name?.trim()) {
    const cls = await classifyByPhone(branchId, input.phone, input.student_name, input.id);
    if (cls?.kind === "duplicate") {
      return {
        ok: false,
        error: "Học viên này (cùng SĐT) đã tồn tại trong chi nhánh.",
        duplicate: cls.info,
      };
    }
  }

  const ref = buildReferrer(input);
  if (!ref.ok) return { ok: false, error: ref.error };

  const recent = await countRecentInteractions(input.id);
  const score = computeLeadScore({
    source: input.source,
    stage: input.stage,
    recentInteractions: recent,
  });

  const supabase = createClient();
  const { error } = await supabase
    .from("leads")
    .update({
      student_name: input.student_name?.trim() || null,
      contact_name: input.contact_name.trim(),
      contact_role: input.contact_role ?? null,
      phone: input.phone.trim(),
      source: input.source,
      stage: input.stage,
      score,
      programs: input.programs ?? [],
      assigned_to: input.assigned_to || null,
      ...ref.cols,
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "Học viên này (cùng SĐT) đã tồn tại trong chi nhánh." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/leads");
  return { ok: true };
}

// Đổi giai đoạn (kéo-thả Kanban) ---------------------------------------
export async function updateLeadStage(
  leadId: string,
  stage: LeadStage,
  source: LeadSource
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };

  const recent = await countRecentInteractions(leadId);
  const score = computeLeadScore({ source, stage, recentInteractions: recent });

  const supabase = createClient();
  const { error } = await supabase
    .from("leads")
    .update({ stage, score })
    .eq("id", leadId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/leads");
  return { ok: true };
}

// GHI CHÚ (nhật ký) — lưu vào bảng interactions, channel='note' ---------
export async function addLeadNote(leadId: string, summary: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!summary?.trim()) return { ok: false, error: "Ghi chú trống." };

  const supabase = createClient();
  // Lấy branch_id của lead để gắn cho interaction
  const { data: lead } = await supabase
    .from("leads")
    .select("branch_id, family_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Không tìm thấy lead." };

  const { error } = await supabase.from("interactions").insert({
    branch_id: lead.branch_id,
    family_id: lead.family_id ?? null,
    lead_id: leadId,
    channel: "note",
    summary: summary.trim(),
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message };
  // Cập nhật điểm vì số tương tác thay đổi
  const { data: l2 } = await supabase.from("leads").select("source, stage").eq("id", leadId).maybeSingle();
  if (l2) {
    const recent = await countRecentInteractions(leadId);
    const score = computeLeadScore({ source: l2.source, stage: l2.stage, recentInteractions: recent });
    await supabase.from("leads").update({ score }).eq("id", leadId);
  }
  revalidatePath("/leads");
  return { ok: true };
}

export async function getLeadNotes(leadId: string): Promise<LeadNote[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("interactions")
    .select("id, summary, occurred_at, created_by")
    .eq("lead_id", leadId)
    .eq("channel", "note")
    .order("occurred_at", { ascending: false });
  return (data ?? []) as LeadNote[];
}

// Tạo 5 lead mẫu (gắn nhãn [MẪU], vào branch hiện tại) ------------------
export async function createSampleLeads(branchIdArg?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };

  const supabase = createClient();
  let branchId = user.role === "ceo" ? branchIdArg : user.branch_id;
  if (!branchId) {
    const { data: b } = await supabase.from("branches").select("id").limit(1).single();
    branchId = b?.id;
  }
  if (!branchId) return { ok: false, error: "Không tìm thấy chi nhánh." };

  // Tìm 1 phụ huynh có sẵn trong chi nhánh để làm mẫu "giới thiệu bởi phụ huynh".
  const { data: famRef } = await supabase
    .from("families")
    .select("id, parent_name, phone")
    .eq("branch_id", branchId)
    .limit(1)
    .maybeSingle();

  const samples: Array<{
    student_name: string;
    contact_name: string;
    contact_role: ContactRole;
    phone: string;
    source: LeadSource;
    stage: LeadStage;
    programs: string[];
    referrer?: Record<string, unknown>;
  }> = [
    // Cặp ANH/CHỊ EM: cùng SĐT 0902000001, khác tên học viên -> luồng (b)
    // Bé Na: GIỚI THIỆU BỞI PHỤ HUYNH có sẵn (nếu tìm thấy famRef).
    { student_name: "[MẪU] Bé Na", contact_name: "Nguyễn Thị Hoa", contact_role: "mother", phone: "0902000001", source: "referral", stage: "new", programs: ["Kids"],
      referrer: famRef ? {
        referrer_type: "family", referrer_family_id: famRef.id,
        referrer_name: famRef.parent_name, referrer_phone: famRef.phone ?? null,
      } : undefined },
    { student_name: "[MẪU] Bé Bi", contact_name: "Nguyễn Thị Hoa", contact_role: "mother", phone: "0902000001", source: "referral", stage: "consulting", programs: ["Kids", "General English"] },
    // Nền cho TRÙNG THẬT: 0902000002 + "Trần Minh Khôi" -> thử thêm lại để test luồng (a)
    { student_name: "[MẪU] Trần Minh Khôi", contact_name: "Trần Văn Phú", contact_role: "father", phone: "0902000002", source: "facebook", stage: "test", programs: ["Cambridge"] },
    // Lê Thị Mai: GIỚI THIỆU BỞI NGƯỜI NGOÀI (external)
    { student_name: "[MẪU] Lê Thị Mai", contact_name: "Lê Văn Tâm", contact_role: "guardian", phone: "0903000003", source: "referral", stage: "registered", programs: ["Flagship BIS"],
      referrer: {
        referrer_type: "external", referrer_name: "Cô Lan (hàng xóm)", referrer_phone: "0906000777",
      } },
    { student_name: "[MẪU] Phạm Gia Bảo", contact_name: "Phạm Văn Dũng", contact_role: "father", phone: "0903000004", source: "walk_in", stage: "paid", programs: ["IELTS", "Summer Camp"] },
  ];

  for (const s of samples) {
    // Bấm lại không lỗi: bỏ qua nếu TRÙNG THẬT (cùng SĐT + tên HV).
    // Anh/chị em (cùng SĐT khác tên HV) vẫn được tạo bình thường.
    const cls = await classifyByPhone(branchId, s.phone, s.student_name);
    if (cls?.kind === "duplicate") continue;

    const { data: inserted, error } = await supabase
      .from("leads")
      .insert({
        branch_id: branchId,
        student_name: s.student_name,
        contact_name: s.contact_name,
        contact_role: s.contact_role,
        phone: s.phone,
        source: s.source,
        stage: s.stage,
        programs: s.programs,
        score: computeLeadScore({ source: s.source, stage: s.stage, recentInteractions: 0 }),
        ...(s.referrer ?? {}),
      })
      .select("id")
      .single();

    if (error) return { ok: false, error: `Lỗi tạo lead mẫu: ${error.message}` };
    if (!inserted) continue;

    // Thêm vài ghi chú mẫu có thời gian
    await supabase.from("interactions").insert([
      {
        branch_id: branchId,
        lead_id: inserted.id,
        channel: "note",
        summary: "Phụ huynh quan tâm, hẹn tư vấn cuối tuần.",
        created_by: user.id,
      },
      {
        branch_id: branchId,
        lead_id: inserted.id,
        channel: "note",
        summary: "Đã gọi điện, sẽ sắp xếp lịch test thử.",
        created_by: user.id,
      },
    ]);
  }

  revalidatePath("/leads");
  return { ok: true };
}
