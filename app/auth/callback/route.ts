import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  // Đổi code → session
  const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const email = session.user.email;
  if (!email) {
    return NextResponse.redirect(`${origin}/unauthorized`);
  }

  // Kiểm tra email trong app_users — dùng admin client (service_role)
  // để bỏ qua RLS, vì đây là bước xác thực quyền truy cập.
  const admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: appUser } = await admin
    .from("app_users")
    .select("id, role, is_active")
    .ilike("email", email)
    .maybeSingle();

  if (!appUser || !appUser.is_active) {
    // Email chưa có trong hệ thống hoặc bị khoá
    return NextResponse.redirect(`${origin}/unauthorized`);
  }

  return NextResponse.redirect(`${origin}/me`);
}
