import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE } from '../queue.constants';

export interface FinancialEventJobData {
  type: 'order.paid' | 'wallet.topup' | 'credit.used' | 'installment.due';
  entityId: string;
  payload: Record<string, unknown>;
}

/**
 * Foundation stub for downstream side-effects of financial events (e.g.
 * updating loyalty points, notifying analytics, syncing accounting). The
 * financial mutation itself (writing WalletTransaction/CreditUsage rows) must
 * still happen synchronously inside the owning module's DB transaction —
 * this queue is only for what happens *after* that commit.
 */
@Processor(QUEUE.FINANCIAL_EVENTS)
export class FinancialEventsProcessor extends WorkerHost {
  private readonly logger = new Logger(FinancialEventsProcessor.name);

  process(job: Job<FinancialEventJobData>): Promise<void> {
    this.logger.log(
      `[stub] would handle financial event "${job.data.type}" for ${job.data.entityId}`,
    );
    return Promise.resolve();
  }
}
