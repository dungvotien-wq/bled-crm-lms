export default function Placeholder({ module }: { module: string }) {
  return (
    <div className="mx-auto max-w-3xl p-10">
      <div className="rounded-2xl border border-dashed bg-white p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">🚧</div>
        <h1 className="text-xl font-bold text-slate-800">Đang xây dựng — {module}</h1>
        <p className="mt-2 text-sm text-slate-500">Module này sẽ được phát triển ở các bước tiếp theo.</p>
      </div>
    </div>
  );
}
