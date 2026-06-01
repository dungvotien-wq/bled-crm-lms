"use server";

import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { canEditPricing } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export interface ActionResult { ok: boolean; error?: string }

export async function updateOrgSettings(input: {
  company_name: string; head_office: string; email: string; website: string; hotline: string; terms_url: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canEditPricing(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { data: row } = await supabase.from("org_settings").select("id").limit(1).maybeSingle();
  if (!row) return { ok: false, error: "Chưa có org_settings (chạy migration 0009)." };
  const { error } = await supabase.from("org_settings").update({
    company_name: input.company_name, head_office: input.head_office, email: input.email,
    website: input.website, hotline: input.hotline, terms_url: input.terms_url,
  }).eq("id", row.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/branch");
  return { ok: true };
}

export async function updateBranchBranding(input: {
  id: string; logo_url: string; seal_url: string; paid_stamp_url: string; bank_account: string; receipt_prefix: string;
}): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canEditPricing(user.role)) return { ok: false, error: "Không có quyền." };
  const supabase = createClient();
  const { error } = await supabase.from("branches").update({
    logo_url: input.logo_url || null, seal_url: input.seal_url || null,
    paid_stamp_url: input.paid_stamp_url || null, bank_account: input.bank_account || null,
    receipt_prefix: input.receipt_prefix?.trim() || "BL",
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/branch");
  return { ok: true };
}
