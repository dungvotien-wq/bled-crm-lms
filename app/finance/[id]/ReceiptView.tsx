"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import Receipt, { type ReceiptData } from "./Receipt";

function asciiFileName(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function ReceiptView({ data }: { data: ReceiptData }) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const baseName = `BienLai-${asciiFileName(data.invoice.receipt_no || data.invoice.code)}-${asciiFileName(data.student_name || data.family.parent_name)}`;

  async function renderPng(scale = 3): Promise<string> {
    if (!ref.current) throw new Error("no node");
    return toPng(ref.current, { pixelRatio: scale, backgroundColor: "#ffffff", cacheBust: true });
  }

  async function downloadPng() {
    setBusy(true);
    try {
      const url = await renderPng(3);
      const a = document.createElement("a");
      a.href = url; a.download = `${baseName}.png`; a.click();
    } catch (e) { alert("Lỗi tạo ảnh: " + (e as Error).message); }
    setBusy(false);
  }

  async function downloadPdf() {
    setBusy(true);
    try {
      const url = await renderPng(3);
      const img = new Image();
      img.src = url;
      await new Promise((res) => { img.onload = res; });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = (img.height / img.width) * pw;
      pdf.addImage(url, "PNG", 0, 0, pw, Math.min(ph, pdf.internal.pageSize.getHeight()));
      pdf.save(`${baseName}.pdf`);
    } catch (e) { alert("Lỗi tạo PDF: " + (e as Error).message); }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/finance" className="text-sm text-blue-600 hover:underline">← Danh sách hóa đơn</Link>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">In</button>
          <button onClick={downloadPdf} disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Tải PDF</button>
          <button onClick={downloadPng} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Đang xử lý…" : "Tải ảnh (PNG)"}
          </button>
        </div>
      </div>

      <div id="print-area" className="mx-auto overflow-x-auto rounded-xl border bg-white shadow-sm">
        <Receipt ref={ref} data={data} />
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>
    </main>
  );
}
