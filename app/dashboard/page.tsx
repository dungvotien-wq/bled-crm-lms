import { createClient } from "@/lib/supabase-server";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Target, GraduationCap, Wallet, CalendarDays, Database, ArrowRight } from "lucide-react";
import { formatVnd } from "@/lib/finance";
import { ROLE_LABELS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createClient();

  // KPI — số liệu THẬT (read-only, RLS tự lọc theo chi nhánh). Không bịa số.
  let dbOk = true;
  const safe = async (p: PromiseLike<{ count: number | null }>) => {
    try { const { count } = await p; return count ?? 0; } catch { dbOk = false; return null; }
  };
  const leadCount = await safe(supabase.from("leads").select("*", { count: "exact", head: true }));
  const studentActive = await safe(supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "active"));
  const classActive = await safe(supabase.from("classes").select("*", { count: "exact", head: true }).eq("status", "active"));

  // Công nợ chờ thu = Σ hóa đơn (trừ void) − Σ thanh toán
  let outstanding: number | null = 0;
  try {
    const { data: inv } = await supabase.from("invoices").select("amount, status");
    const { data: pay } = await supabase.from("payments").select("amount");
    const issued = (inv ?? []).filter((i) => i.status !== "void").reduce((s, i) => s + Number(i.amount), 0);
    const paid = (pay ?? []).reduce((s, p) => s + Number(p.amount), 0);
    outstanding = issued - paid;
  } catch { outstanding = null; }

  const kpis = [
    { label: "Tổng Lead", value: leadCount, icon: Target, color: "text-primary" },
    { label: "Học viên đang học", value: studentActive, icon: GraduationCap, color: "text-accent" },
    { label: "Học phí chờ thu", value: outstanding == null ? null : formatVnd(outstanding), icon: Wallet, color: "text-warning" },
    { label: "Lớp đang mở", value: classActive, icon: CalendarDays, color: "text-success" },
  ];

  return (
    <div className="p-5">
      {/* Tiêu đề trang */}
      <div className="mb-4">
        <h1 className="h-page">Dashboard</h1>
        <p className="t-caption">Xin chào {user.full_name} · {ROLE_LABELS[user.role]} · {user.branch_name ?? "Toàn hệ thống"}</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="card flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 ${k.color}`}>
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-bold text-ink">{k.value ?? "—"}</div>
                <div className="t-caption truncate">{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lưới nội dung */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {/* Lối tắt nhanh */}
        <div className="card p-4">
          <h2 className="h-section mb-3">Lối tắt nhanh</h2>
          <div className="space-y-1.5">
            {[
              { href: "/leads", label: "Quản lý Lead" },
              { href: "/families", label: "Phụ huynh & Học viên" },
              { href: "/finance", label: "Học phí & Công nợ" },
              { href: "/pricing", label: "Bảng giá học phí" },
            ].map((l) => (
              <Link key={l.href} href={l.href}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-surface-2">
                <span>{l.label}</span>
                <ArrowRight size={15} className="text-ink-subtle" />
              </Link>
            ))}
          </div>
        </div>

        {/* Hoạt động gần đây (placeholder có cấu trúc) */}
        <div className="card p-4 lg:col-span-2">
          <h2 className="h-section mb-3">Hoạt động gần đây</h2>
          {/* TODO: nối Supabase — lấy interactions/payments mới nhất theo branch, sắp theo thời gian. */}
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-md border border-dashed border-line px-3 py-2.5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-surface-2" />
                <div className="min-w-0 flex-1">
                  <div className="h-2.5 w-1/3 rounded bg-surface-2" />
                  <div className="mt-1.5 h-2 w-2/3 rounded bg-surface-2" />
                </div>
              </div>
            ))}
            <p className="t-caption pt-1">Sẽ hiển thị tương tác & thanh toán gần nhất khi nối dữ liệu (P1).</p>
          </div>
        </div>
      </div>

      {/* Hàng dưới: trạng thái hệ thống + thông tin user */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="card flex items-center gap-3 p-4">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${dbOk ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
            <Database size={18} />
          </div>
          <div>
            <div className="text-sm font-medium text-ink">{dbOk ? "Đã kết nối Supabase" : "Lỗi kết nối Supabase"}</div>
            <div className="t-caption">Trạng thái cơ sở dữ liệu</div>
          </div>
        </div>
        <div className="card p-4">
          <div className="t-label mb-1">Tài khoản</div>
          <div className="text-sm text-ink">{user.full_name}</div>
          <div className="t-caption">{ROLE_LABELS[user.role]} · {user.branch_name ?? "Toàn hệ thống"}</div>
        </div>
      </div>
    </div>
  );
}
