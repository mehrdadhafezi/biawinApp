import type { InstallmentDto } from "../../lib/installment-api";

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentDto["status"], string> = {
  active: "در حال پرداخت",
  completed: "تسویه‌شده",
  defaulted: "معوق",
  cancelled: "لغوشده",
};

export const INSTALLMENT_STATUS_TONE: Record<InstallmentDto["status"], "info" | "success" | "warning" | "neutral"> = {
  active: "info",
  completed: "success",
  defaulted: "warning",
  cancelled: "neutral",
};

export function formatDueDate(nextDueDate: string | null): string {
  if (!nextDueDate) return "بدون قسط باقی‌مانده";
  return new Date(nextDueDate).toLocaleDateString("fa-IR", { year: "numeric", month: "long", day: "numeric" });
}
