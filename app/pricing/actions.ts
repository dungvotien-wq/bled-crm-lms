"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { canEditPricing } from "@/lib/permissions";
import { parseVndInput } from "@/lib/finance";
import { revalidatePath } from "next/cache";

export interface PlanInput {
  id?: string;
  program: string;
  period_type: string;
  unit_price: number | string; // chấp nhận chuỗi "2.000.000"
  note?: string;
  branch_id?: string | null; // null = toàn hệ thống (chỉ CEO)
  active?: boolean;
}

export interface ActionResult { ok: boolean; error?: string }

export async function savePlan(input: PlanInput): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!canEditPricing(user.role)) return { ok: false, error: "Bạn không có quyền sửa bảng giá." };
  if (!input.program?.trim()) return { ok: false, error: "Thiếu chương trình." };

  const price = typeof input.unit_price === "string" ? parseVndInput(input.unit_price) : input.unit_price;
  if (!price || price < 0) return { ok: false, error: "Đơn giá không hợp lệ." };

  // Kế toán chỉ tạo giá cho chi nhánh mình; CEO chọn (null = toàn hệ thống).
  let branchId: string | null;
  if (user.role === "ceo") branchId = input.branch_id ?? null;
  else branchId = user.branch_id;

  const supabase = createClient();
  const row = {
    branch_id: branchId,
    program: input.program.trim(),
    period_type: input.period_type,
    unit_price: price,
    note: input.note?.trim() || null,
    active: input.active ?? true,
  };

  const { error } = input.id
    ? await supabase.from("tuition_plans").update(row).eq("id", input.id)
    : await supabase.from("tuition_plans").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/pricing");
  return { ok: true };
}

export async function togglePlan(id: string, active: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Chưa đăng nhập." };
  if (!canEditPricing(user.role)) return { ok: false, error: "Bạn không có quyền." };

  const supabase = createClient();
  const { error } = await supabase.from("tuition_plans").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/pricing");
  return { ok: true };
}
