import { apiClient } from "./api-client";

export type OrderStatus = "pending" | "processing" | "awaiting_payment" | "paid" | "delivered" | "cancelled";

/**
 * SERVICES-R5.26 — matches the raw `Order` shape returned by `POST /orders`
 * and `GET /orders/:id` (`backend/src/modules/orders/orders.service.ts`,
 * built R5.1/R5.19 — this stage adds no backend field, only this client).
 * `amount` is ALWAYS the server-resolved payable price (never the
 * CardProduct's displayed value) — see `cardProductPresentation.ts`'s own
 * doc comments for why those two facts are never interchangeable.
 */
export interface OrderDto {
  id: string;
  orderNumber: string;
  userId: string;
  serviceId: string;
  cardProductId: string | null;
  merchantId: string | null;
  method: string | null;
  amount: number;
  status: OrderStatus;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * SERVICES-R5.26 — the customer purchase flow's only API surface. The
 * server derives `userId` from the JWT and re-resolves `serviceId`/`amount`
 * from the real `CardProduct` row itself (`OrdersService.create()`,
 * unchanged since R5.19) — this client never sends either. `idempotencyKey`
 * is caller-generated (see `PurchaseSheet.tsx`) and is the only thing that
 * makes a retried tap safe: the same key for the same CardProduct always
 * returns the original Order, never a duplicate.
 */
export const ordersApi = {
  createCardProductOrder: (cardProductId: string, idempotencyKey: string) =>
    apiClient.post<OrderDto>("/orders", { cardProductId, idempotencyKey }),
  getOrder: (id: string) => apiClient.get<OrderDto>(`/orders/${id}`),
};
