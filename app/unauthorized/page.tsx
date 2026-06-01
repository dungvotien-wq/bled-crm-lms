export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-lg">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-bold text-slate-800">Tài khoản chưa được cấp quyền</h1>
        <p className="mt-2 text-sm text-slate-500">
          Email của bạn chưa có trong hệ thống BLED CRM. Vui lòng liên hệ quản
          trị viên để được cấp quyền truy cập.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Quay lại đăng nhập
        </a>
      </div>
    </main>
  );
}
