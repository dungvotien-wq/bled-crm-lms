import { createClient, createAdminClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { getMenuForRole, ROLE_LABELS, type AppUser } from "@/lib/permissions";
import LogoutButton from "@/app/me/LogoutButton";

export default async function MePage() {
  const supabase = createClient();

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  // Lấy thông tin user từ app_users (admin client — bỏ qua RLS cho hồ sơ chính mình)
  const admin = createAdminClient();
  const { data: appUser } = await admin
    .from("app_users")
    .select("id, email, full_name, role, branch_id, branches(name)")
    .ilike("email", session.user.email!)
    .maybeSingle<AppUser & { branches: { name: string } | null }>();

  if (!appUser) redirect("/unauthorized");

  const menu = getMenuForRole(appUser.role);
  const roleLabel = ROLE_LABELS[appUser.role];
  const branchName = (appUser as any).branches?.name ?? "Toàn hệ thống";

  return (
    <main className="mx-auto max-w-2xl p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Hồ sơ của tôi</h1>
        <LogoutButton />
      </div>

      {/* Thông tin cá nhân */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
            {appUser.full_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-slate-800">{appUser.full_name}</p>
            <p className="text-sm text-slate-500">{appUser.email}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4">
          <InfoRow label="Vai trò" value={roleLabel} />
          <InfoRow label="Chi nhánh" value={branchName} />
        </div>
      </div>

      {/* Menu được phép */}
      <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-700">Menu bạn có quyền truy cập</h2>
        <ul className="space-y-2">
          {menu.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="text-blue-500">›</span>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-800">{value}</p>
    </div>
  );
}
