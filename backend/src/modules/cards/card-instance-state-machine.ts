import { ConflictException } from '@nestjs/common';
import type { CustomerCardStatus } from '@prisma/client';

/**
 * SERVICES-R5.16 foundation. Nothing yet drives a real transition (no
 * purchase-execution or usage-tracking path exists this stage — see
 * docs/services-r5-16-services-card-catalog-contract.md), but the
 * enforcement point is established now, mirroring
 * `backend/src/modules/orders/order-state-machine.ts`'s exact precedent,
 * so a later stage can never let a caller set `status` arbitrarily.
 */
export const CARD_INSTANCE_STATUS_TRANSITIONS: Record<
  CustomerCardStatus,
  readonly CustomerCardStatus[]
> = {
  CREATED: ['PURCHASED', 'CANCELLED'],
  PURCHASED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PARTIALLY_USED', 'USED', 'EXPIRED', 'CANCELLED'],
  PARTIALLY_USED: ['USED', 'EXPIRED', 'CANCELLED'],
  USED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function assertCardInstanceTransition(
  from: CustomerCardStatus,
  to: CustomerCardStatus,
): void {
  const allowed = CARD_INSTANCE_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new ConflictException(
      `Invalid card instance status transition: ${from} -> ${to}`,
    );
  }
}
