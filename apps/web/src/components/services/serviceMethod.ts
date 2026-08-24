import type { PurchaseMethod } from "../../lib/services-api";
import type { BadgeTone } from "@biawin/ui";

export const PURCHASE_METHOD_LABEL: Record<PurchaseMethod, string> = {
  credit: "اعتباری",
  installment: "اقساطی",
  cash: "پرداخت کامل",
  free: "رایگان",
};

export const PURCHASE_METHOD_TONE: Record<PurchaseMethod, BadgeTone> = {
  credit: "info",
  installment: "warning",
  cash: "success",
  free: "neutral",
};
