export const fmtCLP = (n: number | string) => {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num as number)) return "-";
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(num as number);
};

export const coerceAmount = (v: any): number => {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v)
    .replace(/\$/g, "")
    .replace(/\./g, "")
    .replace(/\s/g, "")
    .replace(/CLP/gi, "")
    .replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
