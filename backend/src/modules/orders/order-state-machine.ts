import { ConflictException } from '@nestjs/common';
import type { OrderStatus } from '@prisma/client';

/**
 * SERVICES-R5.1 foundation. R5.1 only ever creates orders in `pending`
 * (no wallet debit, gateway call, or installment schedule happens yet — see
 * the R5.1 report), but the enforcement point is established now so a later
 * stage can never let a caller set `status` arbitrarily. Transitions reflect
 * only the existing `OrderStatus` enum values; no meaning is invented for a
 * status this stage doesn't use (e.g. `delivered` is not assumed to mean
 * anything for a digital service until a later stage defines it).
 */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  pending: ['processing', 'awaiting_payment', 'cancelled'],
  processing: ['awaiting_payment', 'paid', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  const allowed = ORDER_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictException(
      `Invalid order status transition: ${from} -> ${to}`,
    );
  }
}
