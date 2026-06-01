// Chuẩn hoá SĐT phía app — PHẢI khớp logic hàm normalize_phone() trong
// db/migrations/0003_lead_update.sql để cảnh báo trùng nhất quán.
export function normalizePhone(p: string | null | undefined): string {
  if (!p) return "";
  const digits = p.replace(/[^0-9]/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return "0" + digits.slice(2);
  }
  return digits;
}

// So khớp tên gần giống (cảnh báo mềm): bỏ dấu, thường hoá, so chuỗi con.
export function namesSimilar(a: string, b: string): boolean {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // bỏ dấu tiếng Việt (combining marks)
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}
