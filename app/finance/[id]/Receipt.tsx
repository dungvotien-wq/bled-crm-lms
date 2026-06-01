"use client";

import { forwardRef } from "react";
import { formatVnd, formatDate, type InvoiceStatus } from "@/lib/finance";

export interface ReceiptData {
  org: { company_name: string | null; head_office: string | null; email: string | null; website: string | null; hotline: string | null; terms_url: string | null };
  branch: { name: string; address: string | null; logo_url: string | null; seal_url: string | null; paid_stamp_url: string | null; bank_account: string | null };
  invoice: {
    code: string; receipt_no: string | null; status: InvoiceStatus;
    product_code: string | null; product_name: string | null; unit_label: string | null;
    quantity: number | null; unit_price: number | null;
    discount_percent: number; discount_amount: number; discount_reason: string | null;
    amount: number; due_date: string | null; tuition_valid_until: string | null;
    course_start: string | null; course_end: string | null;
    homeroom_teacher: string | null; room_class: string | null; campaign: string | null;
    receipt_issued_at: string | null;
  };
  family: { parent_name: string; phone: string | null; email: string | null; address: string | null };
  student_name: string | null;
  paid: number;
  remaining: number;
  qrDataUrl: string | null;
}

function titleFor(status: InvoiceStatus): string {
  if (status === "paid") return "BIÊN LAI HỌC PHÍ";
  if (status === "partial") return "BIÊN LAI HỌC PHÍ (THU MỘT PHẦN)";
  return "PHIẾU BÁO HỌC PHÍ";
}

const Receipt = forwardRef<HTMLDivElement, { data: ReceiptData }>(function Receipt({ data }, ref) {
  const { org, branch, invoice, family, student_name, paid, remaining, qrDataUrl } = data;
  const isPaidLike = invoice.status === "paid" || invoice.status === "partial";
  const docCode = isPaidLike && invoice.receipt_no ? invoice.receipt_no : invoice.code;

  return (
    <div ref={ref} className="receipt-root" style={{ width: 800, background: "#fff", color: "#1e293b", padding: 24, fontSize: 13, fontFamily: "Arial, sans-serif" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #1e293b", paddingBottom: 10 }}>
        {/* Trái: logo + dấu trung tâm */}
        <div style={{ width: 220 }}>
          {branch.seal_url ? (
            <img src={branch.seal_url} alt="seal" style={{ maxWidth: 200, maxHeight: 90, objectFit: "contain" }} />
          ) : branch.logo_url ? (
            <img src={branch.logo_url} alt="logo" style={{ maxWidth: 200, maxHeight: 90, objectFit: "contain" }} />
          ) : (
            <div style={{ border: "2px solid #c0392b", color: "#c0392b", borderRadius: 8, padding: "8px 10px", transform: "rotate(-4deg)", textAlign: "center", fontWeight: 700 }}>
              <div style={{ fontSize: 16 }}>TRUNG TÂM</div>
              <div style={{ fontSize: 20, letterSpacing: 2 }}>{branch.name}</div>
              <div style={{ fontSize: 9 }}>{branch.address ?? ""}</div>
            </div>
          )}
        </div>
        {/* Giữa: thông tin công ty */}
        <div style={{ flex: 1, textAlign: "center", padding: "0 8px" }}>
          <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase" }}>{org.company_name ?? "Công ty"}</div>
          <div style={{ fontSize: 11, marginTop: 2 }}>{org.head_office ?? ""}</div>
          <div style={{ fontSize: 11 }}>Chi nhánh: {branch.name}{branch.address ? ` - ${branch.address}` : ""}</div>
          <div style={{ fontSize: 11 }}>Email: {org.email ?? ""} · Website: {org.website ?? ""}</div>
          <div style={{ fontSize: 11 }}>Hotline: {org.hotline ?? ""}</div>
        </div>
        {/* Phải: dấu trạng thái + liên số */}
        <div style={{ width: 160, textAlign: "right" }}>
          {isPaidLike && (
            branch.paid_stamp_url ? (
              <img src={branch.paid_stamp_url} alt="paid" style={{ maxWidth: 150, maxHeight: 70, objectFit: "contain" }} />
            ) : (
              <div style={{ display: "inline-block", border: "3px double #c0392b", color: "#c0392b", fontWeight: 800, fontSize: 16, padding: "6px 10px", borderRadius: 6, transform: "rotate(-6deg)" }}>
                ĐÃ THU TIỀN
              </div>
            )
          )}
          <div style={{ fontSize: 11, marginTop: 6 }}>Liên số: 1/1</div>
        </div>
      </div>

      {/* TIÊU ĐỀ */}
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: 18, margin: "12px 0" }}>
        {titleFor(invoice.status)} - {docCode}
      </div>

      {/* KHỐI THÔNG TIN 2 CỘT */}
      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
        <div style={{ flex: 1 }}>
          <Info label="Họ và tên Học viên" value={student_name ?? family.parent_name} bold />
          <Info label="Địa chỉ" value={family.address ?? ""} />
          <Info label="Email" value={family.email ?? ""} />
          <Info label="Người nhận" value={`${family.parent_name}${family.phone ? " - ĐT: " + family.phone : ""}`} />
          <Info label="Ngày bắt đầu khóa học" value={formatDate(invoice.course_start)} />
          <Info label="Ngày dự kiến kết thúc khóa học" value={formatDate(invoice.course_end)} />
        </div>
        <div style={{ flex: 1 }}>
          <Info label="PC Chủ nhiệm" value={invoice.homeroom_teacher ?? ""} />
          <Info label="Phòng / Lớp" value={invoice.room_class ?? ""} />
          <Info label="Ngày thu phí" value={formatDate(invoice.receipt_issued_at)} />
          <Info label="Hình thức thanh toán" value={branch.bank_account ?? ""} />
          <Info label="Chiến dịch" value={invoice.campaign ?? ""} />
        </div>
      </div>

      {/* BẢNG CHI TIẾT (KHÔNG VAT) */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 12 }}>
        <thead>
          <tr style={{ background: "#f1f5f9" }}>
            {["STT", "Mã SP", "Tên sản phẩm", "ĐVT", "SL", "Giá", "CK(%)", "CK(VNĐ)", "Thành tiền"].map((h) => (
              <th key={h} style={cellHead}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={cell}>1</td>
            <td style={cell}>{invoice.product_code ?? ""}</td>
            <td style={{ ...cell, textAlign: "left" }}>{invoice.product_name ?? invoice.code}</td>
            <td style={cell}>{invoice.unit_label ?? ""}</td>
            <td style={cellR}>{invoice.quantity ?? 1}</td>
            <td style={cellR}>{formatVnd(invoice.unit_price ?? invoice.amount).replace(" ₫", "")}</td>
            <td style={cellR}>{invoice.discount_percent || 0}</td>
            <td style={cellR}>{formatVnd(invoice.discount_amount).replace(" ₫", "")}</td>
            <td style={cellR}>{formatVnd(invoice.amount).replace(" ₫", "")}</td>
          </tr>
        </tbody>
      </table>

      {/* Ưu đãi */}
      <div style={{ border: "1px solid #e2e8f0", borderTop: "none", padding: "6px 8px", fontSize: 12 }}>
        Chương trình khuyến mãi / Ưu đãi: <b>{invoice.discount_reason ?? "—"}</b>
      </div>

      {/* HAI MỐC + TỔNG */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12 }}>
        <div>
          <div>Hạn thanh toán: <b>{formatDate(invoice.due_date)}</b></div>
          <div>THỜI HẠN HỌC PHÍ (hiệu lực): <b>{formatDate(invoice.tuition_valid_until)}</b></div>
        </div>
        <table style={{ fontSize: 13 }}>
          <tbody>
            <tr><td style={{ padding: "2px 10px", textAlign: "right" }}>Tổng cộng</td><td style={{ padding: "2px 0", textAlign: "right", fontWeight: 700 }}>{formatVnd(invoice.amount)}</td></tr>
            <tr><td style={{ padding: "2px 10px", textAlign: "right" }}>Đã thanh toán</td><td style={{ padding: "2px 0", textAlign: "right", fontWeight: 700, color: "#16a34a" }}>{formatVnd(paid)}</td></tr>
            <tr><td style={{ padding: "2px 10px", textAlign: "right" }}>Còn lại</td><td style={{ padding: "2px 0", textAlign: "right", fontWeight: 700, color: remaining > 0 ? "#dc2626" : "#1e293b" }}>{formatVnd(remaining)}</td></tr>
          </tbody>
        </table>
      </div>

      {/* CHỮ KÝ */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, textAlign: "center", fontSize: 12 }}>
        {["Người lập", "Khách hàng", "Kế toán", "Giám đốc"].map((s) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>{s}</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>(Ký, họ tên)</div>
            <div style={{ height: 48 }} />
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12, borderTop: "1px solid #e2e8f0", paddingTop: 8 }}>
        <div style={{ flex: 1, fontSize: 10, color: "#475569", paddingRight: 12 }}>
          Bằng việc ghi danh (đóng phí/đặt cọc) vào Trung tâm, Quý Phụ huynh và Học viên đồng ý với
          bản Quy định và Điều kiện nhập học của Trung tâm. Xem thêm tại mã QR.
        </div>
        <div style={{ textAlign: "center" }}>
          {qrDataUrl && <img src={qrDataUrl} alt="QR xác thực" style={{ width: 90, height: 90 }} />}
          <div style={{ fontSize: 9, color: "#64748b" }}>Quét để xác thực</div>
        </div>
      </div>
    </div>
  );
});

const cellHead: React.CSSProperties = { border: "1px solid #cbd5e1", padding: "5px 6px", textAlign: "center", fontWeight: 700 };
const cell: React.CSSProperties = { border: "1px solid #cbd5e1", padding: "5px 6px", textAlign: "center" };
const cellR: React.CSSProperties = { border: "1px solid #cbd5e1", padding: "5px 6px", textAlign: "right" };

function Info({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "2px 0", borderBottom: "1px dotted #e2e8f0" }}>
      <span style={{ color: "#64748b", minWidth: 130 }}>{label}:</span>
      <span style={{ fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  );
}

export default Receipt;
