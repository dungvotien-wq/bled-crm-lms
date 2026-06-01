"use client";

import { createClient } from "@/lib/supabase-browser";
import { useState } from "react";

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMicrosoftLogin() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email profile openid",
        redirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // Nếu thành công: browser tự redirect sang Microsoft → callback
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-lg">
        {/* Logo / tiêu đề */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white">
            B
          </div>
          <h1 className="text-xl font-bold text-slate-800">BLED CRM + LMS</h1>
          <p className="mt-1 text-sm text-slate-500">
            Đăng nhập bằng tài khoản Microsoft @bled.edu.vn
          </p>
        </div>

        {/* Nút đăng nhập */}
        <button
          onClick={handleMicrosoftLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          {/* Logo Microsoft */}
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="9" height="9" fill="#F25022" />
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
            <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
          </svg>
          {loading ? "Đang chuyển hướng…" : "Đăng nhập với Microsoft 365"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">
          Chỉ dành cho nhân sự Bao Linh Education
        </p>
      </div>
    </main>
  );
}
