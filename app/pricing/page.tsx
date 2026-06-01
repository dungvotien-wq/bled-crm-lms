import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { canEditPricing } from "@/lib/permissions";
import PricingClient from "./PricingClient";
import type { TuitionPlan } from "@/lib/pricing-types";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: plans } = await supabase
    .from("tuition_plans")
    .select("*, branches(name)")
    .order("program");
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");

  const rows: TuitionPlan[] = (plans ?? []).map((p: any) => ({
    ...p, unit_price: Number(p.unit_price), branch_name: p.branches?.name ?? null,
  }));

  return (
    <PricingClient
      currentUser={{ role: user.role, branch_id: user.branch_id }}
      canEdit={canEditPricing(user.role)}
      plans={rows}
      branches={branches ?? []}
    />
  );
}
