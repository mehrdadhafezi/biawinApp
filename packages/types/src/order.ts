import type { ID, Rial, Timestamps } from "./common";
import type { PurchaseMethod } from "./catalog";

export type OrderStatus =
  | "pending"
  | "processing"
  | "awaiting_payment"
  | "paid"
  | "delivered"
  | "cancelled";

export interface Order extends Timestamps {
  id: ID;
  /** Human-facing order number, e.g. "BW-14058". */
  orderNumber: string;
  userId: ID;
  productId: ID;
  method: PurchaseMethod;
  /** Present only when method === "installment". */
  installmentMonths: number | null;
  /** Present only when method === "installment"; how many have been paid so far. */
  installmentsPaid: number | null;
  amount: Rial;
  status: OrderStatus;
  addressId: ID | null;
}
