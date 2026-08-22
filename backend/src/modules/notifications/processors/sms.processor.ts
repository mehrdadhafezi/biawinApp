import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUE } from '../../../infra/queue/queue.constants';
import { SMS_PROVIDER, type SmsProvider } from '../sms/sms-provider.interface';

export interface SmsJobData {
  phone: string;
  message: string;
}

/**
 * Executes queued SMS jobs (enqueued by e.g. `auth`'s OtpService) through
 * whichever `SmsProvider` is currently configured (`SMS_PROVIDER` env — see
 * `sms-provider.factory.ts`). Lives in `notifications`, not `infra/queue`,
 * because *how to deliver a notification* is a notifications-domain concern;
 * `infra/queue` only owns the generic job-queue plumbing.
 */
@Processor(QUEUE.SMS)
export class SmsProcessor extends WorkerHost {
  constructor(@Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    await this.smsProvider.send(job.data.phone, job.data.message);
  }
}
