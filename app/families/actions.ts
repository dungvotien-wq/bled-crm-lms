"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import type { FamilyTier, StudentStatus } from "@/lib/families-types";
import type { ContactRole } from "@/lib/leads-types";
import { revalidatePath } from "next/cache";

export interface ActionResult {
  ok: boolean;
  error?: string;
  duplicate?: { id: string; parent_name: string };
  id?: string;
}

export interface FamilyInput {
  id?: string;
  parent_name: string;
  contact_role?: ContactRole | null;
  phone: string;
  email?: string;
  zalo?: string;
  facebook?: string;
  address?: string;
  tier?: FamilyTier;
  note?: string;
  branch_id?: string; // CEO chọn; vai trò khác bỏ qua
}

export interface StudentInput {
  id?: string;
  family_id: string;
  full_name: string;
  dob?: string | null;
  gender?: string | null;
  level?: string | null;
  status?: StudentStatus;
}

// Tìm gia đình trùng SĐT (chuẩn hoá) trong cùng chi nhánh.
async function findFamilyDuplicate(
  branchId: string,
  phone: string,
  excludeId?: string
): Promise<{ id: string; parent_name: string } | null> {
  const target = normalizePhone(phone);
  if (!target) return null;
  const supabase = createClient();
  const { data } = await supabase
    .from("families")
    .select("id, parent_name, phone")
    .eq("branch_id", branchId);
  const hit = (data ?? []).find(
    (f) => f.id !== excludeId && normalizePhone(f.phone) === target
  );
  return hit ? { id: hit.id, parent_name: hit.parent_name } : null;
}

// ---- GIA ĐÌNH ---------------------------------------------------------
export async function createFamily(input: FamilyInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!input.parent_name?.trim()) return { ok: false, error: "Thiếu tên phụ huynh." };
  if (!input.phone?.trim()) return { ok: false, error: "Thiếu số điện thoại." };

  const branchId = user.role === "ceo" ? input.branch_id : user.branch_id;
  if (!branchId) return { ok: false, error: "Chưa chọn chi nhánh." };

  const dup = await findFamilyDuplicate(branchId, input.phone);
  if (dup) return { ok: false, error: "SĐT này đã thuộc một gia đình trong chi nhánh.", duplicate: dup };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("families")
    .insert({
      branch_id: branchId,
      parent_name: input.parent_name.trim(),
      contact_role: input.contact_role ?? null,
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      zalo: input.zalo?.trim() || null,
      facebook: input.facebook?.trim() || null,
      address: input.address?.trim() || null,
      tier: input.tier ?? "standard",
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "SĐT này đã thuộc một gia đình trong chi nhánh." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/families");
  return { ok: true, id: data.id };
}

export async function updateFamily(input: FamilyInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!input.id) return { ok: false, error: "Thiếu mã gia đình." };
  if (!input.parent_name?.trim()) return { ok: false, error: "Thiếu tên phụ huynh." };
  if (!input.phone?.trim()) return { ok: false, error: "Thiếu số điện thoại." };

  const supabase = createClient();
  const { data: cur } = await supabase.from("families").select("branch_id").eq("id", input.id).maybeSingle();
  if (cur?.branch_id) {
    const dup = await findFamilyDuplicate(cur.branch_id, input.phone, input.id);
    if (dup) return { ok: false, error: "SĐT này đã thuộc một gia đình khác.", duplicate: dup };
  }

  const { error } = await supabase
    .from("families")
    .update({
      parent_name: input.parent_name.trim(),
      contact_role: input.contact_role ?? null,
      phone: input.phone.trim(),
      email: input.email?.trim() || null,
      zalo: input.zalo?.trim() || null,
      facebook: input.facebook?.trim() || null,
      address: input.address?.trim() || null,
      tier: input.tier ?? "standard",
      note: input.note?.trim() || null,
    })
    .eq("id", input.id);

  if (error) {
    if (error.code === "23505") return { ok: false, error: "SĐT này đã thuộc một gia đình khác." };
    return { ok: false, error: error.message };
  }
  revalidatePath(`/families/${input.id}`);
  revalidatePath("/families");
  return { ok: true };
}

// ---- HỌC VIÊN (con) ---------------------------------------------------
export async function saveStudent(input: StudentInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!input.family_id) return { ok: false, error: "Thiếu gia đình." };
  if (!input.full_name?.trim()) return { ok: false, error: "Thiếu tên học viên." };

  const supabase = createClient();
  // Lấy branch_id từ gia đình để gắn cho student.
  const { data: fam } = await supabase.from("families").select("branch_id").eq("id", input.family_id).maybeSingle();
  if (!fam) return { ok: false, error: "Không tìm thấy gia đình." };

  const row = {
    branch_id: fam.branch_id,
    family_id: input.family_id,
    full_name: input.full_name.trim(),
    dob: input.dob || null,
    gender: input.gender?.trim() || null,
    level: input.level?.trim() || null,
    status: input.status ?? "active",
  };

  const { error } = input.id
    ? await supabase.from("students").update(row).eq("id", input.id)
    : await supabase.from("students").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/families/${input.family_id}`);
  return { ok: true };
}

// ---- GHI NHANH TƯƠNG TÁC ---------------------------------------------
export async function addFamilyInteraction(
  familyId: string,
  channel: string,
  summary: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!summary?.trim()) return { ok: false, error: "Nội dung trống." };

  const supabase = createClient();
  const { data: fam } = await supabase.from("families").select("branch_id").eq("id", familyId).maybeSingle();
  if (!fam) return { ok: false, error: "Không tìm thấy gia đình." };

  const { error } = await supabase.from("interactions").insert({
    branch_id: fam.branch_id,
    family_id: familyId,
    channel,
    summary: summary.trim(),
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/families/${familyId}`);
  return { ok: true };
}

// ---- DỮ LIỆU MẪU ------------------------------------------------------
export async function createSampleFamilies(branchIdArg?: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };

  const supabase = createClient();
  let branchId = user.role === "ceo" ? branchIdArg : user.branch_id;
  if (!branchId) {
    const { data: b } = await supabase.from("branches").select("id").limit(1).single();
    branchId = b?.id;
  }
  if (!branchId) return { ok: false, error: "Không tìm thấy chi nhánh." };

  const families: Array<{
    parent_name: string; contact_role: ContactRole; phone: string; tier: FamilyTier;
    email: string; address: string;
    students: Array<{ full_name: string; dob: string; level: string; status: StudentStatus }>;
    invoice?: { code: string; description: string; amount: number; due_date: string; paid: number };
    interactions: Array<{ channel: string; summary: string }>;
  }> = [
    {
      parent_name: "[MẪU] Nguyễn Văn Khánh", contact_role: "father", phone: "0907111001", tier: "vip",
      email: "khanh.nv@example.com", address: "12 Lê Lợi, Q.1",
      students: [
        { full_name: "[MẪU] Nguyễn Bảo An", dob: "2015-04-12", level: "Starters", status: "active" },
        { full_name: "[MẪU] Nguyễn Bảo Châu", dob: "2017-09-03", level: "Pre-Starters", status: "active" },
      ],
      invoice: { code: "[MẪU]INV-001", description: "Học phí kỳ 1", amount: 12000000, due_date: "2026-06-30", paid: 5000000 },
      interactions: [
        { channel: "call", summary: "Gọi tư vấn lộ trình IELTS cho bé lớn." },
        { channel: "zalo", summary: "Gửi lịch khai giảng qua Zalo, phụ huynh đồng ý." },
      ],
    },
    {
      parent_name: "[MẪU] Trần Thị Mỹ", contact_role: "mother", phone: "0907111002", tier: "standard",
      email: "my.tt@example.com", address: "45 Nguyễn Huệ, Q.1",
      students: [
        { full_name: "[MẪU] Trần Gia Hân", dob: "2016-12-20", level: "Movers", status: "active" },
      ],
      invoice: { code: "[MẪU]INV-002", description: "Học phí kỳ 1", amount: 6000000, due_date: "2026-07-15", paid: 6000000 },
      interactions: [
        { channel: "in_person", summary: "Phụ huynh đến trung tâm xem cơ sở vật chất." },
      ],
    },
  ];

  for (const f of families) {
    const dup = await findFamilyDuplicate(branchId, f.phone);
    if (dup) continue;

    const { data: fam, error: famErr } = await supabase
      .from("families")
      .insert({
        branch_id: branchId, parent_name: f.parent_name, contact_role: f.contact_role,
        phone: f.phone, email: f.email, address: f.address, tier: f.tier,
      })
      .select("id")
      .single();
    if (famErr || !fam) return { ok: false, error: `Lỗi tạo gia đình mẫu: ${famErr?.message}` };

    const studentRows = f.students.map((s) => ({
      branch_id: branchId, family_id: fam.id, full_name: s.full_name,
      dob: s.dob, level: s.level, status: s.status,
    }));
    const { data: studs } = await supabase.from("students").insert(studentRows).select("id");

    if (f.invoice) {
      const { data: inv } = await supabase
        .from("invoices")
        .insert({
          branch_id: branchId, family_id: fam.id,
          student_id: studs?.[0]?.id ?? null,
          code: f.invoice.code, description: f.invoice.description,
          amount: f.invoice.amount, due_date: f.invoice.due_date,
          status: f.invoice.paid >= f.invoice.amount ? "paid" : f.invoice.paid > 0 ? "partial" : "unpaid",
        })
        .select("id")
        .single();
      if (inv && f.invoice.paid > 0) {
        await supabase.from("payments").insert({
          branch_id: branchId, invoice_id: inv.id, amount: f.invoice.paid, method: "bank",
        });
      }
    }

    if (f.interactions.length) {
      await supabase.from("interactions").insert(
        f.interactions.map((it) => ({
          branch_id: branchId, family_id: fam.id, channel: it.channel,
          summary: it.summary, created_by: user.id,
        }))
      );
    }
  }

  revalidatePath("/families");
  return { ok: true };
}
