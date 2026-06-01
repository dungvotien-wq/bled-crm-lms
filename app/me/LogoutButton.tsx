"use client";

import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function LogoutButton({ variant = "default" }: { variant?: "default" | "light" }) {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const cls = variant === "light"
    ? "rounded-md border border-white/25 px-3 py-1.5 text-sm text-white/90 hover:bg-white/10"
    : "rounded-md border border-line px-4 py-2 text-sm text-ink-muted hover:bg-surface-2";

  return (
    <button onClick={handleLogout} className={cls}>
      Đăng xuất
    </button>
  );
}
