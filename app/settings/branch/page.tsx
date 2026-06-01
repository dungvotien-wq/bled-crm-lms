import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canEditPricing } from "@/lib/permissions";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function BranchSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canEditPricing(user.role)) redirect("/me");

  const supabase = createClient();
  const { data: org } = await supabase.from("org_settings").select("*").limit(1).maybeSingle<any>();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, address, logo_url, seal_url, paid_stamp_url, bank_account, receipt_prefix, last_receipt_seq")
    .order("name");

  return <SettingsClient org={org ?? {}} branches={branches ?? []} />;
}
