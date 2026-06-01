import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { computeInvoiceStatus, type InvoiceStatus } from "@/lib/finance";
import ReceiptView from "./ReceiptView";
import type { ReceiptData } from "./Receipt";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", params.id).maybeSingle<any>();
  if (!inv) notFound();

  const { data: fam } = await supabase.from("families").select("parent_name, phone, email, address").eq("id", inv.family_id).maybeSingle<any>();
  const { data: stu } = inv.student_id
    ? await supabase.from("students").select("full_name").eq("id", inv.student_id).maybeSingle<any>()
    : { data: null };
  const { data: branch } = await supabase.from("branches")
    .select("name, address, logo_url, seal_url, paid_stamp_url, bank_account").eq("id", inv.branch_id).maybeSingle<any>();
  const { data: org } = await supabase.from("org_settings").select("*").limit(1).maybeSingle<any>();
  const { data: pays } = await supabase.from("payments").select("amount").eq("invoice_id", inv.id);

  const paid = (pays ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const amount = Number(inv.amount);
  const status = computeInvoiceStatus(amount, paid, inv.due_date, inv.status) as InvoiceStatus;
  const remaining = Math.max(0, amount - paid);

  // QR xác thực
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.includes("localhost") ? "http" : "https";
  const verifyUrl = `${proto}://${host}/verify/${inv.verify_token}`;
  let qrDataUrl: string | null = null;
  try { qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 200 }); } catch {}

  const data: ReceiptData = {
    org: {
      company_name: org?.company_name ?? null, head_office: org?.head_office ?? null,
      email: org?.email ?? null, website: org?.website ?? null, hotline: org?.hotline ?? null, terms_url: org?.terms_url ?? null,
    },
    branch: {
      name: branch?.name ?? "—", address: branch?.address ?? null,
      logo_url: branch?.logo_url ?? null, seal_url: branch?.seal_url ?? null,
      paid_stamp_url: branch?.paid_stamp_url ?? null, bank_account: branch?.bank_account ?? null,
    },
    invoice: {
      code: inv.code, receipt_no: inv.receipt_no, status,
      product_code: inv.product_code, product_name: inv.product_name, unit_label: inv.unit_label,
      quantity: inv.quantity != null ? Number(inv.quantity) : null,
      unit_price: inv.unit_price != null ? Number(inv.unit_price) : null,
      discount_percent: Number(inv.discount_percent ?? 0), discount_amount: Number(inv.discount_amount ?? 0),
      discount_reason: inv.discount_reason, amount,
      due_date: inv.due_date, tuition_valid_until: inv.tuition_valid_until,
      course_start: inv.course_start, course_end: inv.course_end,
      homeroom_teacher: inv.homeroom_teacher, room_class: inv.room_class, campaign: inv.campaign,
      receipt_issued_at: inv.receipt_issued_at,
    },
    family: { parent_name: fam?.parent_name ?? "—", phone: fam?.phone ?? null, email: fam?.email ?? null, address: fam?.address ?? null },
    student_name: stu?.full_name ?? null,
    paid, remaining, qrDataUrl,
  };

  return <ReceiptView data={data} />;
}
