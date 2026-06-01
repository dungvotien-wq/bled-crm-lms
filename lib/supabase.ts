import { createClient } from "@supabase/supabase-js";

// Client dùng phía trình duyệt (anon key — an toàn để lộ).
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey);
