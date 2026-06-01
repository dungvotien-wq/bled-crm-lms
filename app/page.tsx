import { redirect } from "next/navigation";

// Trang gốc → vào Dashboard (đã chứa kiểm tra kết nối Supabase).
export default function Home() {
  redirect("/dashboard");
}
