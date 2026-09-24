export function formatPhone(value: string): string {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6)
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value || "").trim());
}

export const SALE_STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
};

export function saleStatusLabel(status: string | undefined): string {
  return status ? SALE_STATUS_LABELS[status] ?? status : "—";
}