"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrgSettings, updateBranchBranding } from "./actions";

interface Branch {
  id: string; name: string; address: string | null;
  logo_url: string | null; seal_url: string | null; paid_stamp_url: string | null;
  bank_account: string | null; receipt_prefix: string | null; last_receipt_seq: number | null;
}

export default function SettingsClient({ org, branches }: { org: any; branches: Branch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  // org
  const [companyName, setCompanyName] = useState(org.company_name ?? "");
  const [headOffice, setHeadOffice] = useState(org.head_office ?? "");
  const [email, setEmail] = useState(org.email ?? "");
  const [website, setWebsite] = useState(org.website ?? "");
  const [hotline, setHotline] = useState(org.hotline ?? "");
  const [termsUrl, setTermsUrl] = useState(org.terms_url ?? "");

  function saveOrg() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateOrgSettings({ company_name: companyName, head_office: headOffice, email, website, hotline, terms_url: termsUrl });
      setMsg(res.ok ? "✅ Đã lưu thông tin công ty." : "❌ " + res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-slate-800">Cấu hình chứng từ</h1>
      <p className="mb-5 text-sm text-slate-500">Thông tin công ty + thương hiệu & số biên lai từng chi nhánh.</p>

      {msg && <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm">{msg}</p>}

      {/* Công ty */}
      <section className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-semibold text-slate-700">Thông tin công ty (chung)</h2>
        <div className="grid grid-cols-2 gap-3">
          <F label="Tên công ty" v={companyName} set={setCompanyName} full />
          <F label="Trụ sở chính" v={headOffice} set={setHeadOffice} full />
          <F label="Email" v={email} set={setEmail} />
          <F label="Website" v={website} set={setWebsite} />
          <F label="Hotline" v={hotline} set={setHotline} />
          <F label="Link điều khoản (QR phụ)" v={termsUrl} set={setTermsUrl} />
        </div>
        <div className="mt-4 text-right">
          <button onClick={saveOrg} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Lưu thông tin công ty
          </button>
        </div>
      </section>

      {/* Chi nhánh */}
      <h2 className="mb-3 font-semibold text-slate-700">Thương hiệu & số biên lai theo chi nhánh</h2>
      <div className="space-y-4">
        {branches.map((b) => <BranchCard key={b.id} branch={b} />)}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Ảnh logo/con dấu: dán link ảnh (PNG nền trong). Nếu để trống, hệ thống vẽ con dấu tạm bằng CSS.
        Khi bạn gửi file, sẽ được đặt ở <code>/branding/</code> và điền link <code>/branding/ten-file.png</code>.
      </p>
    </main>
  );
}

function BranchCard({ branch }: { branch: Branch }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [logo, setLogo] = useState(branch.logo_url ?? "");
  const [seal, setSeal] = useState(branch.seal_url ?? "");
  const [stamp, setStamp] = useState(branch.paid_stamp_url ?? "");
  const [bank, setBank] = useState(branch.bank_account ?? "");
  const [prefix, setPrefix] = useState(branch.receipt_prefix ?? "BL");

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await updateBranchBranding({ id: branch.id, logo_url: logo, seal_url: seal, paid_stamp_url: stamp, bank_account: bank, receipt_prefix: prefix });
      setMsg(res.ok ? "✅ Đã lưu." : "❌ " + res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{branch.name}</h3>
        <span className="text-xs text-slate-400">Số biên lai gần nhất: {branch.receipt_prefix ?? "BL"}{String(branch.last_receipt_seq ?? 0).padStart(5, "0")}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <F label="Link logo" v={logo} set={setLogo} />
        <F label="Link con dấu trung tâm" v={seal} set={setSeal} />
        <F label='Link dấu "ĐÃ THU TIỀN"' v={stamp} set={setStamp} />
        <F label="Tiền tố số biên lai (vd DH)" v={prefix} set={setPrefix} />
        <F label="Số TK ngân hàng (TK + tên + NH)" v={bank} set={setBank} full />
      </div>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <div className="mt-3 text-right">
        <button onClick={save} disabled={isPending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-50">Lưu chi nhánh</button>
      </div>
    </div>
  );
}

function F({ label, v, set, full }: { label: string; v: string; set: (s: string) => void; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input value={v} onChange={(e) => set(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    </div>
  );
}
