import "./globals.css";
import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import AppShell from "./AppShell";

export const metadata: Metadata = {
  title: "BLED CRM + LMS",
  description: "Hệ thống quản lý học viên & quan hệ phụ huynh — Bao Linh Education",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <html lang="vi">
      <body>
        {user ? (
          <AppShell user={{ full_name: user.full_name, role: user.role, branch_name: user.branch_name }}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
